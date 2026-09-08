import {useState} from 'react'
import {View} from 'react-native'
import {RichText} from '@atproto/api'
import {Trans, useLingui} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {nanoid} from 'nanoid/non-secure'
import {
  type GenericRequest,
  PROOFS_CONTROLLER_BLUESKY,
} from 'verus-typescript-primitives'

import * as apilib from '#/lib/api/index'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {shortenLinks} from '#/lib/strings/rich-text-manip'
import {isIAddress, processIAddress} from '#/lib/verus/addresses'
import {generateAccountLinkingRequestOrdinals} from '#/lib/verus/requests/accountLinking'
import {createAndSignGenericRequest} from '#/lib/verus/requests/genericRequest'
import {logger} from '#/logger'
import {useVerusService} from '#/state/preferences'
import {usePostDeleteMutation} from '#/state/queries/post'
import {createPostgateRecord} from '#/state/queries/postgate/util'
import {useAccountLinkingResponseQuery} from '#/state/queries/verus/useAccountLinkingResponseQuery'
import {
  createLinkedVerusIDQueryKey,
  useLinkedVerusIDQuery,
} from '#/state/queries/verus/useLinkedVerusIdQuery'
import {useAgent, useSession} from '#/state/session'
import {useVerusActionsUnavailable} from '#/state/verus-service-status'
import {atoms as a, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import * as TextField from '#/components/forms/TextField'
import {
  ChevronBottom_Stroke2_Corner0_Rounded as ChevronBottomIcon,
  ChevronTop_Stroke2_Corner0_Rounded as ChevronTopIcon,
} from '#/components/icons/Chevron'
import {Loader} from '#/components/Loader'
import {QrCodeInner} from '#/components/StarterPack/QrCode'
import {Text} from '#/components/Typography'
import {DEFAULT_CHAIN, IS_NATIVE, IS_WEB} from '#/env'

enum Stages {
  Intro = 'Intro',
  AwaitingResponse = 'AwaitingResponse',
  ConfirmPost = 'ConfirmPost',
  Done = 'Done',
}

function normalizeVerusIdInput(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('@') || isIAddress(trimmed)) return trimmed
  return `${trimmed}@`
}

export function useVerusIdAccountLinkingDialogControl() {
  return useGlobalDialogsControlContext().verusIdAccountLinkingDialogControl
}

