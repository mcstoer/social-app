/*
 * Android implementation using the native zsupport library. iOS is excluded
 * from autolinking for now, so it uses the stub in crypto.ts.
 */
import {
  decryptVData,
  encryptVData,
  zGetEncryptionaddress,
  ZSupportError,
} from '@veruszsupportlib/react-native-veruszsupport'
// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'
import {
  DataDescriptor,
  DataDescriptorKey,
  VdxfUniValue,
} from 'verus-typescript-primitives'

import {
  assertDerivationKeys,
  toArrayBuffer,
  toOptionalArrayBuffer,
} from './crypto.shared'
import {
  type ChannelKeys,
  type DecryptDescriptorParams,
  type DecryptParams,
  type DerivationKeys,
  type EncryptedPayload,
  type EncryptParams,
  type VerusCryptoApi,
} from './crypto.types'
import {toVerusCryptoError, VerusCryptoError} from './errors'

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

/**
 * Wraps calling the native zsupport library and converts the errors from
 * synchronous calls into the VerusCryptoError. The ZSupportError keeps its
 * real message in inner.message, so we read it from there.
 *
 * This is Android only since the ZSupportError only exists on native.
 */
function callNative<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn())
  } catch (e) {
    if (e != null && ZSupportError.instanceOf(e)) {
      return Promise.reject(new VerusCryptoError(e.inner.message, {cause: e}))
    }
    return Promise.reject(toVerusCryptoError(e))
  }
}

export async function zGetEncryptionAddress(
  params: DerivationKeys,
): Promise<ChannelKeys> {
  assertDerivationKeys(params)

  const keys = await callNative(() =>
    zGetEncryptionaddress(
      toOptionalArrayBuffer(params.seed),
      toOptionalArrayBuffer(params.spendingKey),
      params.hdIndex,
      params.encryptionIndex,
      toOptionalArrayBuffer(params.fromId),
      toOptionalArrayBuffer(params.toId),
      params.returnSecret ?? false,
    ),
  )
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
  const payload = await callNative(() =>
    encryptVData(
      toArrayBuffer(address),
      toArrayBuffer(data_to_encrypt),
      returnSsk ?? false,
    ),
  )
  return {
    ephemeralPublicKey: Buffer.from(payload.ephemeralPublicKey),
    encrypted_data: Buffer.from(payload.encryptedData),
    symmetricKey: payload.symmetricKey
      ? Buffer.from(payload.symmetricKey)
      : null,
  }
}
encryptData satisfies VerusCryptoApi['encryptData']

export async function decryptData({
  ivk,
  epk,
  data_to_decrypt,
  ssk,
}: DecryptParams): Promise<Buffer> {
  const data = await callNative(() =>
    decryptVData(
      toOptionalArrayBuffer(ivk),
      toOptionalArrayBuffer(epk),
      toArrayBuffer(data_to_decrypt),
      toOptionalArrayBuffer(ssk),
    ),
  )
  return Buffer.from(data)
}
decryptData satisfies VerusCryptoApi['decryptData']

/**
 * The daemon's signdata puts the data into a CDataDescriptor then wraps it in
 * a CVDXF_Data before encrypting. The daemon's decryptdata decrypts and
 * unravels the envelope for us, but since the native zsupport library only
 * does the decryption we need to do the unravelling ourselves.
 */
export async function decryptDescriptor({
  descriptor,
  ivk,
  ssk,
}: DecryptDescriptorParams): Promise<DataDescriptor> {
  if (!descriptor.objectdata?.length) {
    throw new VerusCryptoError('Encrypted descriptor has no objectdata')
  }

  const plaintext = await decryptData({
    ivk,
    ssk,
    epk: descriptor.hasEPK() ? descriptor.epk : undefined,
    data_to_decrypt: descriptor.objectdata,
  })

  const decryptedUniValue = new VdxfUniValue()

  try {
    decryptedUniValue.fromBuffer(plaintext, 0)
  } catch (e) {
    throw toVerusCryptoError(e)
  }

  const wrappedDescriptor = decryptedUniValue.values
    .map(value => value[DataDescriptorKey.vdxfid])
    .find((d): d is DataDescriptor => d instanceof DataDescriptor)

  if (!wrappedDescriptor) {
    throw new VerusCryptoError('Missing data descriptor in decrypted data')
  }

  return wrappedDescriptor
}
decryptDescriptor satisfies VerusCryptoApi['decryptDescriptor']
