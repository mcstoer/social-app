import {useEffect, useRef} from 'react'
import {PROOFS_CONTROLLER_BLUESKY} from 'verus-typescript-primitives'

import {logger} from '#/logger'
import {useGetLinkedVerusID} from '#/state/queries/verus/useLinkedVerusIdQuery'
import {useSession} from '#/state/session'
import {
  type PostLoginStep,
  usePostLoginSteps,
  usePostLoginStepsApi,
} from '#/state/shell/post-login-steps'
import {useRemoveVerusIdAccountLinkDialogControl} from '#/components/dialogs/RemoveVerusIDAccountLinkDialog'
import {useSaveEncryptionKeysDialogControl} from '#/components/dialogs/SaveEncryptionKeysDialog'
import {useVerusIdAccountLinkingDialogControl} from '#/components/dialogs/VerusIDAccountLinkingDialog'
import {useVerusIdCredentialUpdateDialogControl} from '#/components/dialogs/VerusIDCredentialUpdateDialog'

/**
 * Manager dialog for the post-login shell's queue, running the post-login dialogs
 * and clearing the queue when the session changes.
 */
export function PostLoginSteps() {
  const {hasSession, currentAccount} = useSession()
  const {ownerDid, steps} = usePostLoginSteps()
  const {claim, advance: advance, clear} = usePostLoginStepsApi()
  const updateVerusCredentialsControl =
    useVerusIdCredentialUpdateDialogControl()
  const removeVerusIdAccountLinkControl =
    useRemoveVerusIdAccountLinkDialogControl()
  const verusIdAccountLinkingDialogControl =
    useVerusIdAccountLinkingDialogControl()
  const saveEncryptionKeysControl = useSaveEncryptionKeysDialogControl()
  const getLinkedVerusId = useGetLinkedVerusID()

  // Guards against re-running the current step on unrelated re-renders.
  const startedStep = useRef<PostLoginStep | undefined>(undefined)

  const current: PostLoginStep | undefined = steps[0]

  useEffect(() => {
    if (!current) return

    if (!hasSession || !currentAccount) {
      clear()
      return
    }

    if (ownerDid === undefined) {
      // Bind the queue to the session it first runs under.
      // Updating the ownerDid triggers a re-render to process the step below.
      claim(currentAccount.did)
      return
    }

    if (ownerDid !== currentAccount.did) {
      clear()
      return
    }

    if (startedStep.current === current) return
    startedStep.current = current

    switch (current.type) {
      case 'update-verusid-credentials': {
        updateVerusCredentialsControl.open({
          password: current.password,
          onClose: advance,
        })
        break
      }
      case 'remove-verusid-account-link': {
        removeVerusIdAccountLinkControl.open({onClose: advance})
        break
      }
      case 'check-verusid-account-link': {
        if (currentAccount.type !== 'vsky') {
          advance()
          break
        }
        const identity = currentAccount.name + '@'
        getLinkedVerusId(PROOFS_CONTROLLER_BLUESKY.vdxfid, currentAccount.did)
          .then(linkedVerusID => {
            if (!linkedVerusID || linkedVerusID.identity !== identity) {
              verusIdAccountLinkingDialogControl.open({
                showSettingsMessage: true,
                onClose: advance,
              })
            } else {
              // Already linked, nothing to show for this step.
              advance()
            }
          })
          .catch(error => {
            logger.warn('Failed to fetch linked VerusID after login', {error})
            advance()
          })
        break
      }
      case 'save-encryption-keys': {
        if (
          currentAccount.type !== 'vsky' ||
          currentAccount.encryption?.hasBeenAskedToStoreKeys
        ) {
          advance()
          break
        }
        saveEncryptionKeysControl.open({onClose: advance})
        break
      }
    }
  }, [
    hasSession,
    currentAccount,
    ownerDid,
    current,
    claim,
    advance,
    clear,
    getLinkedVerusId,
    updateVerusCredentialsControl,
    removeVerusIdAccountLinkControl,
    verusIdAccountLinkingDialogControl,
    saveEncryptionKeysControl,
  ])

  return null
}
