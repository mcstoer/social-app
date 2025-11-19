import {useState} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {PROOFS_CONTROLLER_BLUESKY} from 'verus-typescript-primitives'

import {useVerusService} from '#/state/preferences'
import {usePostDeleteMutation} from '#/state/queries/post'
import {useLinkedVerusIDQuery} from '#/state/queries/verus/useLinkedVerusIdQuery'
import {useSession} from '#/state/session'
import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

enum Stages {
  ReviewRemoval = 'ReviewRemoval',
  Done = 'Done',
}

export function useRemoveVerusIdAccountLinkDialogControl() {
  return useGlobalDialogsControlContext().removeVerusIdAccountLinkDialogControl
}

export function RemoveVerusIDAccountLinkDialog() {
  const {_} = useLingui()
  const {control} = useRemoveVerusIdAccountLinkDialogControl()

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={_(msg`Remove Link to VerusID`)}
        style={web({maxWidth: 400})}>
        <Inner />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner() {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {verusIdInterface} = useVerusService()
  const control = Dialog.useDialogContext()
  const {mutateAsync: deletePost} = usePostDeleteMutation()

  const linkIdentifier = PROOFS_CONTROLLER_BLUESKY.vdxfid
  const {data: linkedVerusID, isPending} = useLinkedVerusIDQuery(
    linkIdentifier,
    currentAccount?.did,
    verusIdInterface,
  )

  const [stage, setStage] = useState(Stages.ReviewRemoval)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  const uiStrings = {
    ReviewRemoval: {
      title: _(msg`Remove link to VerusID`),
      message: linkedVerusID
        ? _(
            msg`The VerusID currently linked to this account is ${linkedVerusID.identity}. Removing this link will delete the post that verifies your identity.`,
          )
        : _(msg`There currently is no VerusID linked to this account.`),
    },
    Done: {
      title: _(msg`Link Removed`),
      message: _(
        msg`The link to VerusID ${linkedVerusID ? linkedVerusID.identity : ''} has been successfully removed from this account.`,
      ),
    },
  }

  const onRemoveLink = async () => {
    if (!linkedVerusID) {
      setError(_(msg`No VerusID link found to remove`))
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      await deletePost({uri: linkedVerusID.postUri})
      setStage(Stages.Done)
    } catch (e: any) {
      setError(_(msg`Failed to remove the VerusID link, please try again`))
    } finally {
      setIsProcessing(false)
    }
  }

  if (isPending) {
    return (
      <View style={[a.flex_1, a.py_4xl, a.align_center, a.justify_center]}>
        <Loader size="xl" />
      </View>
    )
  }

  return (
    <View style={[a.gap_xl]}>
      <View style={[a.gap_sm]}>
        <Text style={[a.font_bold, a.text_2xl]}>{uiStrings[stage].title}</Text>

        <Text style={[a.text_md, a.leading_snug]}>
          {uiStrings[stage].message}
        </Text>

        {error ? <Admonition type="error">{error}</Admonition> : null}
      </View>

      <View style={[a.gap_sm]}>
        {stage === Stages.ReviewRemoval ? (
          <>
            {linkedVerusID ? (
              <>
                <Button
                  label={_(msg`Delete Post and Remove Link`)}
                  variant="solid"
                  color="negative"
                  size="large"
                  onPress={onRemoveLink}
                  disabled={isProcessing}>
                  <ButtonText>
                    <Trans>Remove Link</Trans>
                  </ButtonText>
                </Button>
              </>
            ) : (
              <Button
                label={_(msg`Close`)}
                variant="solid"
                color="primary"
                size="large"
                onPress={() => control.close()}>
                <ButtonText>
                  <Trans>Close</Trans>
                </ButtonText>
              </Button>
            )}
          </>
        ) : stage === Stages.Done ? (
          <Button
            label={_(msg`Done`)}
            variant="solid"
            color="primary"
            size="large"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Done</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  )
}
