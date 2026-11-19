// Buffer is needed for working with Verus-related libraries.
// eslint-disable-next-line import-x/no-nodejs-modules
import {type Buffer} from 'buffer'

import {type DerivationKeys} from './crypto.types'
import {toVerusCryptoError, VerusCryptoError} from './errors'

/**
 * The largest value Rust can hold in a u32, which is the upper limit for the
 * indexes we pass to the zsupport library.
 */
const MAX_U32 = 0xffff_ffff

/**
 * The DerivationKeys fields that the zsupport library takes as a u32, which we
 * check with assertU32 before they are passed to Rust.
 */
const U32_FIELDS = [
  'hdIndex',
  'encryptionIndex',
] as const satisfies readonly (keyof DerivationKeys)[]

/**
 * Wraps calling the zsupport library and converts the multiple types of errors
 * from synchronous calls into the VerusCryptoError.
 */
export function callZsupport<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    throw toVerusCryptoError(e)
  }
}

/**
 * Rust converts the JavaScript float to u32 unchecked, so we need to prevent
 * values from being passed that are out of range or not integers.
 *
 * @param field Name used in the error message.
 */
export function assertU32(value: number | undefined, field = 'Value') {
  if (value === undefined) return
  if (!Number.isInteger(value) || value < 0 || value > MAX_U32) {
    throw new VerusCryptoError(
      `${field} must be an integer from 0 to ${MAX_U32}`,
    )
  }
}

/**
 * Asserts each DerivationKeys field that the zsupport library takes as a u32,
 * so we catch bad indexes before they are passed to Rust.
 */
export function assertDerivationKeys(params: DerivationKeys) {
  for (const field of U32_FIELDS) {
    assertU32(params[field], field)
  }
}

/**
 * Creates an ArrayBuffer from a Buffer since the native zsupport library only
 * takes ArrayBuffers. A Buffer can be a slice of a larger ArrayBuffer, so we
 * copy only its bytes instead of passing buf.buffer.
 */
export function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return new Uint8Array(buf).buffer
}

/**
 * Converts an optional Buffer to an ArrayBuffer only when the buffer is
 * defined. The native zsupport library only takes undefined for a missing
 * value, so we turn null into undefined.
 */
export function toOptionalArrayBuffer(
  buf: Buffer | null | undefined,
): ArrayBuffer | undefined {
  return buf ? toArrayBuffer(buf) : undefined
}
