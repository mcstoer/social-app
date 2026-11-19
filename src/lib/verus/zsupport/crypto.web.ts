// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'
import {type DataDescriptor} from 'verus-typescript-primitives'
import * as zsupport from 'veruszsupportlibrary'

import {assertDerivationKeys, callZsupport} from './crypto.shared'
import {
  type ChannelKeys,
  type DecryptDescriptorParams,
  type DecryptParams,
  type DerivationKeys,
  type EncryptedPayload,
  type EncryptParams,
  type VerusCryptoApi,
} from './crypto.types'

export type {
  ChannelKeys,
  DecryptDescriptorParams,
  DecryptParams,
  DerivationKeys,
  EncryptedPayload,
  EncryptParams,
  VerusCryptoApi,
} from './crypto.types'
export {VerusCryptoError} from './errors'

export function zGetEncryptionAddress(params: DerivationKeys): ChannelKeys {
  assertDerivationKeys(params)

  const keys = callZsupport(() => zsupport.z_getEncryptionAddress(params))
  return {
    address: Buffer.from(keys.address),
    ivk: Buffer.from(keys.ivk),
    extfvk: Buffer.from(keys.extfvk),
    spendingKey: keys.spendingKey ? Buffer.from(keys.spendingKey) : null,
  }
}
zGetEncryptionAddress satisfies VerusCryptoApi['zGetEncryptionAddress']

export function encryptData({
  address,
  data_to_encrypt,
  returnSsk,
}: EncryptParams): EncryptedPayload {
  const payload = callZsupport(() =>
    zsupport.encryptData({address, data: data_to_encrypt, returnSsk}),
  )
  return {
    ephemeralPublicKey: Buffer.from(payload.ephemeralPublicKey),
    encrypted_data: Buffer.from(payload.objectdata),
    symmetricKey: payload.symmetricKey
      ? Buffer.from(payload.symmetricKey)
      : null,
  }
}
encryptData satisfies VerusCryptoApi['encryptData']

export function decryptData({
  ivk,
  epk,
  data_to_decrypt,
  ssk,
}: DecryptParams): Buffer {
  const data = callZsupport(() =>
    zsupport.decryptData({objectdata: data_to_decrypt, epk, ivk, ssk}),
  )
  return Buffer.from(data)
}
decryptData satisfies VerusCryptoApi['decryptData']

export function decryptDescriptor(
  params: DecryptDescriptorParams,
): DataDescriptor {
  return callZsupport(() => zsupport.decryptDescriptor(params))
}
decryptDescriptor satisfies VerusCryptoApi['decryptDescriptor']
