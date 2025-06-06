// @ts-ignore: No type definitions for crypto-browserify
import * as crypto from 'crypto-browserify'
import * as dotenv from 'dotenv'
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
dotenv.config()

const iaddress = process.env.IADDRESS as string
const wif = process.env.WIF as string

const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN as string
const DEFAULT_URL = process.env.DEFAULT_URL as string

const idInterface = new VerusIdInterface(DEFAULT_CHAIN, DEFAULT_URL)

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
        `${process.env.BASE_WEBHOOK_URL}/confirm-login`,
        LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid,
      ),
    ],
    created_at: Number((Date.now() / 1000).toFixed(0)),
  })

  try {
    const req = await idInterface.createLoginConsentRequest(
      iaddress,
      challenge,
      wif,
    )

    const uri = req.toWalletDeeplinkUri()
    return {uri} // Return an object containing the URI
  } catch {
    return {error: 'Failed to generate login request'} // Return an object containing the error
  }
}

export const verifyLoginResponse = async (response: any) => {
  const res = new LoginConsentResponse(response)
  const isValid = await idInterface.verifyLoginConsentResponse(res)

  return isValid
}
