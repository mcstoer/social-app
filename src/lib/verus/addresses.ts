import {
  CompactIAddressObject,
  fromBase58Check,
  toBase58Check,
  toIAddress,
} from 'verus-typescript-primitives'

import {DEFAULT_CHAIN} from '#/env/verussky'

const I_ADDR_VERSION = 102

export function isIAddress(value: string): boolean {
  try {
    fromBase58Check(value)
    return true
  } catch {
    return false
  }
}

// Converts an name to an i-address or leaves an i-address unchanged.
export function processIAddress(address: string, chain: string): string {
  // Check if we have a base58 address, otherwise convert it to base58.
  try {
    fromBase58Check(address)
    return address
  } catch {
    return toIAddress(address, chain)
  }
}

export function generateRequestID(): CompactIAddressObject {
  const randID = Buffer.from(crypto.getRandomValues(new Uint8Array(20)))
  const requestID = CompactIAddressObject.fromAddress(
    toBase58Check(randID, I_ADDR_VERSION),
    DEFAULT_CHAIN,
  )
  return requestID
}
