import {VerusZSupportError} from 'veruszsupportlib'

export {VerusZSupportError, type VerusZSupportErrorKind} from 'veruszsupportlib'

export function isVerusCryptoError(e: unknown): e is VerusZSupportError {
  return e instanceof VerusZSupportError
}
