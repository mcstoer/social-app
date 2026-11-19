/** Unified error type for all errors thrown by the zsupport library. */
export class VerusCryptoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'VerusCryptoError'
  }
}

/**
 * Normalizes anything thrown by zsupport (errors, strings, etc.) into a
 * VerusCryptoError.
 */
export function toVerusCryptoError(e: unknown): VerusCryptoError {
  if (e instanceof VerusCryptoError) {
    return e
  }
  const message = e instanceof Error ? e.message : String(e)
  return new VerusCryptoError(message, {cause: e})
}
