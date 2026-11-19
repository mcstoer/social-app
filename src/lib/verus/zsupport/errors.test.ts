import {describe, expect, it} from '@jest/globals'

import {toVerusCryptoError, VerusCryptoError} from './errors'

describe('toVerusCryptoError', () => {
  it('wraps a thrown string, as WASM throws', () => {
    const error = toVerusCryptoError("Must provide 'seed' or 'spendingKey'")

    expect(error).toBeInstanceOf(VerusCryptoError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe("Must provide 'seed' or 'spendingKey'")
    expect(error.cause).toBe("Must provide 'seed' or 'spendingKey'")
  })

  it('wraps an Error and keeps it as the cause', () => {
    const original = new Error('hdIndex must be an integer')
    const error = toVerusCryptoError(original)

    expect(error.message).toBe('hdIndex must be an integer')
    expect(error.cause).toBe(original)
  })

  it('returns a VerusCryptoError unchanged', () => {
    const original = new VerusCryptoError('already wrapped')

    expect(toVerusCryptoError(original)).toBe(original)
  })
})
