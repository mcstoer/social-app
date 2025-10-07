import * as dotenv from 'dotenv'
import {fromBase58Check, toIAddress} from 'verus-typescript-primitives'

import {fetchVerusDaemonConfig} from './utils/daemonCredentials'

// Configure dotenv globally for the entire application and
// try to retrieve the highest level .env file first.
dotenv.config({path: '../.env'})
dotenv.config()

const iaddress = process.env.EXPO_PUBLIC_IADDRESS as string
export const CHAIN = (process.env.DEFAULT_CHAIN as string) || 'VRSCTEST'
export const REMOTE_RPC_URL = process.env.DEFAULT_URL as string
export const SERVER_URL = process.env.BASE_URL || 'http://localhost:25000'
export const WEBHOOK_URL = process.env.BASE_WEBHOOK_URL || SERVER_URL
export const RADDRESS = process.env.RADDRESS as string
export const TRANSFERFQN = process.env.TRANSFERFQN as string

const processAddress = (address: string, chain: string) => {
  // Check if we have a base58 address, otherwise convert it to base58.
  try {
    fromBase58Check(address)
    return address
  } catch {
    return toIAddress(address, chain)
  }
}

export const signingAddress = processAddress(iaddress, CHAIN)

export const verusDaemonConfig = fetchVerusDaemonConfig(
  CHAIN,
  process.env.VERUS_CONFIG_PATH,
)
