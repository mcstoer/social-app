import {SaplingPaymentAddress} from 'verus-typescript-primitives'

import {BSKY_SERVICE} from '#/lib/constants'
import * as persisted from '#/state/persisted'
import {createSessionBundleAndLogin, type OnSessionChange} from './session-core'
import {
  type SessionAccount,
  type VskyEncryption,
  type VskyEncryptionUpdate,
  type VskySession,
} from './types'

type VskyAccount = Extract<SessionAccount, {type: 'vsky'}>
type SavedEncryption = VskyAccount['encryption']
type VskyKeys = Pick<VskyEncryption, 'encryptionKey' | 'decryptionKey'>

type CachedKeys = {
  keys: VskyKeys
  /** The VerusID these keys belong to. */
  id: string
  /** The saved key strings these keys match, if they are saved. */
  savedAs?: string
}

/**
 * Stores the parsed VerusSky keys by DID. This is kept outside the session
 * bundle since the bundle is rebuilt on every sync and account switch.
 */
const keysByDid = new Map<string, CachedKeys>()

/**
 * Clears the keys for the given DID, or for every account if no DID is given.
 */
export function clearVskyKeys(did?: string) {
  if (did) {
    keysByDid.delete(did)
  } else {
    keysByDid.clear()
  }
}

/**
 * Gets the account's VerusSky encryption. Saved keys are used over the
 * in-memory ones so that keys saved in another tab replace this tab's.
 */
export function getVskyEncryption(
  account: SessionAccount | undefined,
): VskyEncryption | undefined {
  if (account?.type !== 'vsky') {
    return undefined
  }
  const saved = account.encryption
  const savedAs = toSavedAs(saved)
  let cached = keysByDid.get(account.did)
  if (cached && cached.id !== account.id) {
    // Clear the keys if another tab logged in with a different VerusID.
    keysByDid.delete(account.did)
    cached = undefined
  }
  if (savedAs && cached?.savedAs !== savedAs) {
    cached = {keys: parseSavedKeys(saved), id: account.id, savedAs}
    keysByDid.set(account.did, cached)
  }
  if (!saved && !cached) {
    return undefined
  }
  return {
    storeEncryptionKeys: saved?.storeEncryptionKeys ?? false,
    hasBeenAskedToStoreKeys: saved?.hasBeenAskedToStoreKeys,
    ...cached?.keys,
  }
}

/**
 * Updates the account's VerusSky encryption. The keys are only saved on the
 * account when the user has chosen to store them.
 */
export function applyVskyEncryptionUpdate(
  account: VskyAccount,
  update: VskyEncryptionUpdate,
): VskyAccount {
  const {encryptionKey, decryptionKey, ...flags}: VskyEncryption = {
    storeEncryptionKeys: false,
    ...getVskyEncryption(account),
    ...update,
  }
  const encryption: SavedEncryption = {
    storeEncryptionKeys: flags.storeEncryptionKeys,
    hasBeenAskedToStoreKeys: flags.hasBeenAskedToStoreKeys,
    ...(flags.storeEncryptionKeys
      ? {
          encryptionKey: encryptionKey?.toAddressString(),
          decryptionKey: decryptionKey?.toString('hex'),
        }
      : {}),
  }
  if (encryptionKey || decryptionKey) {
    keysByDid.set(account.did, {
      keys: {encryptionKey, decryptionKey},
      id: account.id,
      savedAs: toSavedAs(encryption),
    })
  }
  return {...account, encryption}
}

/** Logs in with a VerusID. VerusSky accounts always use the Bluesky service. */
export async function createVskySessionBundleAndLogin(
  {
    identifier,
    password,
    authFactorToken,
    vskySession,
  }: {
    identifier: string
    password: string
    authFactorToken?: string
    vskySession: VskySession
  },
  onSessionChange: OnSessionChange,
) {
  const {bundle, account} = await createSessionBundleAndLogin(
    {service: BSKY_SERVICE, identifier, password, authFactorToken},
    onSessionChange,
  )
  // Start clean, since the user may have logged in with a different VerusID.
  clearVskyKeys(account.did)
  const {encryption, ...vskyFields} = vskySession
  const vskyAccount: VskyAccount = {...account, type: 'vsky', ...vskyFields}
  if (!encryption) {
    return {bundle, account: vskyAccount}
  }

  // Preserve user's existing choice to store encryption keys if possible.
  const existing = persisted
    .get('session')
    .accounts.find(a => a.did === account.did)
  const existingEncryption =
    existing?.type === 'vsky' ? existing.encryption : undefined
  return {
    bundle,
    account: applyVskyEncryptionUpdate(vskyAccount, {
      ...encryption,
      storeEncryptionKeys:
        encryption.storeEncryptionKeys ||
        !!existingEncryption?.storeEncryptionKeys,
      hasBeenAskedToStoreKeys:
        encryption.hasBeenAskedToStoreKeys ||
        existingEncryption?.hasBeenAskedToStoreKeys,
    }),
  }
}

function toSavedAs(saved: SavedEncryption): string | undefined {
  return saved?.encryptionKey && saved?.decryptionKey
    ? `${saved.encryptionKey}:${saved.decryptionKey}`
    : undefined
}

function parseSavedKeys(saved: SavedEncryption): VskyKeys {
  return {
    encryptionKey: saved?.encryptionKey
      ? SaplingPaymentAddress.fromAddressString(saved.encryptionKey)
      : undefined,
    decryptionKey: saved?.decryptionKey
      ? Buffer.from(saved.decryptionKey, 'hex')
      : undefined,
  }
}
