// @ts-ignore: No type definitions for crypto-browserify
import {
  type IdentityUpdateRequest,
  type IdentityUpdateRequestDetails,
  type IdentityUpdateResponse,
} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'

import {CHAIN, REMOTE_RPC_URL, signingAddress} from '../../config'
import {fetchWIF} from '../../utils/signing'

const idInterface = new VerusIdInterface(CHAIN, REMOTE_RPC_URL)

export const createSignedIdentityUpdateRequest = async (
  details: IdentityUpdateRequestDetails,
): Promise<IdentityUpdateRequest> => {
  console.log(
    'Signing identity update request at',
    new Date().toLocaleTimeString(),
  )

  try {
    const req = await idInterface.createIdentityUpdateRequest(
      signingAddress,
      details,
      await fetchWIF(signingAddress),
    )

    return req
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(
      `Failed to create identity update request: ${error.message}`,
    )
  }
}

export const verifyIdentityUpdateResponse = async (
  response: IdentityUpdateResponse,
) => {
  const isValid = await idInterface.verifyIdentityUpdateResponse(response)
  return isValid
}
