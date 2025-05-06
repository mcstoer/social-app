// @ts-ignore: No type definitions for crypto-browserify
import * as crypto from 'crypto-browserify'
import * as dotenv from 'dotenv'
import {
  IDENTITY_NAME_COMMITMENT_TXID,
  IDENTITY_REGISTRATION_TXID,
  LOGIN_CONSENT_PROVISIONING_ERROR_KEY_COMMIT_FAILED,
  LOGIN_CONSENT_PROVISIONING_ERROR_KEY_CREATION_FAILED,
  LOGIN_CONSENT_PROVISIONING_ERROR_KEY_NAMETAKEN,
  LOGIN_CONSENT_PROVISIONING_ERROR_KEY_UNKNOWN,
  LOGIN_CONSENT_PROVISIONING_RESULT_STATE_COMPLETE,
  LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED,
  LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL,
  LoginConsentProvisioningChallenge,
  LoginConsentProvisioningDecision,
  LoginConsentProvisioningRequest,
  type LoginConsentProvisioningResponse,
  LoginConsentProvisioningResult,
  ProvisioningTxid,
  toBase58Check,
} from 'verus-typescript-primitives'
import {ProvisioningRequest} from 'verus-typescript-primitives/dist/vdxf/classes/provisioning/ProvisioningRequest'
import {type ProvisioningResponse} from 'verus-typescript-primitives/dist/vdxf/classes/provisioning/ProvisioningResponse'
import VerusdRpcInterface from 'verusd-rpc-ts-client/src/VerusdRpcInterface'
import {VerusIdInterface} from 'verusid-ts-client'

import {callRPCDaemon, type rpcResult} from './callRPCDaemon'

dotenv.config()

const iaddress = process.env.IADDRESS as string
const raddress = process.env.RADDRESS as string
const wif = process.env.WIF as string

const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN as string
const DEFAULT_URL = process.env.DEFAULT_URL as string
const RPC_USERNAME = process.env.RPC_USERNAME as string
const RPC_PASSWORD = process.env.RPC_PASSWORD as string
const JSON_RPC_SERVER = process.env.JSON_RPC_SERVER as string

// const transferid = process.env.TRANSFERID as string;
const transferfqn = process.env.TRANSFERFQN as string

const idInterface = new VerusIdInterface(DEFAULT_CHAIN, DEFAULT_URL)
const rpcInterface = new VerusdRpcInterface(DEFAULT_CHAIN, DEFAULT_URL)

export interface NameCommitment {
  txid: string
  namereservation: {
    version: number
    name: string
    parent: string
    salt: string
    referral: string
    nameid: string
    system?: string
  }
}

// Track the state of responses that indicated the process was successful.
// The decision can be used to make the new response.
const responses = new Map<string, LoginConsentProvisioningDecision>()

export const callDaemon = async (
  command: string,
  parameters?: (string | object)[],
): Promise<rpcResult> => {
  return await callRPCDaemon(
    JSON_RPC_SERVER,
    RPC_USERNAME,
    RPC_PASSWORD,
    command,
    parameters,
  )
}

