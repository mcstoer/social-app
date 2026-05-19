import {
  CompactIAddressObject,
  fromBase58Check,
  toBase58Check,
  toIAddress,
} from 'verus-typescript-primitives'

import {DEFAULT_CHAIN} from '#/env'

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
  // Use 102, which is the ID_ADDR_VERSION
  const requestID = CompactIAddressObject.fromAddress(
    toBase58Check(randID, 102),
    DEFAULT_CHAIN,
  )
  return requestID
}
