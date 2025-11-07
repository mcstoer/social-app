import {useState} from 'react'
import {View} from 'react-native'
import {RichText} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useQueryClient} from '@tanstack/react-query'
import {nanoid} from 'nanoid/non-secure'
import {PROOFS_CONTROLLER_BLUESKY} from 'verus-typescript-primitives'

import * as apilib from '#/lib/api/index'
import {shortenLinks} from '#/lib/strings/rich-text-manip'
import {usePostDeleteMutation} from '#/state/queries/post'
import {createPostgateRecord} from '#/state/queries/postgate/util'
import {useLinkedVerusIDQuery} from '#/state/queries/verus/useLinkedVerusIdQuery'
import {useAgent, useSession, useSessionVskyApi} from '#/state/session'
import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

enum Stages {
  PreparingLinking = 'PreparingLinking',
  SigningLinking = 'SigningLinking',
  Done = 'Done',
}

export function useVerusIdAccountLinkingDialogControl() {
  return useGlobalDialogsControlContext().verusIdAccountLinkingDialogControl
}

export function VerusIDAccountLinkingDialog() {
  const {_} = useLingui()
  const {control} = useVerusIdAccountLinkingDialogControl()

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={_(msg`Link VerusID to Profile`)}
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
  const {verusIdInterface} = useSessionVskyApi()
  const control = Dialog.useDialogContext()
  const {mutateAsync: deletePost} = usePostDeleteMutation()
  const agent = useAgent()
  const queryClient = useQueryClient()

  const linkIdentifier = PROOFS_CONTROLLER_BLUESKY.vdxfid
  const {data: linkedVerusID, isPending} = useLinkedVerusIDQuery(
    linkIdentifier,
    currentAccount?.did,
    verusIdInterface,
  )

  const [stage, setStage] = useState(Stages.PreparingLinking)
  const [isProcessing, setIsProcessing] = useState(false)
  const [name, setName] = useState(
    currentAccount?.type === 'vsky' ? currentAccount.name + '@' : '',
  )
  const [detailsToSign, setDetailsToSign] = useState('')
  const [signature, setSignature] = useState('')
  const [error, setError] = useState('')

  const uiStrings = {
    PreparingLinking: {
      title: linkedVerusID
        ? _(msg`Update linked VerusID`)
        : _(msg`Link VerusID to account`),
      message: linkedVerusID
        ? _(
            msg`The VerusID currently linked to this account is ${linkedVerusID.identity}.`,
          )
        : _(msg`Link your VerusID to this account to verify your identity.`),
    },
    SigningLinking: {
      title: _(msg`Sign the linking details`),
      message: null, // Use specific formatting instead for this section to allow for bolding
    },
    Done: {
      title: _(msg`Linking complete`),
      message: _(
        msg`Your VerusID ${name} has been successfully linked to this account.`,
      ),
    },
  }

  const onPrepareLink = async () => {
    if (!name.trim()) {
      setError(_(msg`Please enter your VerusID name`))
      return
    }

    const handle = currentAccount?.handle

    if (!handle || !handle.trim()) {
      setError(_(msg`Cannot link account with no handle`))
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      const details = `${linkIdentifier} 1: controller of VerusID "${name}" controls ${handle}`
      setDetailsToSign(details)
      setStage(Stages.SigningLinking)
    } catch (e: any) {
      setError(_(msg`Failed to prepare linking details`))
    } finally {
      setIsProcessing(false)
    }
  }

  const onSubmitSignature = async () => {
    if (!signature.trim()) {
      setError(_(msg`Please enter the signature`))
      return
    }

    if (!verusIdInterface) {
      setError(_(msg`Unable to verify signature`))
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      const verified = await verusIdInterface.verifyMessage(
        name,
        signature,
        detailsToSign,
      )

      if (!verified) {
        setError(_(msg`Invalid signature, please try again`))
        setIsProcessing(false)
        return
      }
    } catch (e: any) {
      setIsProcessing(false)
      setError(_(msg`Failed to verify signature`))
    }

    try {
      const accountLink = `${detailsToSign}:${signature}`

      if (!currentAccount) throw new Error('Not signed in')

      // Delete the existing linking post if it exists
      if (linkedVerusID) {
        await deletePost({uri: linkedVerusID.postUri})
      }

      const richtext = new RichText({text: accountLink})

      // Create the linking post similar to the Composer
      await apilib.post(agent, queryClient, {
        thread: {
          posts: [
            {
              id: nanoid(),
              richtext,
              labels: [],
              embed: {quote: undefined, media: undefined, link: undefined},
              shortenedGraphemeLength: shortenLinks(richtext).graphemeLength,
            },
          ],
          postgate: createPostgateRecord({
            post: '',
            embeddingRules: [{$type: 'app.bsky.feed.postgate#disableRule'}],
          }),
          threadgate: [{type: 'nobody'}],
        },
      })

      setStage(Stages.Done)
    } catch (e: any) {
      setError(_(msg`Failed to create a post for linking the VerusID`))
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
          {stage === Stages.SigningLinking ? (
            <>
              <Trans>
                Copy the details below and sign them as a
                <Text style={[a.font_semi_bold]}> message </Text>
                with your VerusID {name}, then paste the signature.
              </Trans>
              {'\n'}
              <Trans>
                This will create a post linking your VerusID to this account.
              </Trans>
            </>
          ) : (
            uiStrings[stage].message
          )}
        </Text>

        {error ? <Admonition type="error">{error}</Admonition> : null}
      </View>

      {stage === Stages.PreparingLinking ? (
        <View style={[a.gap_md]}>
          <View>
            <TextField.LabelText>
              <Trans>VerusID Name</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`VerusID Name`)}
                placeholder={_(msg`Alice@`)}
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>
        </View>
      ) : stage === Stages.SigningLinking ? (
        <View style={[a.gap_md]}>
          <View>
            <TextField.LabelText>
              <Trans>Details to Sign</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`Details to Sign`)}
                value={detailsToSign}
                editable={false}
                multiline
                numberOfLines={4}
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>
              <Trans>Signature</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`Signature`)}
                placeholder={_(msg`Paste your signature here`)}
                value={signature}
                onChangeText={setSignature}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={4}
              />
            </TextField.Root>
          </View>
        </View>
      ) : null}

      <View style={[a.gap_sm]}>
        {stage === Stages.PreparingLinking ? (
          <>
            <Button
              label={_(msg`Prepare linking`)}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={onPrepareLink}>
              <ButtonText>
                <Trans>Continue</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
          </>
        ) : stage === Stages.SigningLinking ? (
          <>
            <Button
              label={_(msg`Submit Signature and Create Post`)}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={onSubmitSignature}>
              <ButtonText>
                <Trans>Submit Signature and Create Post</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
            <Button
              label={_(msg`Back`)}
              color="secondary"
              size="large"
              disabled={isProcessing}
              onPress={() => {
                setSignature('')
                setStage(Stages.PreparingLinking)
              }}>
              <ButtonText>
                <Trans>Back</Trans>
              </ButtonText>
            </Button>
          </>
        ) : stage === Stages.Done ? (
          <Button
            label={_(msg`Close`)}
            color="primary"
            size="large"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  )
}