export const registerNameCommitment = async (
  request: ProvisioningRequest,
  parent: boolean,
): Promise<{
  provisioningResponse: ProvisioningResponse
  nameCommitment?: NameCommitment
  decisionId?: string
}> => {
  const randID = Buffer.from(crypto.randomBytes(20))
  const decisionId = toBase58Check(randID, 102)
  const provisioningRequest = new ProvisioningRequest(request)

  // Create the decision separately so we can change the result if an error occurs.
  const provisioningDecision = new LoginConsentProvisioningDecision({
    decision_id: decisionId,
    created_at: Number((Date.now() / 1000).toFixed(0)),
    result: new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL.vdxfid,
    }),
    request: provisioningRequest,
  })

  // Create the response to send back and wait to sign it before returning.
  // Leave out the WIF to avoid signing.
  const provisioningReponse =
    await idInterface.createVerusIdProvisioningResponse(
      iaddress,
      provisioningDecision,
    )

  const address = request.signing_address
  if (address === undefined) {
    provisioningDecision.result = new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid,
      error_key: LOGIN_CONSENT_PROVISIONING_ERROR_KEY_UNKNOWN.vdxfid,
      error_desc: 'The signing address of the request does not exist.',
    })
    provisioningReponse.decision = provisioningDecision
    return {provisioningResponse: provisioningReponse}
  }

  const verified = await VerusIdInterface.verifyVerusIdProvisioningRequest(
    provisioningRequest,
    address,
  )

  if (!verified) {
    provisioningDecision.result = new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid,
      error_key: LOGIN_CONSENT_PROVISIONING_ERROR_KEY_UNKNOWN.vdxfid,
      error_desc: 'Unable to verify the authenticity of the request.',
    })
    provisioningReponse.decision = provisioningDecision
    return {provisioningResponse: provisioningReponse}
  }

  if (provisioningRequest.challenge.name === undefined) {
    provisioningDecision.result = new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid,
      error_key: LOGIN_CONSENT_PROVISIONING_ERROR_KEY_UNKNOWN.vdxfid,
      error_desc: 'No name exists to provision.',
    })
    provisioningReponse.decision = provisioningDecision
    return {provisioningResponse: provisioningReponse}
  }

  // Get the name without the chain part.
  const name = provisioningRequest.challenge.name.split('.')[0]

  // TODO: Only accepts one system based on env.
  const registerNameCommitmentParams = [
    name,
    raddress, // R-address to hold the commitment.
    '', // Skip the referral address for now.
    parent ? iaddress : DEFAULT_CHAIN,
  ]

  let commitmentRes: NameCommitment
  try {
    commitmentRes = (
      await callDaemon('registernamecommitment', registerNameCommitmentParams)
    ).result as NameCommitment
  } catch (e) {
    console.error(e)
    provisioningDecision.result = new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid,
      error_key: LOGIN_CONSENT_PROVISIONING_ERROR_KEY_COMMIT_FAILED.vdxfid,
      error_desc: 'Unable to register the name commitment.',
    })
    provisioningReponse.decision = provisioningDecision
    return {provisioningResponse: provisioningReponse}
  }

  // Get the name of the parent in order to create the fully qualified name.
  // Use daemon since the RPC client doesn't give the fully qualified name.
  const parentId = (
    await callDaemon('getidentity', [commitmentRes.namereservation.parent])
  ).result

  // The identity object must have the fully qualified name.

  // @ts-ignore
  const parentFqn = parentId.fullyqualifiedname

  const fullyQualifiedName =
    commitmentRes.namereservation.name + '.' + parentFqn
  provisioningDecision.result = new LoginConsentProvisioningResult({
    state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL.vdxfid,
    error_key: undefined,
    error_desc: undefined,
    identity_address: commitmentRes.namereservation.nameid,
    system_id: commitmentRes.namereservation.system,
    fully_qualified_name: fullyQualifiedName,
    parent: commitmentRes.namereservation.parent,
    info_uri: `${process.env.BASE_URL}/api/v1/provisioning/${decisionId}`,
    provisioning_txids: [
      new ProvisioningTxid(
        commitmentRes.txid,
        IDENTITY_NAME_COMMITMENT_TXID.vdxfid,
      ),
    ],
  })
  provisioningReponse.decision = provisioningDecision

  // Add response to the map if it didn't fail.
  responses.set(decisionId, provisioningDecision)

  return {
    provisioningResponse: provisioningReponse,
    nameCommitment: commitmentRes,
    decisionId: decisionId,
  }
}

export const signProvisioningResponse = async (
  response: ProvisioningResponse,
): Promise<ProvisioningResponse> => {
  return await idInterface.signVerusIdProvisioningResponse(response, wif)
}

interface idRegistration {
  // Take from the name commitment.
  txid: string
  namereservation: {
    name: string
    salt: string
    referral: string
    parent: string
    nameid: string
  }
  identity: {
    name: string // Take from the name commitment.
    parent?: string // Parent's friendly name, not the same as from name commitment.
    primaryaddresses: string[]
    minimumsignatures: number
    privateaddress?: string
    revocationauthority?: string
    recoveryauthority?: string
  }
}

// provisionIdentity performs registeridentity with a given name commitment.
export const provisionIdentity = async (
  request: ProvisioningRequest,
  nameCommitment: NameCommitment,
  hasParent: boolean,
  decisionId: string,
) => {
  // Wait until 2 blocks have passed so that the registration is ready.
  const registrationWaitBlocks = 2
  await waitForBlocks(rpcInterface, registrationWaitBlocks)

  // This should be already checked in the name commitment step.
  if (request.signing_address === undefined) {
    throw new Error('No r-address is specified to give the identity to.')
  }

  const registration: idRegistration = {
    txid: nameCommitment.txid,
    namereservation: nameCommitment.namereservation,
    identity: {
      name: nameCommitment.namereservation.name,
      parent: hasParent ? iaddress : undefined,
      primaryaddresses: [request.signing_address],
      minimumsignatures: 1,
      revocationauthority: iaddress,
      recoveryauthority: iaddress,
    },
  }

  // Register the identity.
  const registerIdentityParams = [registration]
  // Get the previous decision to update.
  const decision = responses.get(decisionId)

  if (!decision) {
    console.error('Unable to find previous decision ID of ', decisionId)
    return
  } else if (!decision.result) {
    console.error(
      'Unable to find previous decision result with ID of ',
      decisionId,
    )
    return
  }

  try {
    //throw new Error('error');
    const registerIdentityRes = await callDaemon(
      'registeridentity',
      registerIdentityParams,
    )

    // Check to see if there was an issue with the request.
    if (registerIdentityRes.error) {
      const error = registerIdentityRes.error
      if (error.message === 'Identity already exists.') {
        decision.result.state =
          LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid
        decision.result.error_key =
          LOGIN_CONSENT_PROVISIONING_ERROR_KEY_NAMETAKEN.vdxfid
        decision.result.error_desc = 'Identity already exists.'
      } else {
        decision.result.state =
          LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid
        decision.result.error_key =
          LOGIN_CONSENT_PROVISIONING_ERROR_KEY_CREATION_FAILED.vdxfid
        decision.result.error_desc = error.message
      }
    } else {
      decision.result.state =
        LOGIN_CONSENT_PROVISIONING_RESULT_STATE_COMPLETE.vdxfid

      const registerTxid = new ProvisioningTxid(
        registerIdentityRes.result as unknown as string,
        IDENTITY_REGISTRATION_TXID.vdxfid,
      )
      if (decision.result.provisioning_txids) {
        decision.result.provisioning_txids.push(registerTxid)
      } else {
        decision.result.provisioning_txids = [registerTxid]
      }
    }
  } catch (e) {
    console.error(e)
    decision.result.state =
      LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid
    decision.result.error_key =
      LOGIN_CONSENT_PROVISIONING_ERROR_KEY_CREATION_FAILED.vdxfid
    decision.result.error_desc = 'Unable to register the identity.'
  }

  responses.set(decisionId, decision)
}

