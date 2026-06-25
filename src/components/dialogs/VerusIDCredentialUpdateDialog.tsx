import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  Credential,
  DATA_TYPE_OBJECT_CREDENTIAL,
  IDENTITY_CREDENTIAL,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
} from 'verus-typescript-primitives'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {createAndSignGenericRequest} from '#/lib/verus/requests/genericRequest'
import {
  generateIdentityUpdateRequestOrdinals,
  processIdentityUpdateResponse,
} from '#/lib/verus/requests/identityUpdate'
import {logger} from '#/logger'
import {useVerusService} from '#/state/preferences/verus-service'
import {useSigningAddressQuery} from '#/state/queries/verus/useSigningServiceInfoQuery'
import {useVerusIdRequestQuery} from '#/state/queries/verus/useVerusIdRequestQuery'
import {useSession} from '#/state/session'
import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {QrCodeInner} from '#/components/StarterPack/QrCode'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'

enum Stages {
  UpdateCredentials = 'UpdateCredentials',
  AwaitingResponse = 'AwaitingResponse',
  Done = 'Done',
}

export function useVerusIdCredentialUpdateDialogControl() {
  return useGlobalDialogsControlContext().verusIdCredentialUpdateDialogControl
}

export function VerusIDCredentialUpdateDialog() {
  const {t: l} = useLingui()
  const credentialUpdateControl = useVerusIdCredentialUpdateDialogControl()
  const passedOnClose = credentialUpdateControl.value?.onClose

  const onClose = () => {
    credentialUpdateControl.clear()
    passedOnClose?.()
  }

  return (
    <Dialog.Outer control={credentialUpdateControl.control} onClose={onClose}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={l`Update VerusID Sign in Credentials`}
        style={web({maxWidth: 400})}>
        <Inner initialPassword={credentialUpdateControl.value?.password} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({initialPassword}: {initialPassword?: string}) {
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const control = Dialog.useDialogContext()
  const {verusIdInterface} = useVerusService()

  const [stage, setStage] = useState(Stages.UpdateCredentials)
  const [isProcessing, setIsProcessing] = useState(false)
  const [name, setName] = useState(
    currentAccount?.type === 'vsky' ? currentAccount.name + '@' : '',
  )
  const [email, setEmail] = useState(currentAccount?.email || '')
  const [password, setPassword] = useState(initialPassword || '')
  const [error, setError] = useState('')
  const [deeplinkUri, setDeeplinkUri] = useState('')
  const requestIdRef = useRef<string>('')

  const {data: signingServiceInfo} = useSigningAddressQuery()

  const {
    data: requestResponse,
    error: requestError,
    isError: isRequestError,
  } = useVerusIdRequestQuery({
    // The refs update correctly in this case.
    // eslint-disable-next-line react-hooks/refs
    requestId: requestIdRef.current,
    // eslint-disable-next-line react-hooks/refs
    enabled: stage === Stages.AwaitingResponse && !!requestIdRef.current,
  })

  const uiStrings = {
    UpdateCredentials: {
      title:
        currentAccount?.type === 'vsky'
          ? l`Update VerusID sign in`
          : l`Save sign in with VerusID`,
      message:
        currentAccount?.type === 'vsky'
          ? l`Update the sign in credentials stored in your VerusID.`
          : l`Add your sign in credentials to your VerusID for seamless logins.`,
    },
    AwaitingResponse: {
      title: l`Awaiting confirmation`,
      message: l`Scan the QR code below or press Open Verus Wallet to confirm the update.`,
    },
    Done: {
      title: l`Update confirmed`,
      message: l`Your VerusID sign in credentials update has been confirmed and will be applied soon.`,
    },
  }

  // Handle the credential update response
  useEffect(() => {
    if (requestResponse) {
      try {
        const txid = processIdentityUpdateResponse(requestResponse)

        if (txid) {
          // Works in this case because the re-render shows the next stage
          // and no useEffect has it as a dependency.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStage(Stages.Done)
          setIsProcessing(false)
          logger.debug('Successfully updated VerusSky credentials')
        } else {
          setError(
            l`No transaction ID was found in the credential update response.`,
          )
        }
      } catch (e) {
        setError(l`Failed to process the credential update response.`)
      }
    }
  }, [l, requestResponse])

  // Handle the errors for the credential update
  useEffect(() => {
    if (isRequestError) {
      const errMsg = requestError?.toString() || l`Failed to update credentials`
      logger.warn('Error while checking for credential update response', {
        error: errMsg,
      })
      if (isNetworkError(requestError)) {
        // Works in this case because the re-render shows the error and no useEffect
        // has it as a dependency.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(
          l`Unable to contact the service. Please check your Internet connection.`,
        )
      } else {
        setError(cleanError(errMsg))
      }
      setStage(Stages.UpdateCredentials)
      setIsProcessing(false)
    }
  }, [isRequestError, requestError, l])

  const onUpdateCredentials = async () => {
    if (!name.trim()) {
      setError(l`Please enter your VerusID name`)
      return
    }

    if (!email.trim()) {
      setError(l`Please enter your email`)
      return
    }

    if (!password.trim()) {
      setError(l`Please enter your password`)
      return
    }

    if (!signingServiceInfo?.signingAddress) {
      setError(l`Unable to get the signing service identity address`)
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      const identityJSON = {
        // The request does not allow a name with an @ suffix.
        name: name.replace(/@$/, ''),
        contentmultimap: {
          [IDENTITY_CREDENTIAL.vdxfid]: [
            {
              [DATA_TYPE_OBJECT_CREDENTIAL.vdxfid]: {
                version: Credential.VERSION_CURRENT.toNumber(),
                credentialkey: IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid,
                credential: [email, password],
                scopes: [signingServiceInfo.signingAddress],
              },
            },
          ],
        },
      }

      const ordinals = generateIdentityUpdateRequestOrdinals({
        identityJSON,
      })

      if (IS_WEB) {
        const signedRequest = await createAndSignGenericRequest(
          verusIdInterface,
          ordinals,
        )

        const requestIdString = signedRequest.requestID!.toAddress()
        setDeeplinkUri(signedRequest.toWalletDeeplinkUri())

        requestIdRef.current = requestIdString
        setStage(Stages.AwaitingResponse)
      } else if (IS_NATIVE) {
        // Mobile implementation will be different
        // This is a placeholder for the actual implementation
        setError(l`Mobile support coming soon`)
        setIsProcessing(false)
      }
    } catch (e: unknown) {
      const errMsg =
        e instanceof Error ? e.toString() : `Unable to contact the service`
      logger.warn('Failed to update Verus ID credentials', {error: e})
      if (isNetworkError(e)) {
        setError(
          l`Unable to contact the service. Please check your Internet connection.`,
        )
      } else {
        setError(cleanError(errMsg))
      }
      setIsProcessing(false)
    }
    setIsProcessing(false)
  }

  const onOpenDeeplink = () => {
    if (deeplinkUri) {
      window.location.href = deeplinkUri
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

      {stage === Stages.UpdateCredentials ? (
        <View style={[a.gap_md]}>
          <View>
            <TextField.LabelText>
              <Trans>VerusID Name</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`VerusID Name`}
                placeholder={l`Alice@`}
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>
              <Trans>Email</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`Email`}
                placeholder={l`alice@example.com`}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>
              <Trans>Password</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`Password`}
                placeholder={l`At least 8 characters`}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </TextField.Root>
          </View>
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

      <View style={[a.gap_sm]}>
        {stage === Stages.UpdateCredentials ? (
          <>
            <Button
              label={l`Update credentials`}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={() => void onUpdateCredentials()}>
              <ButtonText>
                <Trans>Update credentials</Trans>
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
          <>
            <Button
              label={l`Open credential update deeplink`}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={onOpenDeeplink}>
              <ButtonText>
                <Trans>Open Verus Wallet</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
          </>
        ) : stage === Stages.Done ? (
          <Button
            label={l`Close`}
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
