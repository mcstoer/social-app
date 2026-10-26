import {useEffect, useRef, useState} from 'react'
import {Keyboard, Linking, type TextInput, View} from 'react-native'
import {LexAuthFactorError} from '@atproto/lex-password-session'
import {Trans, useLingui} from '@lingui/react/macro'
import {type GenericRequest} from 'verus-typescript-primitives'

import {
  BSKY_SERVICE,
  DEFAULT_SERVICE,
  HITSLOP_10,
  HITSLOP_20,
} from '#/lib/constants'
import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {isBlueskyHostedUrl, toNiceHostingUrl} from '#/lib/strings/url-helpers'
import {createAndSignGenericRequest} from '#/lib/verus/requests/genericRequest'
import {
  generateLoginRequestOrdinals,
  type LoginResponse,
  processLoginResponse,
} from '#/lib/verus/requests/login'
import {logger} from '#/logger'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useVerusService} from '#/state/preferences/verus-service'
import {
  type HostingProviderState,
  useHostingProvider,
} from '#/state/queries/pds-detection'
import {useVerusGetIdentity} from '#/state/queries/verus/useVerusGetIdentityQuery'
import {useVerusIdRequestQuery} from '#/state/queries/verus/useVerusIdRequestQuery'
import {useSession, useSessionApi} from '#/state/session'
import {type VskySession} from '#/state/session/types'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {
  type PostLoginStep,
  usePostLoginStepsApi,
} from '#/state/shell/post-login-steps'
import {atoms as a, native, tokens, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {At_Stroke2_Corner0_Rounded as AtIcon} from '#/components/icons/At'
import {TinyChevronBottom_Stroke2_Corner0_Rounded as TinyChevronIcon} from '#/components/icons/Chevron'
import {Envelope_Stroke2_Corner0_Rounded as EmailIcon} from '#/components/icons/Envelope'
import {Eye_Stroke2_Corner0_Rounded as EyeIcon} from '#/components/icons/Eye'
import {EyeSlash_Stroke2_Corner0_Rounded as EyeSlashIcon} from '#/components/icons/EyeSlash'
import {Lock_Stroke2_Corner0_Rounded as LockIcon} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as TicketIcon} from '#/components/icons/Ticket'
import {createStaticClick, InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {QrCodeInner} from '#/components/StarterPack/QrCode'
import {Text} from '#/components/Typography'
import {IS_IOS, IS_NATIVE, IS_WEB} from '#/env'
import {VERUSSKY_CONFIG} from '#/env/verussky'
import {type com} from '#/lexicons'
import {ConfirmHostingProviderDialog} from './components/ConfirmHostingProviderDialog'
import {HostingProviderDialog} from './components/HostingProviderDialog'
import {FormContainer} from './FormContainer'

type ServiceDescription = com.atproto.server.describeServer.$OutputBody

export const LoginForm = ({
  error,
  serviceUrl,
  serviceDescription,
  initialHandle,
  setError,
  setServiceUrl,
  onPressRetryConnect,
  onPressBack,
  onPressForgotPassword,
  onAttemptSuccess,
  onAttemptFailed,
  onPressCreateAccount,
}: {
  error: string
  serviceUrl: string
  serviceDescription: ServiceDescription | undefined
  initialHandle: string
  setError: (v: string) => void
  setServiceUrl: (v: string) => void
  onPressRetryConnect: () => void
  onPressBack: () => void
  onPressForgotPassword: () => void
  onAttemptSuccess: () => void
  onAttemptFailed: () => void
  onPressCreateAccount: () => void
}) => {
  const t = useTheme()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorField, setErrorField] = useState<
    'none' | 'identifier' | 'password' | '2fa'
  >('none')
  const [isVerusIdLogin, setIsVerusIdLogin] = useState(
    VERUSSKY_CONFIG.defaultLoginVerusid,
  )
  const [saveLoginWithVerusId, setSaveLoginWithVerusId] = useState(false)
  const [openRemoveVerusIdLinkDialog, setOpenRemoveVerusIdLinkDialog] =
    useState(false)
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] = useState(false)
  const [showResolveError, setShowResolveError] = useState(false)
  const [identifier, setIdentifier] = useState(initialHandle || '')
  const [password, setPassword] = useState('')
  const [identifierFocused, setIdentifierFocused] = useState(false)
  const [authFactorToken, setAuthFactorToken] = useState('')
  const identifierRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null)
  const hasFocusedOnce = useRef(false)
  const vskySessionValueRef = useRef<VskySession>({auth: '', id: '', name: ''})
  const verusIdLoginFailed = useRef(false)
  const [revealPassword, setRevealPassword] = useState(false)
  const {t: l} = useLingui()
  const {login} = useSessionApi()
  const {accounts} = useSession()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()
  const {initialize: startPostLoginSteps} = usePostLoginStepsApi()
  const serverInputControl = useDialogControl()
  const confirmHostingProviderControl = useDialogControl()
  const [pendingLogin, setPendingLogin] = useState<{
    service: string
    fullIdent: string
    password: string
  } | null>(null)
  const hostingProvider = useHostingProvider({
    identifier,
    defaultService: serviceUrl,
  })
  const {gtMobile} = useBreakpoints()
  const {verusIdInterface} = useVerusService()
  const getIdentity = useVerusGetIdentity()

  const [loginUri, setLoginUri] = useState('')
  const [loginId, setLoginId] = useState('')
  const loginRequestRef = useRef<GenericRequest | null>(null)
  const ivkRef = useRef<Buffer | null>(null)
  /**
   * The login request whose response was already handled. A refetch, such as
   * on window focus, can deliver the same response again.
   */
  const handledLoginRequestRef = useRef<GenericRequest | null>(null)

  const {data: verusIdLoginResult, error: verusIdLoginError} =
    useVerusIdRequestQuery({
      requestId: loginId,
      enabled: isVerusIdLogin,
    })

  /*
   * Surface an inline error on the username field only once detection has
   * settled on an unresolvable identifier and the user has moved on from the
   * field. Hidden while focused so we don't nag mid-type, and it clears
   * automatically when the identifier resolves or an override is set (both
   * move `state.status` away from 'unresolved').
   */
  const showUnresolvedError =
    hostingProvider.state.status === 'unresolved' && !identifierFocused

  /** Gets the VerusSky session from a verified VerusID login, if there is one. */
  const getVerifiedVskySession = () => {
    const vskySession = vskySessionValueRef.current
    return vskySession.id !== '' && vskySession.name !== ''
      ? vskySession
      : undefined
  }

  /**
   * Performs the actual login attempt against a resolved service. Reads the
   * 2FA token from the current form state, and manages `setIsProcessing`
   * itself: it stays processing on success (the app transitions away) and
   * clears it on any failure. The password is passed in, since a VerusID login
   * gets it from the VerusID instead of the form.
   */
  const attemptLogin = async (
    service: string,
    fullIdent: string,
    password: string,
  ) => {
    setIsProcessing(true)

    const vskySession = getVerifiedVskySession()

    try {
      // TODO remove double login
      await login(
        {
          service,
          identifier: fullIdent,
          password,
          authFactorToken: authFactorToken.trim(),
          vskySession,
        },
        'LoginForm',
      )
      onAttemptSuccess()
      setShowLoggedOut(false)
      setHasCheckedForStarterPack(true)
      void requestNotificationsPermission('Login')

      if (verusIdLoginFailed.current) {
        logger.debug(
          'Successfully logged in manually after VerusID login failed',
        )
      }

      const steps: PostLoginStep[] = []
      if (saveLoginWithVerusId) {
        steps.push({type: 'update-verusid-credentials', password})
        if (openRemoveVerusIdLinkDialog) {
          steps.push({type: 'remove-verusid-account-link'})
        }
      } else if (openRemoveVerusIdLinkDialog) {
        // Skip the linked VerusID check, since the user is removing the link.
        steps.push({type: 'remove-verusid-account-link'})
      } else if (vskySession) {
        steps.push({type: 'check-verusid-account-link'})
      }
      if (vskySession?.encryption) {
        steps.push({type: 'save-encryption-keys'})
      }
      if (steps.length) {
        startPostLoginSteps(steps)
      }
    } catch (err) {
      const errMsg = String(err)
      setIsProcessing(false)
      /*
       * `LexAuthFactorError` is what `PasswordSession.login` throws when the
       * server demands an email 2FA token.
       */
      if (err instanceof LexAuthFactorError) {
        setIsAuthFactorTokenNeeded(true)
      } else {
        onAttemptFailed()
        if (errMsg.includes('Token is invalid')) {
          logger.debug('Failed to login due to invalid 2fa token', {
            error: errMsg,
          })
          setError(l`Invalid 2FA confirmation code.`)
          setErrorField('2fa')
        } else if (
          errMsg.includes('Authentication Required') ||
          errMsg.includes('Invalid identifier or password')
        ) {
          logger.debug('Failed to login due to invalid credentials', {
            error: errMsg,
          })
          /*
           * Switch to the manual form when the VerusID's saved credentials are
           * wrong. Saving the login is preselected so that the manual sign in
           * updates them.
           */
          if (isVerusIdLogin) {
            verusIdLoginFailed.current = true
            setSaveLoginWithVerusId(true)
            setIsVerusIdLogin(false)
            // Clear the wrong credentials so they don't show in the form.
            setIdentifier('')
            setPassword('')
            setError(
              l`Unable to verify Bluesky credentials. Please sign in manually.`,
            )
          } else {
            setError(l`Incorrect username or password`)
          }
        } else if (isNetworkError(err)) {
          logger.warn('Failed to login due to network error', {error: errMsg})
          setError(
            l`Unable to contact your service. Please check your Internet connection.`,
          )
        } else {
          logger.warn('Failed to login', {error: errMsg})
          /* the error object, not its stringification: cleanError only
           * extracts the clean server message from a live LexError */
          setError(cleanError(err))
        }
      }
    }
  }

  /**
   * Logs in with the form's username and password, or with the given
   * credentials. A VerusID login passes its credentials in, since setting the
   * form state wouldn't be seen until the next render.
   */
  const onPressNext = async (credentials?: {
    identifier: string
    password: string
  }) => {
    if (isProcessing) return
    Keyboard.dismiss()
    setError('')
    setErrorField('none')
    setShowResolveError(false)

    const loginPassword = credentials?.password ?? password
    const normalizedIdentifier = (credentials?.identifier ?? identifier)
      .toLowerCase()
      .trim()

    if (!normalizedIdentifier) {
      setError(l`Please enter your username`)
      setErrorField('identifier')
      return
    }

    if (!loginPassword) {
      setError(l`Please enter your password`)
      setErrorField('password')
      return
    }

    setIsProcessing(true)

    // try to guess the handle if the user just gave their own username
    let fullIdent = normalizedIdentifier
    if (
      !normalizedIdentifier.includes('@') && // not an email
      !normalizedIdentifier.includes('.') && // not a domain
      !normalizedIdentifier.startsWith('did:') && // not a DID
      serviceDescription &&
      serviceDescription.availableUserDomains.length > 0
    ) {
      let matched = false
      for (const domain of serviceDescription.availableUserDomains) {
        if (fullIdent.endsWith(domain)) {
          matched = true
        }
      }
      if (!matched) {
        fullIdent = createFullHandle(
          normalizedIdentifier,
          serviceDescription.availableUserDomains[0],
        )
      }
    }

    /*
     * Skip the hosting provider check for a VerusID login, since it always
     * signs in at the Bluesky service. The confirmation would otherwise name a
     * server the password isn't sent to.
     */
    if (getVerifiedVskySession()) {
      await attemptLogin(BSKY_SERVICE, fullIdent, loginPassword)
      return
    }

    /*
     * Await autodetection against the current identifier before logging in.
     * If detection is still in flight this waits for it (bypassing the
     * debounce); otherwise it resolves near-instantly from cache. Falls back
     * to the default service on anything unresolvable, but a network error
     * throws - in that case we must NOT log in, since we can't be sure which
     * server to send the password to.
     */
    let resolved: Awaited<ReturnType<typeof hostingProvider.resolveService>>
    try {
      resolved = await hostingProvider.resolveService(normalizedIdentifier)
    } catch (err) {
      logger.debug('Failed to resolve hosting provider', {error: String(err)})
      setIsProcessing(false)
      setShowResolveError(true)
      return
    }
    const {service, did} = resolved

    /*
     * If detection landed on a non-Bluesky server, confirm before sending the
     * password, to guard against typosquatted handles capturing credentials. A
     * manual override is skipped: choosing a server by hand is explicit user
     * consent, so only auto-detected hosts need the guard. An identity the
     * user has signed into on this device before is also trusted: a
     * typosquatted handle would resolve to the attacker's different DID, so
     * DID membership in the account list is the correct skip condition
     * (handles and hosts are not stable keys - service URLs drift and pdsUrl
     * is often unset).
     */
    const isKnownAccount =
      did != null && accounts.some(account => account.did === did)
    const needsConfirmation =
      !isBlueskyHostedUrl(service) &&
      hostingProvider.state.status !== 'overridden' &&
      !isKnownAccount

    if (needsConfirmation) {
      setIsProcessing(false)
      setPendingLogin({service, fullIdent, password: loginPassword})
      confirmHostingProviderControl.open()
      return
    }

    await attemptLogin(service, fullIdent, loginPassword)
  }

  useEffect(() => {
    /*
     * Ignore this request once the user switches away or a new request
     * replaces it. Otherwise its late result would overwrite the newer state.
     */
    let isCancelled = false
    let isPending = false

    // Create the login request for the QR code and deeplink.
    const createAndSignLoginRequest = async () => {
      isPending = true
      setIsProcessing(true)
      setLoginUri('')
      // Stop polling the old request so its response isn't handled again.
      setLoginId('')
      try {
        const {ordinals, ivk} = await generateLoginRequestOrdinals()
        const signedRequest = await createAndSignGenericRequest(
          verusIdInterface,
          ordinals,
        )
        if (isCancelled) return

        loginRequestRef.current = signedRequest
        ivkRef.current = ivk
        setLoginId(signedRequest.requestID!.toAddress())
        setLoginUri(signedRequest.toWalletDeeplinkUri())
        setError('')
      } catch (err) {
        if (isCancelled) return
        logger.warn('Failed to create VerusID login request', {
          error: String(err),
        })
        setError(cleanError(err))
        setLoginId('')
        loginRequestRef.current = null
        ivkRef.current = null
      }
      isPending = false
      setIsProcessing(false)
    }

    if (isVerusIdLogin) {
      void createAndSignLoginRequest()
    }

    return () => {
      isCancelled = true
      // Turn the form back on, since the cancelled request won't.
      if (isPending) {
        setIsProcessing(false)
      }
    }
  }, [isVerusIdLogin, setError, verusIdInterface])

  // Log in once the VerusID login response arrives.
  useEffect(() => {
    if (!verusIdLoginResult || !loginRequestRef.current || !ivkRef.current) {
      return
    }
    const loginRequest = loginRequestRef.current
    const ivk = ivkRef.current
    if (handledLoginRequestRef.current === loginRequest) {
      return
    }
    handledLoginRequestRef.current = loginRequest
    // Stop if the user switched away or a new request replaced this one.
    const isCancelled = () => loginRequestRef.current !== loginRequest

    const handleLoginResponse = async () => {
      setIsProcessing(true)

      /*
       * Fail the whole login if the VerusID or its encryption keys can't be
       * verified. processLoginResponse throws when the keys are missing.
       */
      let result: LoginResponse
      try {
        result = await processLoginResponse(
          loginRequest,
          verusIdLoginResult,
          getIdentity,
          ivk,
        )
      } catch (err) {
        if (isCancelled()) {
          setIsProcessing(false)
          return
        }
        logger.warn('Failed to verify VerusID login response', {
          safeMessage: err,
        })
        clearVskySession()
        setError(
          l`Unable to verify the VerusID sign in. Please try again or sign in manually.`,
        )
        verusIdLoginFailed.current = true
        setIsVerusIdLogin(false)
        setIsProcessing(false)
        onAttemptFailed()
        return
      }
      if (isCancelled()) {
        setIsProcessing(false)
        return
      }

      /*
       * Keep the VerusSky session even when the saved credentials are missing.
       * The user can then update them after signing in manually.
       */
      vskySessionValueRef.current = {
        auth: '',
        id: result.identity.identityaddress || '',
        name: result.identity.name,
        encryption: {
          storeEncryptionKeys: false,
          encryptionKey: result.encryptionKey,
          decryptionKey: result.decryptionKey,
        },
      }

      if (!result.credentials) {
        const errMsg = result.credentialError ?? ''

        if (errMsg.includes('Missing username')) {
          setError(
            l`Missing username from VerusID sign in. Please sign in manually.`,
          )
        } else if (errMsg.includes('Missing password')) {
          setError(
            l`Missing password from VerusID sign in. Please sign in manually.`,
          )
        } else if (
          errMsg.includes('Invalid credential format') ||
          errMsg.includes('Invalid credentials') ||
          errMsg.includes('Missing sign in credentials') ||
          errMsg.includes('Missing plain login credential')
        ) {
          setError(
            l`Missing username and password from VerusID sign in. Please sign in manually.`,
          )
        }

        verusIdLoginFailed.current = true
        // Preselect saving so the manual sign in updates the saved credentials.
        setSaveLoginWithVerusId(true)
        setIsVerusIdLogin(false)
        setIsProcessing(false)
        onAttemptFailed()
        return
      }

      const credentials = {
        identifier: result.credentials.username,
        password: result.credentials.password,
      }
      // Set the form too, so a 2FA code submits these credentials.
      setIdentifier(credentials.identifier)
      setPassword(credentials.password)
      void onPressNext(credentials)
    }

    void handleLoginResponse()
    // Only run when the response arrives, not every time onPressNext changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [verusIdLoginResult])

  // Switch to the manual form when the VerusID login response can't be fetched.
  useEffect(() => {
    if (!verusIdLoginError) {
      return
    }

    const errMsg = verusIdLoginError.message
    logger.warn('Failed to fetch VerusID login response', {error: errMsg})

    if (errMsg.includes('Invalid VerusID request response')) {
      setError(l`Invalid login response. Please try again or sign in manually.`)
    } else if (errMsg.includes('Failed to fetch VerusID request response')) {
      setError(l`Unable to verify the signer of the login.`)
    } else {
      setError(cleanError(verusIdLoginError))
    }

    verusIdLoginFailed.current = true
    setSaveLoginWithVerusId(true)
    setIsVerusIdLogin(false)
    setIsProcessing(false)
    onAttemptFailed()
  }, [verusIdLoginError, l, setError, onAttemptFailed])

  /**
   * Clears the VerusID login when the hosting provider changes, since it was
   * for the old provider's account. Also called when a VerusID fails
   * verification, so an earlier VerusID's session isn't kept.
   */
  const clearVskySession = () => {
    vskySessionValueRef.current = {auth: '', id: '', name: ''}
    verusIdLoginFailed.current = false
  }

  /**
   * Opens the login deeplink. On web it opens in the same tab so that the
   * navigation stack is kept.
   */
  const startVskyLogin = () => {
    // Wait for the new request, since an empty link would reload the page.
    if (isProcessing || !loginUri) return
    if (IS_WEB) {
      window.location.href = loginUri
    } else {
      void Linking.openURL(loginUri)
    }
  }

  /*
   * Once the VerusID is verified, "Sign in" submits its credentials instead of
   * opening the deeplink again. This retries a login that failed after
   * verification, or submits a 2FA code.
   */
  const isVskyDeeplinkButton =
    isVerusIdLogin && !isAuthFactorTokenNeeded && !getVerifiedVskySession()

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <HostingProviderDialog
        control={serverInputControl}
        currentOverride={
          hostingProvider.state.status === 'overridden'
            ? hostingProvider.state.pdsUrl
            : null
        }
        isEmail={hostingProvider.state.status === 'email'}
        onSelectManual={url => {
          hostingProvider.override(url)
          setServiceUrl(url)
          clearVskySession()
        }}
        onSelectAutomatic={() => {
          hostingProvider.clearOverride()
          setServiceUrl(DEFAULT_SERVICE)
          clearVskySession()
        }}
      />
      <ConfirmHostingProviderDialog
        control={confirmHostingProviderControl}
        host={toNiceHostingUrl(pendingLogin?.service ?? '')}
        identifier={pendingLogin?.fullIdent ?? ''}
        passwordLength={pendingLogin?.password.length ?? 0}
        onConfirm={() => {
          if (pendingLogin) {
            void attemptLogin(
              pendingLogin.service,
              pendingLogin.fullIdent,
              pendingLogin.password,
            )
          }
        }}
      />
      {!isVerusIdLogin ? (
        <>
          <View>
            <TextField.LabelText>
              <Trans>Username or email</Trans>
            </TextField.LabelText>
            <TextField.Root
              isInvalid={errorField === 'identifier' || showUnresolvedError}>
              <TextField.Icon
                icon={
                  hostingProvider.state.status === 'email' ? EmailIcon : AtIcon
                }
              />
              <TextField.Input
                testID="loginUsernameInput"
                inputRef={identifierRef}
                label={l`Username or email address`}
                placeholder={null}
                autoCapitalize="none"
                autoFocus={!IS_IOS && !initialHandle}
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                textContentType="username"
                value={identifier}
                onChangeText={v => {
                  setIdentifier(v)
                  if (errorField) setErrorField('none')
                  if (showResolveError) setShowResolveError(false)
                }}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                onSubmitEditing={() => {
                  passwordRef.current?.focus()
                }}
                blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
                editable={!isProcessing}
                accessibilityHint={l`Enter the username or email address you used when you created your account`}
              />
            </TextField.Root>
            {showUnresolvedError && (
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  a.mt_sm,
                  {color: t.palette.negative_500},
                ]}>
                <Trans>
                  We couldn't find an account with that username. Please check
                  that you've typed it correctly, or{' '}
                  <InlineLinkText
                    label={l`set your hosting provider manually`}
                    style={[a.text_sm, a.leading_snug]}
                    {...createStaticClick(() => serverInputControl.open())}>
                    set your hosting provider manually
                  </InlineLinkText>
                  .
                </Trans>
              </Text>
            )}
          </View>

          <View>
            <TextField.LabelText>
              <Trans>Password</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={errorField === 'password'}>
              <TextField.Icon icon={LockIcon} />
              <TextField.Input
                testID="loginPasswordInput"
                inputRef={passwordRef}
                label={l`Password`}
                placeholder={null}
                autoCapitalize="none"
                autoFocus={!IS_IOS && !!initialHandle}
                autoCorrect={false}
                autoComplete="current-password"
                returnKeyType="done"
                enablesReturnKeyAutomatically={true}
                secureTextEntry={!revealPassword}
                value={password}
                onChangeText={v => {
                  setPassword(v)
                  if (errorField) setErrorField('none')
                }}
                onSubmitEditing={() => void onPressNext()}
                blurOnSubmit={false} // HACK: https://github.com/facebook/react-native/issues/21911#issuecomment-558343069 Keyboard blur behavior is now handled in onSubmitEditing
                editable={!isProcessing}
                accessibilityHint={l`Enter your password`}
                onLayout={
                  IS_IOS
                    ? () => {
                        if (hasFocusedOnce.current) return
                        hasFocusedOnce.current = true
                        // kinda dumb, but if we use `autoFocus` to focus an
                        // input, it happens before the password input gets
                        // rendered. this breaks the password autofill on iOS (it
                        // only does the username part). delaying it until both
                        // inputs are rendered fixes the autofill. when a handle is
                        // prefilled we focus the password field directly so the
                        // user can go straight to typing it -sfn
                        if (initialHandle) {
                          passwordRef.current?.focus()
                        } else {
                          identifierRef.current?.focus()
                        }
                      }
                    : undefined
                }
                hitSlop={{...HITSLOP_20, right: 0}}
              />
              <RevealPasswordButton
                active={revealPassword}
                hasPassword={!!password}
                onPress={() => setRevealPassword(r => !r)}
              />
            </TextField.Root>

            {!isAuthFactorTokenNeeded && (
              <Button
                label={l`Forgot password?`}
                accessibilityHint={l`Reset your password by sending a code to your email`}
                style={[a.mt_md, a.self_start]}
                hoverStyle={{opacity: 0.5}}
                hitSlop={HITSLOP_10}
                onPress={onPressForgotPassword}>
                <ButtonText style={[t.atoms.text_contrast_medium]}>
                  <Trans>Forgot password?</Trans>
                </ButtonText>
              </Button>
            )}
          </View>
          <View style={[a.gap_sm]}>
            <Toggle.Item
              label={l`Save my sign in with VerusID`}
              name="saveLoginWithVerusID"
              value={saveLoginWithVerusId}
              onChange={setSaveLoginWithVerusId}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Toggle.Platform />
                <Text style={[a.text_md]}>
                  <Trans>Save my sign in with VerusID</Trans>
                </Text>
              </View>
            </Toggle.Item>
            <Toggle.Item
              label={l`Remove linked VerusID`}
              name="removeLinkedVerusID"
              value={openRemoveVerusIdLinkDialog}
              onChange={setOpenRemoveVerusIdLinkDialog}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <Toggle.Platform />
                <Text style={[a.text_md]}>
                  <Trans>Remove linked VerusID</Trans>
                </Text>
              </View>
            </Toggle.Item>
          </View>
        </>
      ) : (
        <View>
          <TextField.LabelText>
            <Trans>VerusID Sign in</Trans>
          </TextField.LabelText>
          <Text
            style={[a.mt_xs, a.mb_sm, a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Scan the QR code below or press Sign in to continue</Trans>
          </Text>
          {loginUri && (
            <View style={[a.align_center, a.py_lg]}>
              <QrCodeInner link={loginUri} useBackupSVG={false} />
            </View>
          )}
        </View>
      )}
      {isAuthFactorTokenNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TextField.Root isInvalid={errorField === '2fa'}>
            <TextField.Icon icon={TicketIcon} />
            <TextField.Input
              testID="loginAuthFactorTokenInput"
              label={l`Confirmation code`}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="one-time-code"
              returnKeyType="done"
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              value={authFactorToken}
              onChangeText={text => {
                setAuthFactorToken(text)
                if (errorField) setErrorField('none')
              }}
              onSubmitEditing={() => void onPressNext()}
              editable={!isProcessing}
              accessibilityHint={l`Input the code which has been emailed to you`}
              style={{
                textTransform: authFactorToken === '' ? 'none' : 'uppercase',
              }}
            />
          </TextField.Root>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Check your email for a sign in code and enter it here.
            </Trans>
          </Text>
        </View>
      )}

      {/*
       * At most one error is visible at a time. The inline username error
       * (under the field) wins; otherwise the resolution-failure error takes
       * precedence over the generic form error.
       */}
      {!showUnresolvedError &&
        (showResolveError ? (
          <Admonition.Outer type="error">
            <Admonition.Row>
              <Admonition.Icon />
              <Admonition.Content>
                <Admonition.Text>
                  <Trans>
                    We couldn’t verify your hosting provider. Check your
                    internet connection, or{' '}
                    <InlineLinkText
                      label={l`Set your hosting provider manually`}
                      style={[a.text_sm, a.leading_snug]}
                      {...createStaticClick(() => serverInputControl.open())}>
                      set your hosting provider manually
                    </InlineLinkText>
                    .
                  </Trans>
                </Admonition.Text>
              </Admonition.Content>
            </Admonition.Row>
          </Admonition.Outer>
        ) : (
          error && (
            <Admonition.Admonition type="error">{error}</Admonition.Admonition>
          )
        ))}

      <View
        style={[
          a.pt_md,
          gtMobile && [a.justify_between, a.flex_row, a.gap_sm],
        ]}>
        {gtMobile && (
          <>
            <Button
              label={l`Back`}
              color="secondary"
              size="large"
              onPress={onPressBack}>
              <ButtonText>
                <Trans>Back</Trans>
              </ButtonText>
            </Button>

            <View style={[a.flex_shrink, a.justify_center, a.ml_auto]}>
              <HostingProviderIndicator
                state={hostingProvider.state}
                onPress={() => serverInputControl.open()}
              />
            </View>
          </>
        )}
        {!serviceDescription && error ? (
          <Button
            testID="loginRetryButton"
            label={l`Retry`}
            accessibilityHint={l`Retries signing in`}
            color="primary_subtle"
            size="large"
            onPress={onPressRetryConnect}>
            <ButtonText>
              <Trans>Retry</Trans>
            </ButtonText>
          </Button>
        ) : !serviceDescription ? (
          <Button
            label={l`Connecting to service…`}
            size="large"
            color="secondary"
            disabled>
            <ButtonIcon icon={Loader} />
            <ButtonText>
              <Trans>Connecting…</Trans>
            </ButtonText>
          </Button>
        ) : (
          <View style={[a.flex_row, a.gap_sm]}>
            <Button
              testID="loginMethodSwitchButton"
              label={
                isVerusIdLogin
                  ? l`Sign in without VerusID`
                  : l`Sign in with VerusID`
              }
              accessibilityHint={l`Switches login method`}
              color="secondary"
              size="large"
              onPress={() => {
                /*
                 * Drop the VerusID login so the manual sign in can't attach it
                 * to another account. Switching back to VerusID starts a new
                 * login, so "Sign in" opens the deeplink instead of retrying the
                 * old one.
                 */
                clearVskySession()
                if (isVerusIdLogin) {
                  // Clearing the request also stops a late response from logging in.
                  setIdentifier('')
                  setPassword('')
                  loginRequestRef.current = null
                  ivkRef.current = null
                  setLoginId('')
                }
                setIsVerusIdLogin(!isVerusIdLogin)
                // Clear the link so that the old QR code doesn't appear briefly.
                setLoginUri('')
                setError('')
                // Drop the 2FA prompt, since it was for the other method's login.
                setIsAuthFactorTokenNeeded(false)
                setAuthFactorToken('')
              }}>
              <ButtonText>
                {isVerusIdLogin ? (
                  <Trans>Sign in without VerusID</Trans>
                ) : (
                  <Trans>Sign in with VerusID</Trans>
                )}
              </ButtonText>
            </Button>
            <Button
              testID="loginNextButton"
              label={l`Sign in`}
              accessibilityHint={
                isVskyDeeplinkButton
                  ? l`Opens the VerusID sign in on this device`
                  : l`Navigates to the next screen`
              }
              color="primary"
              size="large"
              onPress={
                isVskyDeeplinkButton ? startVskyLogin : () => void onPressNext()
              }>
              <ButtonText>
                <Trans>Sign in</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
          </View>
        )}
      </View>

      {IS_NATIVE && (
        <Text style={[a.text_md, native([a.text_center, a.mx_auto]), a.mt_sm]}>
          <Trans>
            New to Bluesky?{' '}
            <InlineLinkText
              label={l`Sign up`}
              style={[a.text_md, native(a.text_center)]}
              {...createStaticClick(() => onPressCreateAccount())}>
              Sign up
            </InlineLinkText>
          </Trans>
        </Text>
      )}

      {!gtMobile && (
        <HostingProviderIndicator
          state={hostingProvider.state}
          onPress={() => serverInputControl.open()}
        />
      )}
    </FormContainer>
  )
}

