/*
 * Stub for native implementation that may use promises.
 */
import {type DataDescriptor} from 'verus-typescript-primitives'

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

const NOT_SUPPORTED = 'Verus zsupport crypto is not yet supported on native'

export function zGetEncryptionAddress(
  _params: DerivationKeys,
): Promise<ChannelKeys> {
  return Promise.reject(new Error(NOT_SUPPORTED))
}
zGetEncryptionAddress satisfies VerusCryptoApi['zGetEncryptionAddress']

export function encryptData(_params: EncryptParams): Promise<EncryptedPayload> {
  return Promise.reject(new Error(NOT_SUPPORTED))
}
encryptData satisfies VerusCryptoApi['encryptData']

export function decryptData(_params: DecryptParams): Promise<Buffer> {
  return Promise.reject(new Error(NOT_SUPPORTED))
}
decryptData satisfies VerusCryptoApi['decryptData']

export function decryptDescriptor(
  _params: DecryptDescriptorParams,
): Promise<DataDescriptor> {
  return Promise.reject(new Error(NOT_SUPPORTED))
}
decryptDescriptor satisfies VerusCryptoApi['decryptDescriptor']
