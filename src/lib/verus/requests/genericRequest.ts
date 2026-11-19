import BN from 'bn.js'
import {
  CompactIAddressObject,
  GenericRequest,
  type GenericRequestInterface,
  type OrdinalVDXFObject,
  ResponseURI,
  type SaplingPaymentAddress,
  VerifiableSignatureData,
} from 'verus-typescript-primitives'
import {type VerusIdInterface} from 'verusid-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {generateRequestID} from '#/lib/verus/addresses'
import {getServiceSystem, type ServiceSystem} from '#/lib/verus/serviceSystem'
import * as persisted from '#/state/persisted'
import {IS_NATIVE} from '#/env'
import {VERUSSKY_APP_ID} from '#/env/verussky'

const RESPONSES_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/responses`
const SIGNING_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/signing`
const REQUESTS_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/requests`

// useIntentHandler receives it.
export const RESPONSE_REDIRECT_URI = 'bluesky://intent/verusid-response'

const responseURIs = IS_NATIVE
  ? [
      ResponseURI.fromUriString(
        RESPONSE_REDIRECT_URI,
        ResponseURI.TYPE_REDIRECT,
      ),
    ]
  : [ResponseURI.fromUriString(RESPONSES_ENDPOINT, ResponseURI.TYPE_POST)]

// Wallets post the reply to the VerusSky server instead of opening a link.
const repliesArePosted = responseURIs.some(uri =>
  uri.type.eq(ResponseURI.TYPE_POST),
)

export interface GenericRequestOptions {
  /**
   * Wallets encrypt the reply's details to this address, so the signing server
   * only relays encrypted data.
   * Verus Mobile requires it for credential requests.
   */
  encryptResponseToAddress?: SaplingPaymentAddress
}

async function createGenericRequest(
  verusIdInterface: VerusIdInterface,
  system: ServiceSystem,
  ordinals: OrdinalVDXFObject[],
  isSignedByUser: boolean,
  options: GenericRequestOptions,
) {
  // Wallets use the signer as the app's scope unless appOrDelegatorID names
  // another identity. The app's own signature needs no name. A request the
  // user signs has to name the app.
  const params: GenericRequestInterface = {
    requestID: generateRequestID(),
    createdAt: new BN((Date.now() / 1000).toFixed(0)),
    responseURIs,
    details: ordinals,
    appOrDelegatorID: isSignedByUser
      ? CompactIAddressObject.fromAddress(VERUSSKY_APP_ID)
      : undefined,
    encryptResponseToAddress: options.encryptResponseToAddress,
    flags: system.isTestnet
      ? GenericRequest.BASE_FLAGS.or(GenericRequest.FLAG_IS_TESTNET)
      : GenericRequest.BASE_FLAGS,
  }

  return await verusIdInterface.createGenericRequest(params)
}

async function signGenericRequest(
  request: GenericRequest,
): Promise<GenericRequest> {
  const response = await fetch(SIGNING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(request.toBuffer()),
  })

  if (!response.ok) {
    throw new Error(`Signing request failed: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const signed = new GenericRequest()
  signed.fromBuffer(buffer)
  return signed
}

/**
 * Throws unless the request is signed by the app's own identity, for the chain
 * of the Verus service in use.
 */
function assertSignedByApp(request: GenericRequest, system: ServiceSystem) {
  const signerID = request.signature?.identityID.toIAddress()
  if (signerID !== VERUSSKY_APP_ID) {
    throw new Error(
      `Requests are signed by ${signerID ?? 'no identity'}, but EXPO_PUBLIC_VERUSSKY_APP_ID is ${VERUSSKY_APP_ID}`,
    )
  }

  const systemID = request.signature?.systemID.toIAddress()
  if (systemID !== system.systemID) {
    throw new Error(
      `Requests are signed for system ${systemID}, but the Verus service uses ${system.chain}`,
    )
  }
}

/**
 * Signs the request as the user's identity, with the Verus service in use.
 * The service's wallet must hold that identity, so this only works with the
 * user's own daemon. Wallets accept such a request when they control the same
 * identity.
 */
async function signGenericRequestWithService(
  verusIdInterface: VerusIdInterface,
  system: ServiceSystem,
  request: GenericRequest,
  signingIdentity: string,
): Promise<GenericRequest> {
  const identityRes =
    await verusIdInterface.interface.getIdentity(signingIdentity)
  const signerID = identityRes.result?.identity.identityaddress
  if (!signerID) {
    throw new Error(
      `Signing request failed: the Verus service doesn't know ${signingIdentity}`,
    )
  }

  request.signature = new VerifiableSignatureData({
    systemID: CompactIAddressObject.fromAddress(system.systemID),
    identityID: CompactIAddressObject.fromAddress(signerID),
  })
  request.setFlags()

  // The same call Verus Desktop uses to sign its responses.
  const signRes = await verusIdInterface.interface.signData({
    address: signerID,
    datahash: request.getRawDataSha256().toString('hex'),
  })
  const signature = signRes.result?.signature
  if (!signature) {
    throw new Error(
      `Signing request failed: ${signRes.error?.message ?? 'the Verus service returned no signature'}`,
    )
  }
  request.signature.signatureAsVch = Buffer.from(signature, 'base64')

  // Check the signature the way a wallet will, to fail here with a clear error.
  if (!(await verusIdInterface.verifyGenericRequest(request))) {
    throw new Error(
      `Signing request failed: the signature from the Verus service isn't valid for ${signingIdentity}`,
    )
  }

  return request
}

/**
 * Tells the VerusSky server about a request that it didn't sign, so it accepts
 * the reply the wallet posts there. The server checks the signature first.
 */
async function registerGenericRequest(request: GenericRequest): Promise<void> {
  const response = await fetch(REQUESTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(request.toBuffer()),
  })

  if (!response.ok) {
    const reason = (await response.text().catch(() => '')).trim()
    throw new Error(`Registering request failed: ${reason || response.status}`)
  }
}

export async function createAndSignGenericRequest(
  verusIdInterface: VerusIdInterface,
  ordinals: OrdinalVDXFObject[],
  options: GenericRequestOptions = {},
): Promise<GenericRequest> {
  const {signingIdentity} = persisted.get('verusServiceInterface')
  // Every step follows the chain of the Verus service in use.
  const system = getServiceSystem(verusIdInterface)
  const request = await createGenericRequest(
    verusIdInterface,
    system,
    ordinals,
    !!signingIdentity,
    options,
  )

  if (signingIdentity) {
    const signed = await signGenericRequestWithService(
      verusIdInterface,
      system,
      request,
      signingIdentity,
    )
    if (repliesArePosted) {
      await registerGenericRequest(signed)
    }
    return signed
  }

  const signed = await signGenericRequest(request)
  assertSignedByApp(signed, system)
  return signed
}
