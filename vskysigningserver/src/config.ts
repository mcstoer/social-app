import * as dotenv from 'dotenv'
import {fromBase58Check, toIAddress} from 'verus-typescript-primitives'

// Configure dotenv globally for the entire application and
// try to retrieve the highest level .env file first.
dotenv.config({path: '../.env'})
dotenv.config()

const iaddress = process.env.EXPO_PUBLIC_IADDRESS as string

const processAddress = (address: string) => {
  // Check if we have a base58 address, otherwise convert it to base58.
  try {
    fromBase58Check(address)
    return address
  } catch {
    return toIAddress(address, 'VRSCTEST')
  }
}

export const signingAddress = processAddress(iaddress)
