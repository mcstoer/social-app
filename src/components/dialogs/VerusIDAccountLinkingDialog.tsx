import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type VerusIdInterface} from 'verusid-ts-client'

import {cleanError} from '#/lib/strings/errors'
import {useProfileUpdateMutation} from '#/state/queries/profile'
import {useAgent, useSession} from '#/state/session'
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
  const {control, value} = useVerusIdAccountLinkingDialogControl()

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={_(msg`Link VerusID to Profile`)}
        style={web({maxWidth: 400})}>
        <Inner verusIdInterface={value?.verusIdInterface} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({verusIdInterface}: {verusIdInterface?: VerusIdInterface}) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const control = Dialog.useDialogContext()
  const {
    mutateAsync: updateProfileMutation,
    error: updateProfileError,
    isError: isUpdateProfileError,
  } = useProfileUpdateMutation()
  const agent = useAgent()

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
      title: _(msg`Link VerusID to Account`),
      message: _(
        msg`Link your VerusID to this account to verify your identity.`,
      ),
    },
    SigningLinking: {
      title: _(msg`Sign the Linking Details`),
      message: _(
        msg`Copy the details below and sign them as a message with your VerusID ${name}, then paste the signature.`,
      ),
    },
    Done: {
      title: _(msg`Linking Complete`),
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
      const details = `iBnLtVL69rXXZtjEVndYahV5EgKeWi4GS4 1: controller of VerusID "${name}" controls ${handle}`
      setDetailsToSign(details)
      setStage(Stages.SigningLinking)
    } catch (e: any) {
      setError(_(msg`Failed to prepare linking details`))
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (isUpdateProfileError) {
      setError(cleanError(updateProfileError))
    }
  }, [isUpdateProfileError, updateProfileError])

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
        setError(_(msg`Invalid signature. Please try again.`))
        setIsProcessing(false)
        return
      }
    } catch (e: any) {
      setIsProcessing(false)
      setError(_(msg`Failed to verify signature`))
    }

    try {
      const profileLink = `${detailsToSign}:${signature}`

      if (!currentAccount) throw new Error('Not signed in')
      const {data: profile} = await agent.getProfile({
        actor: currentAccount.did,
      })

      await updateProfileMutation({
        profile,
        updates: existing => ({
          ...existing,
          description: existing.description
            ? `${existing.description}\n\n${profileLink}`
            : `${profileLink}`,
        }),
      })
      setStage(Stages.Done)
    } catch (e: any) {
      setError(_(msg`Failed to update user profile`))
    } finally {
      setIsProcessing(false)
    }
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
              label={_(msg`Submit signature`)}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={onSubmitSignature}>
              <ButtonText>
                <Trans>Submit Signature</Trans>
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
