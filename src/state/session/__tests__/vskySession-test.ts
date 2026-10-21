import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {SaplingPaymentAddress} from 'verus-typescript-primitives'

import {type SessionAccount} from '../types'
import {
  applyVskyEncryptionUpdate,
  clearVskyKeys,
  getVskyEncryption,
} from '../vskySession'

type MockChannel = {
  postMessage: jest.Mock<(data: unknown) => void>
  onmessage: (event: {data: unknown}) => void
}

/*
 * Tests run against the native stub of `#/lib/broadcast`, which does nothing.
 * Record the channel instead, so messages to and from other tabs can be
 * checked. The factory runs before this file's constants exist, so the
 * channels are kept on the class.
 */
jest.mock('#/lib/broadcast', () => ({
  __esModule: true,
  default: class MockBroadcastChannel {
    static channels: unknown[] = []
    postMessage = jest.fn()
    onmessage = () => {}
    constructor() {
      MockBroadcastChannel.channels.push(this)
    }
  },
}))

jest.mock('../session-core', () => ({
  createSessionBundleAndLogin: jest.fn(),
}))

jest.mock('#/state/persisted', () => ({
  get: () => ({accounts: []}),
}))

type VskyAccount = Extract<SessionAccount, {type: 'vsky'}>

const DID = 'did:plc:alice'

function makeAccount(overrides: Partial<VskyAccount> = {}): VskyAccount {
  return {
    type: 'vsky',
    service: 'https://bsky.social/',
    did: DID,
    handle: 'alice.test',
    auth: '',
    id: 'iVerusIdA',
    name: 'alice',
    ...overrides,
  }
}

function makeKeys(seed: number) {
  return {
    encryptionKey: new SaplingPaymentAddress({
      d: Buffer.alloc(11, seed),
      pkD: Buffer.alloc(32, seed),
    }),
    decryptionKey: Buffer.alloc(32, seed),
  }
}

function channel() {
  const {default: BroadcastChannel} = jest.requireMock<{
    default: {channels: MockChannel[]}
  }>('#/lib/broadcast')
  return BroadcastChannel.channels[0]
}

/** Delivers a message as if another tab had sent it. */
function receive(data: unknown) {
  channel().onmessage({data})
}

beforeEach(() => {
  clearVskyKeys()
  channel().postMessage.mockClear()
})

describe('applyVskyEncryptionUpdate', () => {
  it('keeps unsaved keys in memory only', () => {
    const keys = makeKeys(1)
    const account = applyVskyEncryptionUpdate(makeAccount(), keys)

    expect(account.encryption).toEqual({
      storeEncryptionKeys: false,
      hasBeenAskedToStoreKeys: undefined,
    })
    expect(getVskyEncryption(account)).toMatchObject(keys)
  })

  it('saves the keys as strings when the user stores them', () => {
    const keys = makeKeys(1)
    const account = applyVskyEncryptionUpdate(makeAccount(), {
      ...keys,
      storeEncryptionKeys: true,
    })

    expect(account.encryption).toEqual({
      storeEncryptionKeys: true,
      hasBeenAskedToStoreKeys: undefined,
      encryptionKey: keys.encryptionKey.toAddressString(),
      decryptionKey: keys.decryptionKey.toString('hex'),
    })
  })

  it('sends the keys to other tabs', () => {
    const keys = makeKeys(1)
    applyVskyEncryptionUpdate(makeAccount(), keys)

    expect(channel().postMessage).toHaveBeenCalledWith({
      type: 'set',
      did: DID,
      id: 'iVerusIdA',
      encryptionKey: keys.encryptionKey.toAddressString(),
      decryptionKey: keys.decryptionKey.toString('hex'),
      savedAs: undefined,
    })
  })
})

describe('getVskyEncryption', () => {
  it('returns nothing for Bluesky accounts', () => {
    const {type: _, ...bskyFields} = makeAccount()
    expect(getVskyEncryption({...bskyFields, type: 'bsky'})).toBe(undefined)
  })

  it('keeps keys separate for each VerusID on the same account', () => {
    const keysA = makeKeys(1)
    const keysB = makeKeys(2)
    const accountA = applyVskyEncryptionUpdate(makeAccount(), keysA)

    // Another tab logs in with VerusID B before this tab's account syncs.
    receive({
      type: 'set',
      did: DID,
      id: 'iVerusIdB',
      encryptionKey: keysB.encryptionKey.toAddressString(),
      decryptionKey: keysB.decryptionKey.toString('hex'),
    })

    expect(getVskyEncryption(accountA)).toMatchObject(keysA)
    expect(
      getVskyEncryption(makeAccount({id: 'iVerusIdB', encryption: undefined})),
    ).toMatchObject(keysB)
  })

  it('uses saved keys over the keys in memory', () => {
    const saved = makeKeys(2)
    applyVskyEncryptionUpdate(makeAccount(), makeKeys(1))

    // Another tab saved different keys, which reached this tab's storage.
    const account = makeAccount({
      encryption: {
        storeEncryptionKeys: true,
        encryptionKey: saved.encryptionKey.toAddressString(),
        decryptionKey: saved.decryptionKey.toString('hex'),
      },
    })

    expect(getVskyEncryption(account)).toMatchObject(saved)
  })
})

describe('clearVskyKeys', () => {
  it('clears the keys and tells other tabs', () => {
    const account = applyVskyEncryptionUpdate(makeAccount(), makeKeys(1))
    channel().postMessage.mockClear()

    clearVskyKeys(DID)

    expect(getVskyEncryption(account)?.encryptionKey).toBe(undefined)
    expect(channel().postMessage).toHaveBeenCalledWith({
      type: 'clear',
      did: DID,
    })
  })

  it('clears keys from another tab without sending them back', () => {
    const account = applyVskyEncryptionUpdate(makeAccount(), makeKeys(1))
    channel().postMessage.mockClear()

    receive({type: 'clear', did: DID})

    expect(getVskyEncryption(account)?.encryptionKey).toBe(undefined)
    expect(channel().postMessage).not.toHaveBeenCalled()
  })
})
