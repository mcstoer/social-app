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
import {primitives} from 'verusid-ts-client'

import {
  LOCAL_DEV_VSKY_LOGIN_SERVER,
  LOCAL_DEV_VSKY_SIGNING_SERVER,
  VSKY_SERVICE,
} from '#/lib/constants'
import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {isNetworkError} from '#/lib/strings/errors'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
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
import {Text} from '#/components/Typography'
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
  const [needsManualLogin, setNeedsManualLogin] = useState<boolean>(false)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const authFactorTokenValueRef = useRef<string>('')
  const vskySessionValueRef = useRef<VskySession>({auth: '', id: '', name: ''})
  const passwordRef = useRef<TextInput>(null)
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()
  const {rpcInterface, idInterface} = useSessionVskyApi()
  const isVskyService = serviceUrl === VSKY_SERVICE

  const [loginUri, setLoginUri] = useState<string>('')

  useEffect(() => {
    if (isVskyService) {
      // Get login URI here for the QR code and deeplink.
      const fetchLoginUri = async () => {
        setIsProcessing(true)
        try {
          const response = await fetch(
            `${LOCAL_DEV_VSKY_SIGNING_SERVER}/api/v1/login/get-login-request`,
          )

          if (!response.ok) {
            logger.warn('Failed to fetch login URI', {
              error: response.statusText,
            })
            setError('Failed to fetch login URI from signing server')
          }

          const res = await response.json()

          if (res.error) {
            logger.warn('Failed to fetch login URI', {error: res.error})
            setError('Failed to fetch login URI from signing server')
          }

          if (res.uri) {
            setLoginUri(res.uri)
            setError('')
          } else {
            logger.warn('Failed to fetch login URI', {error: 'No URI returned'})
            setError('Failed to fetch login URI from signing server')
          }
        } catch (e: any) {
          const errMsg = e.toString()
          logger.warn('Failed to login', {error: errMsg})
          setError(cleanError(errMsg))
        }
        setIsProcessing(false)
      }

      fetchLoginUri()
    }
  }, [isVskyService, setError])

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

      // TODO remove double login
      await login(
        {
          service: serviceUrl,
          identifier: fullIdent,
          password,
          authFactorToken: authFactorToken.trim(),
          vskySession: isVskyService ? vskySession : undefined,
        },
        'LoginForm',
      )

      const isManualLoginAfterVskyFailed = isVskyService && needsManualLogin

      // TODO: In the future, ask the user if they want to store credentials
      if (isManualLoginAfterVskyFailed) {
        logger.debug(
          'Successfully logged in manually after VeruSky login failed',
        )
      }

      onAttemptSuccess()
      setShowLoggedOut(false)
      setHasCheckedForStarterPack(true)
      requestNotificationsPermission('Login')
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

          // Fallback to standard login if the VeruSky login has invalid credentials.
          if (isVskyService && !needsManualLogin) {
            setNeedsManualLogin(true)
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
    checkForVskyLogin()
  }

  // checkForVskyLogin polls the login server for the login and passes the details to onPressNext.
  const checkForVskyLogin = async () => {
    const pollInterval = 1000

    const getLogin = async () => {
      const response = await fetch(`${LOCAL_DEV_VSKY_LOGIN_SERVER}/get-login`)

      // Occurs when the login server hasn't received a recent login.
      if (response.status === 204) {
        return
      }

      if (!response.ok) {
        return
      }

      // Clear the polling for a response if we get a valid response.
      clearInterval(intervalRef)

      const res = await response.json()
      const loginRes = new primitives.LoginConsentResponse(res)

      try {
        const isValid = await idInterface.verifyLoginConsentResponse(loginRes)
        if (isValid) {
          const identity = await rpcInterface.getIdentity(loginRes.signing_id)
          if (identity.result) {
            vskySessionValueRef.current.name = identity.result.identity.name

            // Get the Bluesky credentials from the credentials in the login request.
            const context = loginRes.decision.context
            const credential = new primitives.Credential()
            const credentialHex =
              context?.kv[primitives.IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid]

            if (!credentialHex) {
              logger.warn('Failed to find credentials in VeruSky login.')
              setNeedsManualLogin(true)
              setError(
                _(
                  msg`Missing login credentials from VeruSky. Please log in manually.`,
                ),
              )
              setIsProcessing(false)
              return
            }

            credential.fromBuffer(Buffer.from(credentialHex, 'hex'))
            const plainLogin = credential.credential

            if (
              plainLogin &&
              Array.isArray(plainLogin) &&
              plainLogin.length >= 2
            ) {
              // JSON.stringify avoids misinterpreting parts of the username or password as control characters.
              identifierValueRef.current = JSON.stringify(plainLogin[0]).slice(
                1,
                -1,
              )
              passwordValueRef.current = JSON.stringify(plainLogin[1]).slice(
                1,
                -1,
              )
              onPressNext()
            } else {
              // If the credentials don't exist, then the user needs to manually input them.
              if (!plainLogin || !Array.isArray(plainLogin)) {
                logger.warn(
                  'Failed to find the username and password from the VeruSky login.',
                )
                setNeedsManualLogin(true)
                setError(
                  _(
                    msg`Missing username and password from VeruSky login. Please log in manually.`,
                  ),
                )
              } else if (!plainLogin[0]) {
                logger.warn(
                  'Failed to find the username from the VeruSky login.',
                )
                setNeedsManualLogin(true)
                setError(
                  _(
                    msg`Missing username from VeruSky login. Please log in manually.`,
                  ),
                )
              } else if (!plainLogin[1]) {
                logger.warn(
                  'Failed to find the password from the VeruSky login.',
                )
                setNeedsManualLogin(true)
                setError(
                  _(
                    msg`Missing password from VeruSky login. Please log in manually.`,
                  ),
                )
              }
              setIsProcessing(false)
            }
          } else {
            logger.warn('Failed to login due to invalid login response')
            setError(_(msg`Unable to validate the VeruSky login.`))
          }
        } else {
          logger.warn(
            'Failed to login due to unknown signing ID in login response',
          )
          setError(_(msg`Unable to lookup VeruSky login ID.`))
        }
      } catch (e: any) {
        const errMsg = e.toString()
        logger.warn('Failed to verify VeruSky login response', {error: errMsg})
        setError(cleanError(errMsg))
      }
    }

    const intervalRef = setInterval(() => {
      getLogin()
    }, pollInterval)
  }

  const resetManualLoginState = () => {
    setNeedsManualLogin(false)
  }

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
            resetManualLoginState()
          }}
          onOpenDialog={onPressSelectService}
        />
      </View>
      {(!isVskyService || (isVskyService && needsManualLogin)) && (
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
                defaultValue={needsManualLogin ? '' : initialHandle || ''}
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
            {isVskyService && needsManualLogin && (
              <Button
                testID="vskyRetryButton"
                label={_(msg`Retry`)}
                accessibilityHint={_(msg`Retries VeruSky login`)}
                variant="solid"
                color="secondary"
                size="large"
                onPress={() => {
                  setNeedsManualLogin(false)
                  startVskyLogin()
                  setError('')
                }}
                style={[a.mr_sm]}>
                <ButtonText>
                  <Trans>Retry</Trans>
                </ButtonText>
              </Button>
            )}
            <Button
              testID="loginNextButton"
              label={_(msg`Next`)}
              accessibilityHint={
                isVskyService && !needsManualLogin
                  ? _(msg`Links to signing in on the same device`)
                  : _(msg`Navigates to the next screen`)
              }
              variant="solid"
              color="primary"
              size="large"
              onPress={
                isVskyService && !needsManualLogin
                  ? startVskyLogin
                  : onPressNext
              }>
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
