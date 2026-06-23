import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type GenericRequest} from 'verus-typescript-primitives'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {generateEncryptionKeysRequestOrdinals} from '#/lib/verus/requests/encryptionKeys'
import {createAndSignGenericRequest} from '#/lib/verus/requests/genericRequest'
import {logger} from '#/logger'
import {useVerusService} from '#/state/preferences/verus-service'
import {useGetEncryptionKeysQuery} from '#/state/queries/verus/useGetEncryptionKeysQuery'
import {useSession, useSessionApi} from '#/state/session'
import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import * as Toggle from '#/components/forms/Toggle'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'
import {QrCodeInner} from '../StarterPack/QrCode'

enum Stages {
  Intro = 'Intro',
  AwaitingResponse = 'AwaitingResponse',
  Done = 'Done',
}

export function useGetVskyEncryptionKeysDialogControl() {
  return useGlobalDialogsControlContext().getVskyEncryptionKeysDialogControl
}

export function GetVskyEncryptionKeysDialog() {
  const {t: l} = useLingui()
  const getVskyEncryptionKeysControl = useGetVskyEncryptionKeysDialogControl()
  const passedOnClose = getVskyEncryptionKeysControl.value?.onClose

  const onClose = () => {
    getVskyEncryptionKeysControl.clear()
    passedOnClose?.()
  }

  return (
    <Dialog.Outer
      control={getVskyEncryptionKeysControl.control}
      onClose={onClose}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={l`Get Encryption Keys`}
        style={web({maxWidth: 400})}>
        <Inner />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner() {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {updateVskyEncryption} = useSessionApi()
  const control = Dialog.useDialogContext()
  const {verusIdInterface} = useVerusService()

  const [showAwaitingResponse, setShowAwaitingResponse] = useState(false)
  const [request, setRequest] = useState<GenericRequest | null>(null)
  const [ivk, setIvk] = useState<Buffer | null>(null)
  const [storeKeys, setStoreKeys] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [localError, setLocalError] = useState('')

  const {
    data: keys,
    error: requestError,
    isError,
  } = useGetEncryptionKeysQuery({
    request,
    ivk,
    enabled: showAwaitingResponse && !!request && !!ivk,
  })

  const stage = keys
    ? Stages.Done
    : showAwaitingResponse
      ? Stages.AwaitingResponse
      : Stages.Intro

  const deeplinkUri = request?.toWalletDeeplinkUri() ?? ''

  const error =
    localError ||
    (isError
      ? isNetworkError(requestError)
        ? l`Unable to contact the service. Please check your Internet connection.`
        : cleanError(
            requestError?.toString() || l`Failed to get encryption keys`,
          )
      : '')

  const uiStrings: Record<
    Stages,
    {title: string; message: string; details?: string[]}
  > = {
    Intro: {
      title: l`Get encryption keys`,
      message: l`Your encryption keys enable privacy features in VerusSky.`,
      details: [
        l`Saving your keys lets you use VerusSky privacy features right away each time you visit.`,
        l`Only do this on devices you trust. If your keys are stolen, your encrypted data is no longer private.`,
      ],
    },
    AwaitingResponse: {
      title: l`Awaiting confirmation`,
      message: l`Scan the QR code below or press Open Verus Wallet to get your keys.`,
    },
    Done: {
      title: l`Encryption keys retrieved`,
      message: l`Your encryption keys have been successfully retrieved! You can now use VerusSky's privacy features.`,
    },
  }

  const onGetKeys = async () => {
    if (IS_NATIVE) {
      setLocalError(l`Mobile support coming soon`)
      return
    }

    if (currentAccount?.type !== 'vsky') {
      setLocalError(
        l`You must be signed in with a VerusID to get encryption keys.`,
      )
      return
    }

    if (request && ivk && !isError) {
      setLocalError('')
      setShowAwaitingResponse(true)
      return
    }

    setIsProcessing(true)

    try {
      const {ordinals, ivk: newIvk} =
        await generateEncryptionKeysRequestOrdinals({
          identityAddress: currentAccount.id,
        })

      const signedRequest = await createAndSignGenericRequest(
        verusIdInterface,
        ordinals,
      )

      setLocalError('')
      setIvk(newIvk)
      setRequest(signedRequest)
      setShowAwaitingResponse(true)
    } catch (e: unknown) {
      const errMsg =
        e instanceof Error ? e.toString() : `Unable to contact the service`
      logger.warn('Failed to get encryption keys', {error: e})
      if (isNetworkError(e)) {
        setLocalError(
          l`Unable to contact the service. Please check your Internet connection.`,
        )
      } else {
        setLocalError(cleanError(errMsg))
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const onOpenDeeplink = () => {
    if (deeplinkUri) {
      window.location.href = deeplinkUri
    }
  }

  const onDone = () => {
    if (!keys) {
      control.close()
      return
    }
    const {encryptionKey, decryptionKey} = keys
    control.close(() => {
      updateVskyEncryption({
        encryptionKey,
        decryptionKey,
        storeEncryptionKeys: storeKeys,
        hasBeenAskedToStoreKeys: true,
      })
      logger.debug('Successfully retrieved VerusSky encryption keys')
    })
  }

  return (
    <View style={[a.gap_xl]}>
      <View style={[a.gap_sm]}>
        <Text style={[a.font_bold, a.text_2xl]}>{uiStrings[stage].title}</Text>

        <Text style={[a.text_md, a.leading_snug]}>
          {uiStrings[stage].message}
        </Text>

        {uiStrings[stage].details?.map(detail => (
          <Text key={detail} style={[a.text_md, a.leading_snug]}>
            {detail}
          </Text>
        ))}
      </View>

      {stage === Stages.Intro ? (
        <View style={[a.gap_md]}>
          <Toggle.Item
            label={l`Save these keys on this device`}
            name="saveEncryptionKeys"
            value={storeKeys}
            onChange={setStoreKeys}>
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              <Toggle.Platform />
              <Text style={[a.text_md]}>
                <Trans>Save these keys on this device</Trans>
              </Text>
            </View>
          </Toggle.Item>
        </View>
      ) : stage === Stages.AwaitingResponse ? (
        <>
          {deeplinkUri && (
            <View style={[a.align_center, a.py_lg]}>
              <QrCodeInner link={deeplinkUri} useBackupSVG={false} />
            </View>
          )}
        </>
      ) : null}

      {error ? <Admonition type="error">{error}</Admonition> : null}

      <View style={[a.gap_sm]}>
        {stage === Stages.Intro ? (
          <>
            <Button
              label={l`Get keys`}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={() => void onGetKeys()}>
              <ButtonText>
                <Trans>Get keys</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
            {IS_NATIVE && (
              <Button
                label={l`Cancel`}
                color="secondary"
                size="large"
                disabled={isProcessing}
                onPress={() => control.close()}>
                <ButtonText>
                  <Trans>Cancel</Trans>
                </ButtonText>
              </Button>
            )}
          </>
        ) : stage === Stages.AwaitingResponse ? (
          <Button
            label={l`Open encryption keys deeplink`}
            color="primary"
            size="large"
            disabled={isProcessing || !IS_WEB}
            onPress={onOpenDeeplink}>
            <ButtonText>
              <Trans>Open Verus Wallet</Trans>
            </ButtonText>
            {isProcessing && <ButtonIcon icon={Loader} />}
          </Button>
        ) : stage === Stages.Done ? (
          <Button
            label={l`Close`}
            color="primary"
            size="large"
            onPress={onDone}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>
    </View>
  )
}
