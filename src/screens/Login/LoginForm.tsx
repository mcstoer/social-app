import React, {useEffect, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  TextInput,
  View,
} from 'react-native'
import {
  ComAtprotoServerCreateSession,
  ComAtprotoServerDescribeServer,
} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {primitives} from 'verusid-ts-client'

import {
  DUAL_SERVICE,
  LOCAL_DEV_DUAL_LOGIN_SERVER,
  LOCAL_DEV_DUAL_SIGNING_SERVER,
} from '#/lib/constants'
import {useRequestNotificationsPermission} from '#/lib/notifications/notifications'
import {isNetworkError} from '#/lib/strings/errors'
import {cleanError} from '#/lib/strings/errors'
import {createFullHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useSetHasCheckedForStarterPack} from '#/state/preferences/used-starter-packs'
import {useSessionApi, useSessionDualApi} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import {HostingProvider} from '#/components/forms/HostingProvider'
import * as TextField from '#/components/forms/TextField'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {Ticket_Stroke2_Corner0_Rounded as Ticket} from '#/components/icons/Ticket'
import {Link} from '#/components/Link'
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
}) => {
  const t = useTheme()
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isAuthFactorTokenNeeded, setIsAuthFactorTokenNeeded] =
    useState<boolean>(false)
  const [isAuthFactorTokenValueEmpty, setIsAuthFactorTokenValueEmpty] =
    useState<boolean>(true)
  const identifierValueRef = useRef<string>(initialHandle || '')
  const passwordValueRef = useRef<string>('')
  const authFactorTokenValueRef = useRef<string>('')
  const dualAuthValueRef = useRef<string>('')
  const passwordRef = useRef<TextInput>(null)
  const {_} = useLingui()
  const {login} = useSessionApi()
  const requestNotificationsPermission = useRequestNotificationsPermission()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const setHasCheckedForStarterPack = useSetHasCheckedForStarterPack()
  const {idInterface} = useSessionDualApi()
  const isDualService = serviceUrl === DUAL_SERVICE

  const [loginUri, setLoginUri] = useState<string>('')

  useEffect(() => {
    if (isDualService) {
      // Get login URI here for the QR code and deeplink.
      const fetchLoginUri = async () => {
        setIsProcessing(true)
        try {
          const response = await fetch(
            `${LOCAL_DEV_DUAL_SIGNING_SERVER}/api/v1/login/get-login-request`,
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
  }, [isDualService, setError])

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
    const dualAuth = dualAuthValueRef.current

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
          dualAuth: isDualService ? dualAuth : undefined,
        },
        'LoginForm',
      )
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
      } else if (errMsg.includes('Token is invalid')) {
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
        setError(_(msg`Incorrect username or password`))
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

  // startDualLogin uses the deeplink and starts the checking for the login.
  const startDualLogin = async () => {
    if (isProcessing) {
      return
    }
    checkForDualLogin()
  }

  // checkForDualLogin polls the login server for the login and passes the details to onPressNext.
  const checkForDualLogin = async () => {
    const pollInterval = 1000

    const getLogin = async () => {
      const response = await fetch(`${LOCAL_DEV_DUAL_LOGIN_SERVER}/get-login`)

      // Occurs when the login server hasn't received a recent login.
      if (response.status === 204) {
        return
      }

      if (!response.ok) {
        return
      }

      const res = await response.json()
      const loginRes = new primitives.LoginConsentResponse(res)

      try {
        const isValid = await idInterface.verifyLoginConsentResponse(loginRes)
        if (isValid) {
          identifierValueRef.current = process.env.TEST_USERNAME
          passwordValueRef.current = process.env.TEST_PASSWORD
          dualAuthValueRef.current = loginRes.signing_id
          onPressNext()
        } else {
          logger.warn('Failed to login due to invalid login response')
          setError(_(msg`Unable to validate the dual login.`))
        }
      } catch (e: any) {
        const errMsg = e.toString()
        logger.warn('Failed to verify dual login response', {error: errMsg})
        setError(cleanError(errMsg))
      }

      clearInterval(intervalRef)
    }

    const intervalRef = setInterval(() => {
      getLogin()
    }, pollInterval)
  }

  return (
    <FormContainer testID="loginForm" titleText={<Trans>Sign in</Trans>}>
      <View>
        <TextField.LabelText>
          <Trans>Account provider</Trans>
        </TextField.LabelText>
        <HostingProvider
          serviceUrl={serviceUrl}
          onSelectServiceUrl={setServiceUrl}
          onOpenDialog={onPressSelectService}
        />
      </View>
      {isDualService ? (
        <View>
          <TextField.LabelText>
            <Trans>Scan to sign in using your phone</Trans>
          </TextField.LabelText>
          <View style={[a.gap_sm]}>
            <Link to={loginUri} label={'Link login'}>
              <Button
                testID="loginSameDeviceButton"
                label={_(msg`Link login button`)}
                accessibilityHint={_(
                  msg`Links to signing in on the same device`,
                )}
                variant="solid"
                color="primary"
                size="large"
                onPress={startDualLogin}>
                <ButtonText>
                  <Trans>Sign in on same device</Trans>
                </ButtonText>
                {isProcessing && <ButtonIcon icon={Loader} />}
              </Button>
            </Link>
          </View>
        </View>
      ) : (
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
                defaultValue={initialHandle || ''}
                onChangeText={v => {
                  identifierValueRef.current = v
                }}
                onSubmitEditing={() => {
                  passwordRef.current?.focus()
                }}
                blurOnSubmit={false} // prevents flickering due to onSubmitEditing going to next field
                editable={!isProcessing}
                accessibilityHint={_(
                  msg`Input the username or email address you used at signup`,
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
                accessibilityHint={_(msg`Input your password`)}
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
            <Trans>Check your email for a login code and enter it here.</Trans>
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
            accessibilityHint={_(msg`Retries login`)}
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
          <Button
            testID="loginNextButton"
            label={_(msg`Next`)}
            accessibilityHint={_(msg`Navigates to the next screen`)}
            variant="solid"
            color="primary"
            size="large"
            onPress={onPressNext}>
            <ButtonText>
              <Trans>Next</Trans>
            </ButtonText>
            {isProcessing && <ButtonIcon icon={Loader} />}
          </Button>
        )}
      </View>
    </FormContainer>
  )
}
