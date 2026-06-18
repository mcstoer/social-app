import {type SaplingPaymentAddress} from 'verus-typescript-primitives'

import {type PersistedAccount} from '#/state/persisted'
import {type Metrics} from '#/analytics/metrics'

export type SessionAccount = PersistedAccount

export type SessionStateContext = {
  accounts: SessionAccount[]
  currentAccount: SessionAccount | undefined
  hasSession: boolean
}

export type SessionApiContext = {
  createAccount: (
    props: {
      service: string
      email: string
      password: string
      handle: string
      birthDate: Date
      inviteCode?: string
      verificationPhone?: string
      verificationCode?: string
    },
    metrics: Metrics['account:create:success'],
  ) => Promise<void>
  login: (
    props: {
      service: string
      identifier: string
      password: string
      authFactorToken?: string | undefined
      vskySession?: VskySession
    },
    logContext: Metrics['account:loggedIn']['logContext'],
  ) => Promise<void>
  logoutCurrentAccount: (
    logContext: Metrics['account:loggedOut']['logContext'],
  ) => void
  logoutEveryAccount: (
    logContext: Metrics['account:loggedOut']['logContext'],
  ) => void
  resumeSession: (
    account: SessionAccount,
    isSwitchingAccounts?: boolean,
  ) => Promise<void>
  removeAccount: (account: SessionAccount) => void
  /**
   * Calls `getSession` and updates select fields on the current account and
   * `BskyAgent`. This is an alternative to `resumeSession`, which updates
   * current account/agent using the `persistSessionHandler`, but is more load
   * bearing. This patches in updates without causing any side effects via
   * `persistSessionHandler`.
   */
  partialRefreshSession: () => Promise<void>
  /**
   * Updates the current account's VerusSky encryption settings to allow for
   * immediate usage in encryption scenarios and dialogs.
   */
  updateVskyEncryption: (update: VskyEncryptionUpdate) => void
}

export type VskySession = {
  auth: string
  id: string
  name: string
  encryption?: VskyEncryption
}

export type VskyEncryption = {
  storeEncryptionKeys: boolean
  hasBeenAskedToStoreKeys?: boolean
  encryptionKey?: SaplingPaymentAddress
  decryptionKey?: Buffer
}

export type VskyEncryptionUpdate = Partial<VskyEncryption>