const waitForBlocks = async (
  rpcInterface: VerusdRpcInterface,
  blocks: number,
) => {
  // TODO: Fix when getBlockCount gets added into the rpcInterface again.
  let currentHeight: number = 0 //(await rpcInterface.getBlockCount()).result
  const targetHeight: number = currentHeight + blocks

  // Poll for blocks being added.
  while (currentHeight < targetHeight) {
    // Sleep for 5 seconds.
    await new Promise(r => setTimeout(r, 5000))
    currentHeight = 0 //(await rpcInterface.getBlockCount()).result
  }
}

export const checkProvisioningStatus = async (
  decisionId: string,
): Promise<LoginConsentProvisioningResponse> => {
  const decision = responses.get(decisionId)

  let provisioningDecision: LoginConsentProvisioningDecision
  if (decision) {
    provisioningDecision = decision
  } else {
    // Create a new decision if the id was not found.
    const randID = Buffer.from(crypto.randomBytes(20))
    const decisionId = toBase58Check(randID, 102)
    // Need to create a request too since it's included in the decision.
    const challenge = new LoginConsentProvisioningChallenge({
      challenge_id: decisionId,
      created_at: Number((Date.now() / 1000).toFixed(0)),
      name: '',
    })
    const request = new LoginConsentProvisioningRequest({
      signing_address: iaddress,
      challenge: challenge,
    })
    provisioningDecision = new LoginConsentProvisioningDecision({
      decision_id: decisionId,
      created_at: Number((Date.now() / 1000).toFixed(0)),
      result: new LoginConsentProvisioningResult({
        state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_FAILED.vdxfid,
        error_key: LOGIN_CONSENT_PROVISIONING_ERROR_KEY_UNKNOWN.vdxfid,
        error_desc: 'Unknown decision ID.',
      }),
      request: request,
    })
  }

  const provisioningReponse =
    await idInterface.createVerusIdProvisioningResponse(
      iaddress,
      provisioningDecision,
    )

  return provisioningReponse
}

export const verifyProvisioningResponse = async (
  res: LoginConsentProvisioningResponse,
): Promise<Boolean> => {
  return await idInterface.verifyLoginConsentResponse(res)
}

export const transferIdentity = async (
  request: ProvisioningRequest,
): Promise<{
  provisioningResponse: ProvisioningResponse
}> => {
  const randID = Buffer.from(crypto.randomBytes(20))
  const decisionId = toBase58Check(randID, 102)
  const provisioningRequest = new ProvisioningRequest(request)

  // Create the decision separately so we can change the result if an error occurs.
  const provisioningDecision = new LoginConsentProvisioningDecision({
    decision_id: decisionId,
    created_at: Number((Date.now() / 1000).toFixed(0)),
    result: new LoginConsentProvisioningResult({
      state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL.vdxfid,
    }),
    request: provisioningRequest,
  })

  // Create the response to send back and wait to sign it before returning.
  // Leave out the WIF to avoid signing.
  const provisioningReponse =
    await idInterface.createVerusIdProvisioningResponse(
      iaddress,
      provisioningDecision,
    )

  // Use daemon since the RPC client doesn't give the fully qualified name.
  //const transferIdentityObject = (await callDaemon('getidentity', [transferid]))
  const transferIdentityObject = (
    await callDaemon('getidentity', [transferfqn])
  ).result

  // The identity object must have the fully qualified name.

  // @ts-ignore
  const fqn = transferIdentityObject.fullyqualifiedname

  // @ts-ignore
  const identityAddress = transferIdentityObject.identity.identityaddress

  provisioningDecision.result = new LoginConsentProvisioningResult({
    state: LOGIN_CONSENT_PROVISIONING_RESULT_STATE_PENDINGAPPROVAL.vdxfid,
    error_key: undefined,
    error_desc: undefined,
    identity_address: identityAddress,
    fully_qualified_name: fqn,
    info_uri: `${process.env.BASE_URL}/api/v1/provisioning/${decisionId}`,
  })
  provisioningReponse.decision = provisioningDecision

  // Add response to the map if it didn't fail.
  responses.set(decisionId, provisioningDecision)

  return {
    provisioningResponse: provisioningReponse,
  }
}
