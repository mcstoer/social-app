// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {type Buffer} from 'buffer'

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

export interface VerusCryptoApi {
  version: string
  zGetEncryptionAddress: (params: DerivationKeys) => ChannelKeys
  encryptData: (params: EncryptParams) => EncryptedPayload
  decryptData: (params: DecryptParams) => Buffer
}
