import {describe, expect, it} from '@jest/globals'
// eslint-disable-next-line import-x/no-nodejs-modules
import {Buffer} from 'buffer'

import {assertU32, toArrayBuffer, toOptionalArrayBuffer} from './crypto.shared'
import {VerusCryptoError} from './errors'

describe('assertU32', () => {
  it('allows undefined', () => {
    expect(() => assertU32(undefined)).not.toThrow()
  })

  it('allows an integer within range', () => {
    expect(() => assertU32(1000)).not.toThrow()
  })

  it('rejects a value that is not an integer', () => {
    expect(() => assertU32(1.5, 'hdIndex')).toThrow(
      new VerusCryptoError('hdIndex must be an integer from 0 to 4294967295'),
    )
  })

  it('rejects -1', () => {
    expect(() => assertU32(-1)).toThrow(VerusCryptoError)
  })

  it('rejects a value above the u32 max', () => {
    expect(() => assertU32(2 ** 32)).toThrow(VerusCryptoError)
  })
})

describe('toArrayBuffer', () => {
  it('copies only the bytes of a slice', () => {
    const parent = Buffer.from([1, 2, 3, 4, 5, 6])
    const slice = parent.subarray(2, 4)

    const result = toArrayBuffer(slice)

    expect(result.byteLength).toBe(2)
    expect([...new Uint8Array(result)]).toEqual([3, 4])
  })

  it('returns a copy and not the original', () => {
    const buf = Buffer.from([1, 2])

    const result = toArrayBuffer(buf)
    buf[0] = 9

    expect([...new Uint8Array(result)]).toEqual([1, 2])
  })
})

describe('toOptionalArrayBuffer', () => {
  it('converts null and undefined to undefined', () => {
    expect(toOptionalArrayBuffer(null)).toBeUndefined()
    expect(toOptionalArrayBuffer(undefined)).toBeUndefined()
  })

  it('converts Buffer', () => {
    const result = toOptionalArrayBuffer(Buffer.from([7, 8]))

    expect([...new Uint8Array(result!)]).toEqual([7, 8])
  })
})
