// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'
import {type DataDescriptor} from 'verus-typescript-primitives'
import * as zsupport from 'veruszsupportlib'

import {logger} from '#/logger'
import {
  type ChannelKeys,
  type DecryptDescriptorParams,
  type DecryptParams,
  type DerivationKeys,
  type EncryptedPayload,
  type EncryptParams,
} from './crypto.types'
import {isVerusCryptoError} from './errors'

export type {
  ChannelKeys,
  DecryptDescriptorParams,
  DecryptParams,
  DerivationKeys,
  EncryptedPayload,
  EncryptParams,
} from './crypto.types'
export {isVerusCryptoError} from './errors'

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (e) {
    if (!isVerusCryptoError(e)) {
      logger.error('Unexpected Verus crypto error', {safeMessage: e})
    }
    throw e
  }
}

export async function zGetEncryptionAddress(
  params: DerivationKeys,
): Promise<ChannelKeys> {
  const keys = await call(() => zsupport.zGetEncryptionAddress(params))
  return {
    address: Buffer.from(keys.address),
    ivk: Buffer.from(keys.ivk),
    extfvk: Buffer.from(keys.extfvk),
    spendingKey: keys.spendingKey ? Buffer.from(keys.spendingKey) : null,
  }
}

export async function encryptData({
  address,
  data_to_encrypt,
  returnSsk,
}: EncryptParams): Promise<EncryptedPayload> {
  const payload = await call(() =>
    zsupport.encryptData({address, data: data_to_encrypt, returnSsk}),
  )
  return {
    ephemeralPublicKey: Buffer.from(payload.epk),
    encrypted_data: Buffer.from(payload.encryptedData),
    symmetricKey: payload.ssk ? Buffer.from(payload.ssk) : null,
  }
}

export async function decryptData({
  ivk,
  epk,
  data_to_decrypt,
  ssk,
}: DecryptParams): Promise<Buffer> {
  const decrypted = await call(() =>
    zsupport.decryptData({encryptedData: data_to_decrypt, epk, ivk, ssk}),
  )
  return Buffer.from(decrypted)
}

export function decryptDescriptor(
  params: DecryptDescriptorParams,
): Promise<DataDescriptor> {
  return call(() => zsupport.decryptDescriptor(params))
}
