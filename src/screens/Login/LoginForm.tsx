import React, {useEffect, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  type TextInput,
  View,
} from 'react-native'
import {
  ComAtprotoServerCreateSession,
  type ComAtprotoServerDescribeServer,
} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import crypto from 'crypto'
import {
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  IDENTITY_VIEW,
  LOGIN_CONSENT_WEBHOOK_VDXF_KEY,
  LoginConsentChallenge,
  LoginConsentRequest,
  RedirectUri,
  RequestedPermission,
  toBase58Check,
} from 'verus-typescript-primitives'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {isNetworkError} from '#/lib/strings/errors'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useModalControls} from '#/state/modals'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useVerusIdLoginQuery} from '#/state/queries/verus/useVerusIdLoginQuery'
import {useSessionApi, useSessionVskyApi} from '#/state/session'
import {type VskySession} from '#/state/session/types'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import {HostingProvider} from '#/components/forms/HostingProvider'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Loader} from '#/components/Loader'
import {QrCodeInner} from '#/components/StarterPack/QrCode'
import {Text} from '#/components/Typography'
import {VERUSSKY_CONFIG} from '#/env/verussky'
import {FormContainer} from './FormContainer'

type ServiceDescription = ComAtprotoServerDescribeServer.OutputSchema

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
}) => {
  const t = useTheme()
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] =
    useState<boolean>(false)
  const [isAuthFactorTokenValueEmpty, setIsAuthFactorTokenValueEmpty] =
    useState<boolean>(true)
  const [isVerusIdLogin, setIsVerusIdLogin] = useState<boolean>(
    VERUSSKY_CONFIG.defaultLoginVerusid,
  )

  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const authFactorTokenValueRef = useRef<string>('')
  const vskySessionValueRef = useRef<VskySession>({auth: '', id: '', name: ''})
  const passwordRef = useRef<TextInput>(null)
  const verusIdLoginFailed = useRef<boolean>(false)
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()
  const {verusRpcInterface} = useSessionVskyApi()
  const {openModal} = useModalControls()

  const [loginUri, setLoginUri] = useState<string>('')
  const loginIdRef = useRef<string>('')

  const {data: verusIdLoginResult, error: verusIdLoginError} =
    useVerusIdLoginQuery({
      requestId: loginIdRef.current,
      verusRpcInterface,
      enabled: isVerusIdLogin && loginIdRef.current !== '',
    })

  useEffect(() => {
    // Get login URI here for the QR code and deeplink.
    const createAndSignLoginRequest = async () => {
      setIsProcessing(true)
      setLoginUri('')
      try {
        const randID = Buffer.from(crypto.randomBytes(20))
        const challengeId = toBase58Check(randID, 102)

        const details = new LoginConsentChallenge({
          challenge_id: challengeId,
          requested_access: [
            new RequestedPermission(IDENTITY_VIEW.vdxfid),
            new RequestedPermission(IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid),
          ],
          redirect_uris: [
            new RedirectUri(
              `${LOCAL_DEV_VSKY_SERVER}/api/v1/login/confirm-login`,
              LOGIN_CONSENT_WEBHOOK_VDXF_KEY.vdxfid,
            ),
          ],
          created_at: Math.floor(Date.now() / 1000),
        })

        // Sign the request using a signing server.
        const response = await fetch(
          `${LOCAL_DEV_VSKY_SERVER}/api/v1/login/sign-login-request`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(details.toJson()),
          },
        )

        if (!response.ok) {
          logger.warn('Failed to sign the request', {
            error: response.statusText,
          })
          setError('Failed to sign the request using the signing server')
          setIsProcessing(false)
          return
        }

        const res = await response.json()

        if (res.error) {
          logger.warn('Failed to sign the request', {error: res.error})
          setError('Failed to sign the request using the signing server')
          setIsProcessing(false)
          return
        }

        const signedRequest = new LoginConsentRequest(res)
        setLoginUri(signedRequest.toWalletDeeplinkUri())
        loginIdRef.current = challengeId
        setError('')
      } catch (e: any) {
        const errMsg = e.toString()
        logger.warn('Failed to login', {error: errMsg})
        setError(cleanError(errMsg))
        loginIdRef.current = ''
      }
      setIsProcessing(false)
    }

    if (isVerusIdLogin) {
      createAndSignLoginRequest()
    }
  }, [isVerusIdLogin, setError])

  const onPressSelectService = React.useCallback(() => {
    Keyboard.dismiss()
  }, [])

  const onPressNext = async () => {
    if (isProcessing) return
    Keyboard.dismiss()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setError('')

    const identifier = identifierValueRef.current.toLowerCase().trim()
    const password = passwordValueRef.current
    const authFactorToken = authFactorTokenValueRef.current
    const vskySession = vskySessionValueRef.current

    if (!identifier) {
      setError(_(msg`Please enter your username`))
      return
    }

    if (!password) {
      setError(_(msg`Please enter your password`))
      return
    }

    setIsProcessing(true)

    try {
      // try to guess the handle if the user just gave their own username
      let fullIdent = identifier
      if (
        !identifier.includes('@') && // not an email
        !identifier.includes('.') && // not a domain
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
            identifier,
            serviceDescription.availableUserDomains[0],
          )
        }
      }

      await login(
        {
          service: serviceUrl,
          identifier: fullIdent,
          password,
          authFactorToken: authFactorToken.trim(),
          vskySession: isVerusIdLogin ? vskySession : undefined,
        },
        'LoginForm',
      )

      const isManualLoginAfterVskyFailed = verusIdLoginFailed.current

      onAttemptSuccess()
      setHasCheckedForStarterPack(true)
      requestNotificationsPermission('Login')

      await setShowLoggedOut(false)

      // Wait until the login screen is gone before showing the modal.
      if (isManualLoginAfterVskyFailed) {
        logger.debug(
          'Successfully logged in manually after VerusSky login failed',
        )

        // Delay opening the modal in order to allow for transitioning away from the login screen.
        setTimeout(() => {
          openModal({
            name: 'update-verussky-credentials',
            password: password,
          })
        }, 500)
      }
    } catch (e: any) {
      const errMsg = e.toString()
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      setIsProcessing(false)
      if (
        e instanceof ComAtprotoServerCreateSession.AuthFactorTokenRequiredError
      ) {
        setIsAuthFactorTokenNeeded(true)
      } else {
        onAttemptFailed()
        if (errMsg.includes('Token is invalid')) {
          logger.debug('Failed to login due to invalid 2fa token', {
            error: errMsg,
          })
          setError(_(msg`Invalid 2FA confirmation code.`))
        } else if (
          errMsg.includes('Authentication Required') ||
          errMsg.includes('Invalid identifier or password')
        ) {
          logger.debug('Failed to login due to invalid credentials', {
            error: errMsg,
          })

          // Fallback to standard login if the VerusSky login has invalid credentials.
          if (isVerusIdLogin) {
            verusIdLoginFailed.current = true
            setIsVerusIdLogin(false)
            setError(
              _(
                msg`Unable to verify Bluesky credentials. Please sign in manually.`,
              ),
            )
          } else {
            setError(_(msg`Incorrect username or password`))
          }
        } else if (isNetworkError(e)) {
          logger.warn('Failed to login due to network error', {error: errMsg})
          setError(
            _(
              msg`Unable to contact your service. Please check your Internet connection.`,
            ),
          )
        } else {
          logger.warn('Failed to login', {error: errMsg})
          setError(cleanError(errMsg))
        }
      }
    }
  }

  // startVskyLogin uses the deeplink and starts the checking for the login.
  const startVskyLogin = async () => {
    if (isProcessing) {
      return
    }
    // Open the deeplink on the same tab so that the current navigation stack is saved.
    window.location.href = loginUri
  }

  // Handle successful login
  useEffect(() => {
    if (!verusIdLoginResult) {
      return
    }

    vskySessionValueRef.current = {
      auth: '',
      id: verusIdLoginResult.identity.identityaddress || '',
      name: verusIdLoginResult.identity.name,
    }

    identifierValueRef.current = verusIdLoginResult.credentials.username
    passwordValueRef.current = verusIdLoginResult.credentials.password

    onPressNext()

    // onPressNext doesn't change so it is fine to exclude from the dependencies
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verusIdLoginResult])

  // Handle errors from fetching the VerusID login
  useEffect(() => {
    if (!verusIdLoginError) {
      return
    }

    const errMsg = verusIdLoginError.message
    logger.warn('Failed to verify VerusSky login response', {error: errMsg})

    // Set appropriate error messages based on error type
    if (errMsg.includes('Missing login credentials')) {
      setError(
        _(
          msg`Missing login credentials from VerusSky. Please log in manually.`,
        ),
      )
    } else if (errMsg.includes('Missing username')) {
      setError(
        _(msg`Missing username from VerusSky login. Please log in manually.`),
      )
    } else if (errMsg.includes('Missing password')) {
      setError(
        _(msg`Missing password from VerusSky login. Please log in manually.`),
      )
    } else if (
      errMsg.includes('Invalid credential format') ||
      errMsg.includes('Invalid credentials')
    ) {
      setError(
        _(
          msg`Missing username and password from VerusSky login. Please log in manually.`,
        ),
      )
    } else if (errMsg.includes('Invalid login response')) {
      setError(_(msg`Unable to validate the VerusSky login.`))
    } else {
      setError(cleanError(errMsg))
    }

    verusIdLoginFailed.current = true
    setIsVerusIdLogin(false)

    setIsProcessing(false)
  }, [verusIdLoginError, _, setError])

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Account provider</Trans>
        </TextField.LabelText>
        <HostingProvider
          serviceUrl={serviceUrl}
          onSelectServiceUrl={url => {
            setServiceUrl(url)
            verusIdLoginFailed.current = false
          }}
          onOpenDialog={onPressSelectService}
        />
      </View>
      {!isVerusIdLogin ? (
        <View>
          <TextField.LabelText>
            <Trans>Account</Trans>
          </TextField.LabelText>
          <View style={[a.gap_sm]}>
            <TextField.Root>
              <TextField.Icon icon={At} />
              <TextField.Input
                testID="loginUsernameInput"
                label={_(msg`Username or email address`)}
                autoCapitalize="none"
                autoFocus
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                textContentType="username"
                defaultValue={
                  verusIdLoginFailed.current ? '' : initialHandle || ''
                }
                onChangeText={v => {
                  identifierValueRef.current = v
                }}
                onSubmitEditing={() => {
                  passwordRef.current?.focus()
                }}
                blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
                editable={!isProcessing}
                accessibilityHint={_(
                  msg`Enter the username or email address you used when you created your account`,
                )}
              />
            </TextField.Root>

            <TextField.Root>
              <TextField.Icon icon={Lock} />
              <TextField.Input
                testID="loginPasswordInput"
                inputRef={passwordRef}
                label={_(msg`Password`)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                returnKeyType="done"
                enablesReturnKeyAutomatically={true}
                secureTextEntry={true}
                textContentType="password"
                clearButtonMode="while-editing"
                onChangeText={v => {
                  passwordValueRef.current = v
                }}
                onSubmitEditing={onPressNext}
                blurOnSubmit={false} // HACK: https://github.com/facebook/react-native/issues/21911#issuecomment-558343069 Keyboard blur behavior is now handled in onSubmitEditing
                editable={!isProcessing}
                accessibilityHint={_(msg`Enter your password`)}
              />
              <Button
                testID="forgotPasswordButton"
                onPress={onPressForgotPassword}
                label={_(msg`Forgot password?`)}
                accessibilityHint={_(msg`Opens password reset form`)}
                variant="solid"
                color="secondary"
                style={[
                  a.rounded_sm,
                  // t.atoms.bg_contrast_100,
                  {marginLeft: 'auto', left: 6, padding: 6},
                  a.z_10,
                ]}>
                <ButtonText>
                  <Trans>Forgot?</Trans>
                </ButtonText>
              </Button>
            </TextField.Root>
          </View>
        </View>
      ) : (
        <View>
          <TextField.LabelText>
            <Trans>VerusID Login</Trans>
          </TextField.LabelText>
          <Text
            style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_xs, a.mb_sm]}>
            <Trans>Scan the QR code below or press Next to continue</Trans>
          </Text>
          {loginUri && (
            <View style={[a.align_center, a.py_lg]}>
              <QrCodeInner link={loginUri} />
            </View>
          )}
        </View>
      )}
      {isAuthFactorTokenNeeded && (
        <View>
          <TextField.LabelText>
            <Trans>2FA Confirmation</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Icon icon={Ticket} />
            <TextField.Input
              testID="loginAuthFactorTokenInput"
              label={_(msg`Confirmation code`)}
              autoCapitalize="none"
              autoFocus
              autoCorrect={false}
              autoComplete="one-time-code"
              returnKeyType="done"
              textContentType="username"
              blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
              onChangeText={v => {
                setIsAuthFactorTokenValueEmpty(v === '')
                authFactorTokenValueRef.current = v
              }}
              onSubmitEditing={onPressNext}
              editable={!isProcessing}
              accessibilityHint={_(
                msg`Input the code which has been emailed to you`,
              )}
              style={[
                {
                  textTransform: isAuthFactorTokenValueEmpty
                    ? 'none'
                    : 'uppercase',
                },
              ]}
            />
          </TextField.Root>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium, a.mt_sm]}>
            <Trans>
              Check your email for a sign in code and enter it here.
            </Trans>
          </Text>
        </View>
      )}
      <FormError error={error} />
      <View style={[a.flex_row, a.align_center, a.pt_md]}>
        <Button
          label={_(msg`Back`)}
          variant="solid"
          color="secondary"
          size="large"
          onPress={onPressBack}>
          <ButtonText>
            <Trans>Back</Trans>
          </ButtonText>
        </Button>
        <View style={a.flex_1} />
        {!serviceDescription && error ? (
          <Button
            testID="loginRetryButton"
            label={_(msg`Retry`)}
            accessibilityHint={_(msg`Retries signing in`)}
            variant="solid"
            color="secondary"
            size="large"
            onPress={onPressRetryConnect}>
            <ButtonText>
              <Trans>Retry</Trans>
            </ButtonText>
          </Button>
        ) : !serviceDescription ? (
          <>
            <ActivityIndicator />
            <Text style={[t.atoms.text_contrast_high, a.pl_md]}>
              <Trans>Connecting...</Trans>
            </Text>
          </>
        ) : (
          <>
            <Button
              testID="loginMethodSwitchButton"
              label={_(msg`Switch`)}
              accessibilityHint={_(msg`Switches login method`)}
              variant="solid"
              color="secondary"
              size="large"
              onPress={() => {
                setIsVerusIdLogin(!isVerusIdLogin)
                setLoginUri('') // Clear the link so that the QR code doesn't appear briefly
                setError('')
              }}
              style={[a.mr_sm]}>
              <ButtonText>
                {isVerusIdLogin ? (
                  <Trans>Use manual login</Trans>
                ) : (
                  <Trans>Use VerusID login</Trans>
                )}
              </ButtonText>
            </Button>
            <Button
              testID="loginNextButton"
              label={_(msg`Next`)}
              accessibilityHint={
                isVerusIdLogin
                  ? _(msg`Links to signing in on the same device`)
                  : _(msg`Navigates to the next screen`)
              }
              variant="solid"
              color="primary"
              size="large"
              onPress={isVerusIdLogin ? startVskyLogin : onPressNext}>
              <ButtonText>
                <Trans>Next</Trans>
              </ButtonText>
              {isProcessing && <ButtonIcon icon={Loader} />}
            </Button>
          </>
        )}
      </View>
    </FormContainer>
  )
}
