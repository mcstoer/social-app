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

// The i-address of the chain this server works on.
export const SYSTEM_ID = processAddress(CHAIN, CHAIN)

// Reads a whole number of at least 1 from the environment, or the default.
const readPositiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') {
    return fallback
  }

  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a whole number of at least 1`)
  }
  return value
}

// The longest a request waits for its reply before the server forgets it.
// A request whose authentication details expire sooner is forgotten then.
// Matches the expiry VerusSky gives authentication requests.
export const REQUEST_TTL_SECONDS = readPositiveInt('REQUEST_TTL_SECONDS', 3600)

// The most requests the server keeps waiting at once.
export const MAX_PENDING_REQUESTS = readPositiveInt(
  'MAX_PENDING_REQUESTS',
  10_000,
)

export const MAX_ENVELOPE_BODY_SIZE = '64kb'

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
