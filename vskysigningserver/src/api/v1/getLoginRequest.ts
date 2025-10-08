import {
  type LoginConsentChallenge,
  type LoginConsentRequest,
  LoginConsentResponse,
} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'

import {CHAIN, REMOTE_RPC_URL, signingAddress} from '../../config'
import {fetchWIF} from '../../utils/signing'

const idInterface = new VerusIdInterface(CHAIN, REMOTE_RPC_URL)

export const createSignedLoginRequest = async (
  challenge: LoginConsentChallenge,
): Promise<LoginConsentRequest> => {
  console.log('Signing login request at', new Date().toLocaleTimeString())

  try {
    const req = await idInterface.createLoginConsentRequest(
      signingAddress,
      challenge,
      await fetchWIF(signingAddress),
    )

    return req
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to create login request: ${error.message}`)
  }
}

export const verifyLoginResponse = async (response: any) => {
  const res = new LoginConsentResponse(response)
  const isValid = await idInterface.verifyLoginConsentResponse(res)

  return isValid
}
