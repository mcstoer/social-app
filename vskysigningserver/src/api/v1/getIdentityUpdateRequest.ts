// @ts-ignore: No type definitions for crypto-browserify
import * as crypto from 'crypto-browserify'
import {
  BigNumber,
  type IdentityUpdateRequestDetails,
  type IdentityUpdateResponse,
  ResponseUri,
} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'

import {fetchWIF} from '../../utils/signing'

const iaddress = process.env.EXPO_PUBLIC_IADDRESS as string
const BASE_WEBHOOK_URL =
  (process.env.BASE_WEBHOOK_URL as string) || 'http://localhost:21001'

const DEFAULT_CHAIN = process.env.DEFAULT_CHAIN as string
const DEFAULT_URL = process.env.DEFAULT_URL as string

const idInterface = new VerusIdInterface(DEFAULT_CHAIN, DEFAULT_URL)

export const generateIdentityUpdateRequest = async (
  details: IdentityUpdateRequestDetails,
) => {
  console.log(
    'Generating identity update request at',
    new Date().toLocaleTimeString(),
  )
  const randID = Buffer.from(crypto.randomBytes(20))
  const requestId = new BigNumber(randID)
  // Generate the timestamp in seconds, since that's what block times are in.
  const createdAt = new BigNumber((Date.now() / 1000).toFixed(0))

  // Add the response URIs.
  details.responseuris = [
    ResponseUri.fromUriString(
      `${BASE_WEBHOOK_URL}/confirm-credential-update`,
      ResponseUri.TYPE_POST,
    ),
  ]

  // IMPORTANT: Set the flag to indicate that response URIs are present
  if (!details.containsResponseUris()) {
    details.toggleContainsResponseUris()
  }

  details.requestid = requestId
  details.createdat = createdAt

  try {
    const req = await idInterface.createIdentityUpdateRequest(
      iaddress,
      details,
      await fetchWIF(iaddress),
    )

    // Convert the requestId into a string since the request will convert it to one with toJson().
    const requestIdString = requestId.toString(10)
    const uri = req.toWalletDeeplinkUri()

    return {uri, requestId: requestIdString} // Return an object containing the URI and requestId
  } catch (error) {
    console.error('Failed to generate identity update request:', error)
    return {error: 'Failed to generate identity update request'} // Return an object containing the error
  }
}

export const verifyIdentityUpdateResponse = async (
  response: IdentityUpdateResponse,
) => {
  const isValid = await idInterface.verifyIdentityUpdateResponse(response)
  return isValid
}
