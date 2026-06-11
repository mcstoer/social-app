// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {type Buffer} from 'buffer'
import {type DataDescriptor} from 'verus-typescript-primitives'

export interface DerivationKeys {
  seed?: Buffer
  spendingKey?: Buffer
  hdIndex?: number
  encryptionIndex?: number
  fromId?: Buffer
  toId?: Buffer
  returnSecret?: boolean
}

export interface ChannelKeys {
  address: Buffer
  ivk: Buffer
  extfvk: Buffer
  spendingKey?: Buffer | null
}

export interface EncryptParams {
  address: Buffer
  data_to_encrypt: Buffer
  returnSsk?: boolean
}

export interface EncryptedPayload {
  ephemeralPublicKey: Buffer
  encrypted_data: Buffer
  symmetricKey?: Buffer | null
}

export interface DecryptParams {
  ivk?: Buffer
  epk?: Buffer
  data_to_decrypt: Buffer
  ssk?: Buffer
}

export interface DecryptDescriptorParams {
  descriptor: DataDescriptor
  ivk?: Buffer
  ssk?: Buffer
}

type MaybePromise<T> = T | Promise<T>

// Web is sync and native is possibly async, so we use MaybePromise to have a
// shared API.
export type VerusCryptoApi = {
  zGetEncryptionAddress(params: DerivationKeys): MaybePromise<ChannelKeys>
  encryptData(params: EncryptParams): MaybePromise<EncryptedPayload>
  decryptData(params: DecryptParams): MaybePromise<Buffer>
  decryptDescriptor(
    params: DecryptDescriptorParams,
  ): MaybePromise<DataDescriptor>
}
