// @ts-ignore: No type definitions for crypto-browserify
import * as crypto from 'crypto-browserify'
import * as dotenv from 'dotenv'
import {
  type IdentityUpdateRequest,
  type IdentityUpdateRequestDetails,
  toBase58Check,
} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'
dotenv.config()

const iaddress = process.env.IADDRESS as string
const wif = process.env.WIF as string

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
  const requestId = toBase58Check(randID, 102)

  // TODO: Add the scope

  try {
    const req = await idInterface.createIdentityUpdateRequest(
      iaddress,
      details,
      wif,
    )

    const uri = req.toWalletDeeplinkUri()
    return {uri, requestId} // Return an object containing the URI and requestId
  } catch (error) {
    console.error('Failed to generate identity update request:', error)
    return {error: 'Failed to generate identity update request'} // Return an object containing the error
  }
}

export const verifyIdentityUpdateResponse = async (
  response: IdentityUpdateRequest,
) => {
  const isValid = await idInterface.verifyIdentityUpdateResponse(response)
  return isValid
}