export function VerusIDAccountLinkingDialog() {
  const {t: l} = useLingui()
  const accountLinkControl = useVerusIdAccountLinkingDialogControl()
  const passedOnClose = accountLinkControl.value?.onClose

  const onClose = () => {
    accountLinkControl.clear()
    passedOnClose?.()
  }

  return (
    <Dialog.Outer control={accountLinkControl.control} onClose={onClose}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={l`Link VerusID to Profile`}
        style={web({maxWidth: 400})}>
        <Inner
          showSettingsMessage={accountLinkControl.value?.showSettingsMessage}
        />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({showSettingsMessage}: {showSettingsMessage?: boolean}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {verusIdInterface} = useVerusService()
  const control = Dialog.useDialogContext()
  const {mutateAsync: deletePost} = usePostDeleteMutation()
  const agent = useAgent()
  const queryClient = useQueryClient()

  const serviceStatusUnavailable = useVerusActionsUnavailable()

  const linkIdentifier = PROOFS_CONTROLLER_BLUESKY.vdxfid
  const {data: linkedVerusID, isPending} = useLinkedVerusIDQuery(
    linkIdentifier,
    currentAccount?.did,
  )

  const suggestedRfqn =
    currentAccount?.type === 'vsky' ? currentAccount.name + '@' : ''
  const [rfqn, setRfqn] = useState(suggestedRfqn)
  const [detailsToSign, setDetailsToSign] = useState('')
  const [request, setRequest] = useState<GenericRequest | null>(null)
  const [showAwaitingResponse, setShowAwaitingResponse] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRawPost, setShowRawPost] = useState(false)
  const [formError, setFormError] = useState('')

  const {
    data: linkingResponse,
    error: requestError,
    isError: isLinkingResponseError,
  } = useAccountLinkingResponseQuery({
    request,
    rfqn,
    detailsToSign,
    enabled: showAwaitingResponse && !!request,
  })

  // Structures how the post text appears. This and the structuring below in
  // `detailsToSign` together should match what `findVerusIdLink()` checks.
  const formatPostText = (signature: string) => `${detailsToSign}:${signature}`

  const createLinkingPostMutation = useMutation({
    mutationFn: async (signature: string) => {
      const accountLink = formatPostText(signature)

      if (!currentAccount) throw new Error('Not signed in')

      // Delete the existing linking post if it exists.
      if (linkedVerusID) {
        await deletePost({uri: linkedVerusID.postUri})
      }

      const richtext = new RichText({text: accountLink})

      // Create the linking post similar to the Composer.
      const postResult = await apilib.post(agent, queryClient, {
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

      // Optimistically set the linked VerusID query data to the new link.
      queryClient.setQueryData(
        createLinkedVerusIDQueryKey(currentAccount.did),
        {
          message: detailsToSign,
          identity: rfqn,
          signature,
          postUri: postResult.uris[0],
        },
      )
    },
    onSuccess: () => {
      // The linking check uses `search-posts`, so this helps update the linking in the client.
      void queryClient.invalidateQueries({
        queryKey: ['search-posts'],
      })
    },
    onError: (e: unknown) => {
      logger.warn('Failed to create the account linking post', {error: e})
    },
  })

  // Avoid using useState since some of the stages are driven by either
  // the response existing or the post working.
  const getStage = () => {
    if (createLinkingPostMutation.isSuccess) return Stages.Done
    if (linkingResponse) return Stages.ConfirmPost
    if (showAwaitingResponse) return Stages.AwaitingResponse
    return Stages.Intro
  }
  const stage = getStage()

  const onBack = () => {
    createLinkingPostMutation.reset()
    setRequest(null)
    setShowAwaitingResponse(false)
    setShowRawPost(false)
  }

  const deeplinkUri = request?.toWalletDeeplinkUri()

  const postText = linkingResponse
    ? formatPostText(linkingResponse.signature)
    : ''

  const getError = () => {
    if (formError) return formError
    if (isLinkingResponseError) {
      if (isNetworkError(requestError)) {
        return l`Unable to contact the service. Please check your Internet connection.`
      }
      return cleanError(
        requestError?.toString() || l`Failed to get the signature`,
      )
    }
    if (createLinkingPostMutation.isError) {
      return l`Failed to create a post for linking the VerusID. Please try again.`
    }
    return ''
  }
  const error = getError()

  const uiStrings: Record<
    Stages,
    {title: string; message: string; detail?: string}
  > = {
    Intro: {
      title: linkedVerusID
        ? l`Update linked VerusID`
        : l`Link VerusID to account`,
      message: linkedVerusID
        ? l`The VerusID currently linked to this account is ${linkedVerusID.identity}.`
        : l`Link your VerusID to this account to verify your identity.`,
    },
    AwaitingResponse: {
      title: l`Awaiting confirmation`,
      message: l`Scan the QR code below or press Open Verus Wallet to sign the linking details with your VerusID ${rfqn}.`,
    },
    ConfirmPost: {
      title: l`Confirm your VerusID link`,
      message: l`This will publish a public post on your Bluesky account proving that you control ${rfqn}.`,
      detail: l`Anyone can see it and it stays up until you remove or replace the link.`,
    },
    Done: {
      title: l`Linking complete`,
      message: l`Your VerusID ${rfqn} has been successfully linked to this account.`,
    },
  }

  const onContinue = async () => {
    if (IS_NATIVE) {
      setFormError(l`Mobile support coming soon`)
      return
    }

    if (serviceStatusUnavailable) {
      setFormError(
        l`Verus Service is currently unreachable. Please try again later.`,
      )
      return
    }

    const handle = currentAccount?.handle

    if (!handle || !handle.trim()) {
      setFormError(l`Unable to link account with no handle.`)
      return
    }

    const normalizedRfqn = normalizeVerusIdInput(rfqn)

    if (!normalizedRfqn) {
      setFormError(l`Please enter a valid VerusID.`)
      return
    }

    let identityAddress: string
    try {
      identityAddress = processIAddress(normalizedRfqn, DEFAULT_CHAIN)
    } catch {
      setFormError(l`Please enter a valid VerusID.`)
      return
    }

    setRfqn(normalizedRfqn)
    setIsProcessing(true)

    try {
      const details = `${linkIdentifier} 1: controller of VerusID '${normalizedRfqn}' controls ${handle}`
      const {ordinals} = generateAccountLinkingRequestOrdinals({
        identityAddress,
        detailsToSign: details,
      })

      const signedRequest = await createAndSignGenericRequest(
        verusIdInterface,
        ordinals,
      )

      setFormError('')
      setDetailsToSign(details)
      setRequest(signedRequest)
      setShowAwaitingResponse(true)
    } catch (e: unknown) {
      logger.warn('Failed to prepare the account linking request', {error: e})
      if (isNetworkError(e)) {
        setFormError(
          l`Unable to contact the service. Please check your Internet connection.`,
        )
      } else if (e instanceof Error) {
        setFormError(cleanError(e.toString()))
      } else {
        setFormError(
          l`Failed to prepare the linking request. Please try again.`,
        )
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const onOpenDeeplink = () => {
    if (!deeplinkUri) return

    if (IS_WEB) {
      window.location.href = deeplinkUri
    }

    if (IS_NATIVE) {
      // TODO: Stub for native.
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

        {uiStrings[stage].detail && (
          <Text style={[a.text_md, a.leading_snug]}>
            {uiStrings[stage].detail}
          </Text>
        )}

        {showSettingsMessage && stage === Stages.Intro && (
          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>You can do this later in Settings → Verus Services.</Trans>
          </Text>
        )}
      </View>

      {stage === Stages.Intro ? (
        <View style={[a.gap_md]}>
          <View>
            <TextField.LabelText>
              <Trans>VerusID</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={l`VerusID`}
                placeholder={l`Alice@`}
                defaultValue={rfqn}
                onChangeText={value => {
                  setRfqn(value)
                  if (formError) setFormError('')
                }}
                autoCapitalize="none"
                autoCorrect={false}
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
      ) : stage === Stages.ConfirmPost ? (
        <View style={[a.gap_md]}>
          {linkedVerusID && (
            <Admonition type="warning">
              <Trans>
                You already have {linkedVerusID.identity} linked to this
                account.
              </Trans>
            </Admonition>
          )}

          <View
            style={[a.border, t.atoms.border_contrast_low, {borderRadius: 18}]}>
            <Button
              label={
                showRawPost
                  ? l`Hide the raw post contents`
                  : l`Show the raw post contents`
              }
              color="secondary"
              variant="ghost"
              size="small"
              onPress={() => setShowRawPost(!showRawPost)}
              style={[a.justify_start, showRawPost && t.atoms.bg_contrast_25]}>
              <ButtonIcon
                icon={showRawPost ? ChevronTopIcon : ChevronBottomIcon}
              />
              <ButtonText>
                {showRawPost ? (
                  <Trans>Hide post contents</Trans>
                ) : (
                  <Trans>Show what will be posted</Trans>
                )}
              </ButtonText>
            </Button>

            {showRawPost && (
              <View style={[a.gap_sm, a.p_md]}>
                <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  <Trans>
                    The long text below includes a cryptographic signature,
                    which is not a secret.
                  </Trans>
                </Text>
                <View style={[a.p_md, a.rounded_sm, t.atoms.bg_contrast_25]}>
                  <Text selectable>{postText}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {error ? <Admonition type="error">{error}</Admonition> : null}

      <View style={[a.gap_sm]}>
        {stage === Stages.Intro ? (
          <>
            <Button
              label={l`Prepare linking`}
              color="primary"
              size="large"
              disabled={isProcessing}
              onPress={() => void onContinue()}>
              <ButtonText>
                <Trans>Continue</Trans>
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
              label={l`Open account linking deeplink`}
              color="primary"
              size="large"
              onPress={onOpenDeeplink}>
              <ButtonText>
                <Trans>Open Verus Wallet</Trans>
              </ButtonText>
            </Button>
            <Button
              label={l`Back`}
              color="secondary"
              size="large"
              onPress={onBack}>
              <ButtonText>
                <Trans>Back</Trans>
              </ButtonText>
            </Button>
          </>
        ) : stage === Stages.ConfirmPost ? (
          <>
            <Button
              label={
                createLinkingPostMutation.isError
                  ? l`Retry publishing the linking post`
                  : l`Publish the linking post`
              }
              color="primary"
              size="large"
              disabled={createLinkingPostMutation.isPending}
              onPress={() => {
                if (!linkingResponse) return
                createLinkingPostMutation.mutate(linkingResponse.signature)
              }}>
              <ButtonText>
                {createLinkingPostMutation.isError ? (
                  <Trans>Retry</Trans>
                ) : linkedVerusID ? (
                  <Trans>Replace link and publish</Trans>
                ) : (
                  <Trans>Publish and link VerusID</Trans>
                )}
              </ButtonText>
              {createLinkingPostMutation.isPending && (
                <ButtonIcon icon={Loader} />
              )}
            </Button>
            <Button
              label={l`Back`}
              color="secondary"
              size="large"
              disabled={createLinkingPostMutation.isPending}
              onPress={onBack}>
              <ButtonText>
                <Trans>Back</Trans>
              </ButtonText>
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
