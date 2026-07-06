import {useLingui} from '@lingui/react/macro'

export function useEncryptionKeyDialogStrings() {
  const {t: l} = useLingui()
  return {
    saveBenefit: l`Saving your keys lets you use VerusSky privacy features right away each time you visit.`,
    trustWarning: l`Only do this on devices you trust. If your keys are stolen, your encrypted data is no longer private.`,
  }
}
