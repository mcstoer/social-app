/*
 * TODO: Update when the web extension is turned into a library.
 */

export type {
  ChannelKeys,
  DecryptParams,
  DerivationKeys,
  EncryptedPayload,
  EncryptParams,
  VerusCryptoApi,
} from './crypto.types'

import {type VerusCryptoApi} from './crypto.types'

export function getVerusCrypto(): Promise<VerusCryptoApi> {
  return Promise.reject(
    new Error('Verus decryption not yet supported on native'),
  )
}
