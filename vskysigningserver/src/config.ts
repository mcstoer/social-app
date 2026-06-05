import * as dotenv from 'dotenv'
import {fromBase58Check, toIAddress} from 'verus-typescript-primitives'
import VerusdRpcInterface from 'verusd-rpc-ts-client/lib/VerusdRpcInterface'
import {VerusIdInterface} from 'verusid-ts-client'

import {fetchVerusDaemonConfig} from './services/daemonCredentials'

// Configure dotenv globally for the entire application and
// try to retrieve the highest level .env file first.
dotenv.config({path: '../.env'})
dotenv.config()

const rawSigningAddress = process.env.SIGNING_ADDRESS as string
export const CHAIN =
  (process.env.EXPO_PUBLIC_DEFAULT_CHAIN as string) || 'VRSCTEST'
export const REMOTE_RPC_URL = process.env.DEFAULT_URL as string
export const SERVER_URL = process.env.BASE_URL || 'http://localhost:25000'
export const WEBHOOK_URL = process.env.BASE_WEBHOOK_URL || SERVER_URL
export const RADDRESS = process.env.RADDRESS as string
export const TRANSFERFQN = process.env.TRANSFERFQN as string

export const processAddress = (address: string, chain: string) => {
  // Check if we have a base58 address, otherwise convert it to base58.
  try {
    fromBase58Check(address)
    return address
  } catch {
    return toIAddress(address, chain)
  }
}

export const signingAddress = processAddress(rawSigningAddress, CHAIN)

export const verusDaemonConfig = fetchVerusDaemonConfig(
  CHAIN,
  process.env.VERUS_CONFIG_PATH,
)

// Create a single idInterface instance with authentication if available
export const idInterface = new VerusIdInterface(
  CHAIN,
  'http://' + verusDaemonConfig.rpchost + ':' + verusDaemonConfig.rpcport,
  verusDaemonConfig.rpcuser && verusDaemonConfig.rpcpassword
    ? {
        auth: {
          username: verusDaemonConfig.rpcuser,
          password: verusDaemonConfig.rpcpassword,
        },
      }
    : undefined,
)

export const rpcInterface = new VerusdRpcInterface(
  CHAIN,
  'http://' + verusDaemonConfig.rpchost + ':' + verusDaemonConfig.rpcport,
  verusDaemonConfig.rpcuser && verusDaemonConfig.rpcpassword
    ? {
        auth: {
          username: verusDaemonConfig.rpcuser,
          password: verusDaemonConfig.rpcpassword,
        },
      }
    : undefined,
)
