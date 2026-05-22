import {useCallback, useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {
  Credential,
  DATA_TYPE_OBJECT_CREDENTIAL,
  IDENTITY_CREDENTIAL,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  PROOFS_CONTROLLER_BLUESKY,
} from 'verus-typescript-primitives'

import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {createAndSignGenericRequest} from '#/lib/verus/requests/genericRequest'
import {
  generateIdentityUpdateRequestOrdinals,
  processIdentityUpdateResponse,
} from '#/lib/verus/requests/identityUpdate'
import {logger} from '#/logger'
import {useVerusService} from '#/state/preferences/verus-service'
import {useLinkedVerusIDQuery} from '#/state/queries/verus/useLinkedVerusIdQuery'
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
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'
import {QrCodeInner} from '../StarterPack/QrCode'

enum Stages {
  UpdateCredentials = 'UpdateCredentials',
  AwaitingResponse = 'AwaitingResponse',
  Done = 'Done',
}

export function useVerusIdCredentialUpdateDialogControl() {
  return useGlobalDialogsControlContext().verusIdCredentialUpdateDialogControl
}

export function VerusIDCredentialUpdateDialog() {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const control = useVerusIdCredentialUpdateDialogControl()
  const accountLinkingControl =
    useGlobalDialogsControlContext().verusIdAccountLinkingDialogControl
  const removeAccountLinkControl =
    useGlobalDialogsControlContext().removeVerusIdAccountLinkDialogControl
  const openRemoveAccountLink = control.value?.openRemoveAccountLinkDialog
  const checkVerusIDAccountLink =
    control.value?.checkVerusIDAccountLink ?? false
  const {data: linkedVerusID} = useLinkedVerusIDQuery(
    PROOFS_CONTROLLER_BLUESKY.vdxfid,
    currentAccount?.did,
    checkVerusIDAccountLink && control.control.isOpen,
  )

  const onClose = useCallback(async () => {
    control.clear()

    if (openRemoveAccountLink) {
      removeAccountLinkControl.open()
      return
    }

    if (!currentAccount || currentAccount.type !== 'vsky') {
      return
    }

    const identity = currentAccount.name + '@'

    if (
      checkVerusIDAccountLink &&
      (!linkedVerusID || linkedVerusID.identity !== identity)
    ) {
      accountLinkingControl.open({showSettingsMessage: true})
    }
  }, [
    control,
    openRemoveAccountLink,
    currentAccount,
    linkedVerusID,
    removeAccountLinkControl,
    accountLinkingControl,
    checkVerusIDAccountLink,
  ])

  return (
    <Dialog.Outer control={control.control} onClose={onClose}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={_(msg`Update VerusID Sign in Credentials`)}
        style={web({maxWidth: 400})}>
        <Inner initialPassword={control.value?.password} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({initialPassword}: {initialPassword?: string}) {
  const {_} = useLingui()
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
    requestId: requestIdRef.current,
    enabled: stage === Stages.AwaitingResponse && !!requestIdRef.current,
  })

  const uiStrings = {
    UpdateCredentials: {
      title:
        currentAccount?.type === 'vsky'
          ? _(msg`Update VerusID sign in`)
          : _(msg`Save sign in with VerusID`),
      message:
        currentAccount?.type === 'vsky'
          ? _(msg`Update the sign in credentials stored in your VerusID.`)
          : _(
              msg`Add your sign in credentials to your VerusID for seamless logins.`,
            ),
    },
    AwaitingResponse: {
      title: _(msg`Awaiting confirmation`),
      message: _(
        msg`Scan the QR code below or press Open Verus wallet to confirm the update.`,
      ),
    },
    Done: {
      title: _(msg`Update confirmed`),
      message: _(
        msg`Your VerusID sign in credentials update has been confirmed and will be applied soon.`,
      ),
    },
  }

  // Handle the credential update response
  useEffect(() => {
    if (requestResponse) {
      try {
        const txid = processIdentityUpdateResponse(requestResponse)

        if (txid) {
          setStage(Stages.Done)
          setIsProcessing(false)
          logger.debug('Successfully updated VerusSky credentials')
        } else {
          setError(
            _(
              msg`No transaction ID was found in the credentail update response.`,
            ),
          )
        }
      } catch (e) {
        setError(_(msg`Failed to process the credential update response.`))
      }
    }
  }, [_, requestResponse])

  // Handle the errors for the credential update
  useEffect(() => {
    if (isRequestError) {
      const errMsg =
        requestError?.toString() || _(msg`Failed to update credentials`)
      logger.warn('Error while checking for credential update response', {
        error: errMsg,
      })
      if (isNetworkError(requestError)) {
        setError(
          _(
            msg`Unable to contact the service. Please check your Internet connection.`,
          ),
        )
      } else {
        setError(cleanError(errMsg))
      }
      setStage(Stages.UpdateCredentials)
      setIsProcessing(false)
    }
  }, [isRequestError, requestError, _])

  const onUpdateCredentials = async () => {
    if (!name.trim()) {
      setError(_(msg`Please enter your VerusID name`))
      return
    }

    if (!email.trim()) {
      setError(_(msg`Please enter your email`))
      return
    }

    if (!password.trim()) {
      setError(_(msg`Please enter your password`))
      return
    }

    if (!signingServiceInfo?.signingAddress) {
      setError(_(msg`Unable to get the signing service identity address`))
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
        setError(_(msg`Mobile support coming soon`))
        setIsProcessing(false)
      }
    } catch (e: any) {
      const errMsg = e.toString()
      logger.warn('Failed to update Verus ID credentials', {error: e})
      if (isNetworkError(e)) {
        setError(
          _(
            msg`Unable to contact the service. Please check your Internet connection.`,
          ),
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
                label={_(msg`VerusID Name`)}
                placeholder={_(msg`Alice@`)}
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
                label={_(msg`Email`)}
                placeholder={_(msg`alice@example.com`)}
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
                label={_(msg`Password`)}
                placeholder={_(msg`At least 8 characters`)}
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
              label={_(msg`Update credentials`)}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={onUpdateCredentials}>
              <ButtonText>
                <Trans>Update credentials</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
            {IS_NATIVE && (
              <Button
                label={_(msg`Cancel`)}
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
              label={_(msg`Open credential update deeplink`)}
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
