/*
 * Encryption on every platform, through veruszsupportlibrary: its WebAssembly
 * build on the web, its native engine on Android and iOS.
 */
// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'
import {type DataDescriptor} from 'verus-typescript-primitives'
import * as zsupport from 'veruszsupportlib'

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

export async function zGetEncryptionAddress(
  params: DerivationKeys,
): Promise<ChannelKeys> {
  const keys = await zsupport.zGetEncryptionAddress(params)

  return {
    address: Buffer.from(keys.address),
    ivk: Buffer.from(keys.ivk),
    extfvk: Buffer.from(keys.extfvk),
    spendingKey: keys.spendingKey ? Buffer.from(keys.spendingKey) : null,
  }
}
zGetEncryptionAddress satisfies VerusCryptoApi['zGetEncryptionAddress']

export async function encryptData({
  address,
  data_to_encrypt,
  returnSsk,
}: EncryptParams): Promise<EncryptedPayload> {
  const payload = await zsupport.encryptData({
    address,
    data: data_to_encrypt,
    returnSsk,
  })

  return {
    ephemeralPublicKey: Buffer.from(payload.epk),
    encrypted_data: Buffer.from(payload.encryptedData),
    symmetricKey: payload.ssk ? Buffer.from(payload.ssk) : null,
  }
}
encryptData satisfies VerusCryptoApi['encryptData']

export async function decryptData({
  ivk,
  epk,
  data_to_decrypt,
  ssk,
}: DecryptParams): Promise<Buffer> {
  const decrypted = await zsupport.decryptData({
    encryptedData: data_to_decrypt,
    epk,
    ivk,
    ssk,
  })

  return Buffer.from(decrypted)
}
decryptData satisfies VerusCryptoApi['decryptData']

// Decrypts the descriptor and unwraps it from the daemon's format.
export function decryptDescriptor(
  params: DecryptDescriptorParams,
): Promise<DataDescriptor> {
  return zsupport.decryptDescriptor(params)
}
decryptDescriptor satisfies VerusCryptoApi['decryptDescriptor']