function RevealPasswordButton({
  active,
  hasPassword,
  onPress,
}: {
  active: boolean
  hasPassword: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const context = TextField.useTextFieldContext()

  /*
   * The icon shows the action the button performs, not the current state: an
   * open eye when the password is hidden (tap to reveal), a crossed-out eye
   * when it is visible (tap to hide).
   */
  const Icon = active ? EyeSlashIcon : EyeIcon

  if (!hasPassword && !context.focused) return null

  return (
    <View style={[a.z_10, a.pl_sm, {marginRight: tokens.space.xs * -1}]}>
      <Button
        testID="showPasswordButton"
        onPress={onPress}
        label={active ? l`Hide password` : l`Reveal password`}
        color="secondary"
        size="small"
        shape="round"
        style={[a.bg_transparent]}
        hitSlop={tokens.space.sm}>
        <Icon
          size="md"
          style={[
            context.focused ? t.atoms.text : t.atoms.text_contrast_medium,
          ]}
        />
      </Button>
    </View>
  )
}

function HostingProviderIndicator({
  state,
  onPress,
}: {
  state: HostingProviderState
  onPress: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()

  return (
    <Button
      testID="selectServiceButton"
      label={l`Change hosting provider`}
      accessibilityHint={l`Opens a dialog to change the hosting provider you sign in to`}
      style={[!gtMobile && [a.mt_auto, a.mb_sm, a.self_center]]}
      size="small"
      color="secondary"
      variant="ghost"
      onPress={onPress}>
      <ButtonText
        style={[t.atoms.text_contrast_medium, a.font_normal]}
        numberOfLines={1}>
        {state.status === 'detected' || state.status === 'overridden' ? (
          <Trans>Hosting provider: {toNiceHostingUrl(state.pdsUrl)}</Trans>
        ) : state.status === 'email' ? (
          <Trans>Hosting provider: Bluesky</Trans>
        ) : (
          <Trans>Hosting provider</Trans>
        )}
      </ButtonText>
      <TinyChevronIcon width={8} style={[t.atoms.text_contrast_medium]} />
    </Button>
  )
}
