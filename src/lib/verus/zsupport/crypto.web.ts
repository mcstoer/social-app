/*
 * The Verus crypto primitives are provided by a browser extension that injects
 * a WASM-backed API onto `window.verusCrypto`. The extension dispatches a
 * `verusCryptoReady` event once its WASM module has finished initializing.
 *
 * This file is the single seam between the app and that global. Everything
 * else in the app should depend on `getVerusCrypto()` and the exported param
 * types, never on `window` directly, so that a future native implementation
 * (a bundled library) can be dropped in as `crypto.native.ts` without touching
 * any callers.
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

const READY_EVENT = 'verusCryptoReady'
const READY_TIMEOUT_MS = 1000

/*
 * The extension adds the api at window.verusCrypto.
 */
declare global {
  interface Window {
    verusCrypto?: VerusCryptoApi
  }
}

/*
 * The extension sends out a `verusCryptoReady` event once its WASM module has finished initializing.
 */
export function getVerusCrypto(): Promise<VerusCryptoApi> {
  if (window.verusCrypto) {
    return Promise.resolve(window.verusCrypto)
  }

  return new Promise<VerusCryptoApi>((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener(READY_EVENT, onReady)
      reject(new Error('Verus crypto extension not available'))
    }, READY_TIMEOUT_MS)

    function onReady() {
      clearTimeout(timer)
      if (window.verusCrypto) {
        resolve(window.verusCrypto)
      } else {
        reject(new Error('Verus crypto ready event fired without API'))
      }
    }

    window.addEventListener(READY_EVENT, onReady, {once: true})
  })
}
