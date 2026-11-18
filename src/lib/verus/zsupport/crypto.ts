/*
 * Native implementation. Runs the same Rust as the web build, through the
 * React Native package of veruszsupportlibrary.
 */
import {
  decryptVData,
  encryptVData,
  zGetEncryptionaddress,
  ZSupportError,
} from '@veruszsupportlib/react-native-veruszsupport'
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'
import {DataDescriptor, VdxfUniValue} from 'verus-typescript-primitives'

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

// The native module takes and returns ArrayBuffers.
function toArrayBuffer(bytes: Buffer): ArrayBuffer
function toArrayBuffer(bytes?: Buffer | null): ArrayBuffer | undefined
function toArrayBuffer(bytes?: Buffer | null): ArrayBuffer | undefined {
  if (!bytes) {
    return undefined
  }

  return Uint8Array.from(bytes).buffer
}

// Rethrows a native module error as a predifned Rust error.
function toError(e: unknown): Error {
  if (e && ZSupportError.instanceOf(e)) {
    return new Error(e.inner.message)
  }

  return e instanceof Error ? e : new Error(String(e))
}

export async function zGetEncryptionAddress(
  params: DerivationKeys,
): Promise<ChannelKeys> {
  try {
    const keys = await zGetEncryptionaddress(
      toArrayBuffer(params.seed),
      toArrayBuffer(params.spendingKey),
      params.hdIndex,
      params.encryptionIndex,
      toArrayBuffer(params.fromId),
      toArrayBuffer(params.toId),
      params.returnSecret ?? false,
    )

    return {
      address: Buffer.from(keys.address),
      ivk: Buffer.from(keys.ivk),
      extfvk: Buffer.from(keys.extfvk),
      spendingKey: keys.spendingKey ? Buffer.from(keys.spendingKey) : null,
    }
  } catch (e) {
    throw toError(e)
  }
}
zGetEncryptionAddress satisfies VerusCryptoApi['zGetEncryptionAddress']

export async function encryptData({
  address,
  data_to_encrypt,
  returnSsk,
}: EncryptParams): Promise<EncryptedPayload> {
  try {
    const payload = await encryptVData(
      toArrayBuffer(address),
      toArrayBuffer(data_to_encrypt),
      returnSsk ?? false,
    )

    return {
      ephemeralPublicKey: Buffer.from(payload.ephemeralPublicKey),
      encrypted_data: Buffer.from(payload.encryptedData),
      symmetricKey: payload.symmetricKey
        ? Buffer.from(payload.symmetricKey)
        : null,
    }
  } catch (e) {
    throw toError(e)
  }
}
encryptData satisfies VerusCryptoApi['encryptData']

export async function decryptData({
  ivk,
  epk,
  data_to_decrypt,
  ssk,
}: DecryptParams): Promise<Buffer> {
  try {
    const decrypted = await decryptVData(
      toArrayBuffer(ivk),
      toArrayBuffer(epk),
      toArrayBuffer(data_to_decrypt),
      toArrayBuffer(ssk),
    )

    return Buffer.from(decrypted)
  } catch (e) {
    throw toError(e)
  }
}
decryptData satisfies VerusCryptoApi['decryptData']

// decrypt, then unwrap the DataDescriptor the daemon format carries.
export async function decryptDescriptor({
  descriptor,
  ivk,
  ssk,
}: DecryptDescriptorParams): Promise<DataDescriptor> {
  if (!descriptor.objectdata || descriptor.objectdata.length === 0) {
    throw new Error('decryptDescriptor: encrypted descriptor has no objectdata')
  }

  const decrypted = await decryptData({
    ivk,
    epk: descriptor.epk,
    data_to_decrypt: descriptor.objectdata,
    ssk,
  })

  // The decrypted bytes are untrusted: anyone can encrypt to a public address.
  const vdxfValue = new VdxfUniValue()
  try {
    vdxfValue.fromBuffer(decrypted, 0)
  } catch {
    decrypted.fill(0)
    throw new Error('decryptDescriptor: decrypted plaintext is malformed')
  }

  const first = vdxfValue.values[0]
  const found = first ? Object.values(first)[0] : undefined
  if (found instanceof DataDescriptor) {
    return found
  }

  decrypted.fill(0)
  throw new Error(
    'decryptDescriptor: decrypted plaintext does not contain a DataDescriptor',
  )
}
decryptDescriptor satisfies VerusCryptoApi['decryptDescriptor']
