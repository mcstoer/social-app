import BN from 'bn.js'
import {
  CompactIAddressObject,
  HASH_TYPE_SHA256,
  VerifiableSignatureData,
} from 'verus-typescript-primitives'

import {CHAIN, processAddress, signingAddress} from '#/config'

export function createSigData() {
  return new VerifiableSignatureData({
    signatureVersion: new BN(2),
    hashType: HASH_TYPE_SHA256,
    systemID: new CompactIAddressObject({
      type: CompactIAddressObject.TYPE_I_ADDRESS,
      address: processAddress(CHAIN, CHAIN),
    }),
    identityID: new CompactIAddressObject({
      type: CompactIAddressObject.TYPE_I_ADDRESS,
      address: signingAddress,
    }),
  })
}
