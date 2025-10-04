// @ts-ignore: No type definitions for crypto-browserify
import * as crypto from 'crypto-browserify'
import {
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  IDENTITY_VIEW,
  LOGIN_CONSENT_WEBHOOK_VDXF_KEY,
  LoginConsentChallenge,
  LoginConsentResponse,
  RedirectUri,
  RequestedPermission,
  toBase58Check,
} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'

import {CHAIN, REMOTE_RPC_URL, signingAddress, WEBHOOK_URL} from '../../config'
import {fetchWIF} from '../../utils/signing'

const idInterface = new VerusIdInterface(CHAIN, REMOTE_RPC_URL)

export const generateLoginRequest = async () => {
  console.log('Generating login request at', new Date().toLocaleTimeString())
  const randID = Buffer.from(crypto.randomBytes(20))
  const challengeId = toBase58Check(randID, 102)

  const challenge = new LoginConsentChallenge({
    challenge_id: challengeId,
    requested_access: [
      new RequestedPermission(IDENTITY_VIEW.vdxfid),
      new RequestedPermission(IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid),
    ],
    redirect_uris: [
      new RedirectUri(
        `${WEBHOOK_URL}/confirm-login`,
        LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid,
      ),
    ],
    created_at: Number((Date.now() / 1000).toFixed(0)),
  })

  try {
    const req = await idInterface.createLoginConsentRequest(
      signingAddress,
      challenge,
      await fetchWIF(signingAddress),
    )

    const uri = req.toWalletDeeplinkUri()
    return {uri}
  } catch (e) {
    return {error: 'Failed to generate login request - ' + e}
  }
}

export const verifyLoginResponse = async (response: any) => {
  const res = new LoginConsentResponse(response)
  const isValid = await idInterface.verifyLoginConsentResponse(res)

  return isValid
}
