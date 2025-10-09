import {useEffect, useRef, useState} from 'react'
import {ActivityIndicator, SafeAreaView, StyleSheet, View} from 'react-native'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import crypto from 'crypto'
import {
  BigNumber,
  Credential,
  DATA_TYPE_OBJECT_CREDENTIAL,
  IDENTITY_CREDENTIAL,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  IdentityUpdateRequest,
  IdentityUpdateRequestDetails,
  IdentityUpdateResponse,
  ResponseUri,
} from 'verus-typescript-primitives'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {usePalette} from '#/lib/hooks/usePalette'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {cleanError, isNetworkError} from '#/lib/strings/errors'
import {colors, s} from '#/lib/styles'
import {logger} from '#/logger'
import {isAndroid, isNative, isWeb} from '#/platform/detection'
import {useModalControls} from '#/state/modals'
import {useSession} from '#/state/session'
import {IADDRESS} from '#/env'
import {ErrorMessage} from '../util/error/ErrorMessage'
import {Button} from '../util/forms/Button'
import {Text} from '../util/text/Text'
import {ScrollView} from './util'
import {TextInput} from './util'

enum Stages {
  UpdateCredentials,
  AwaitingResponse,
  Done,
}

export const snapPoints = isAndroid ? ['90%'] : ['45%']

export function Component({password: initialPassword}: {password?: string}) {
  const pal = usePalette('default')
  const {currentAccount} = useSession()
  const {_} = useLingui()
  const {closeModal} = useModalControls()
  const {isMobile} = useWebMediaQueries()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [stage, setStage] = useState<Stages>(Stages.UpdateCredentials)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [email, setEmail] = useState<string>(currentAccount?.email || '')
  const [password, setPassword] = useState<string>(initialPassword || '')
  const [error, setError] = useState<string>('')

  // Use a ref to track the request ID, since the request converts it to one with toJson().
  const identityUpdateIdRef = useRef<string>('')

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Log when the state is initialized
  useEffect(() => {
    logger.debug('UpdateVerusSkyCredentials state initialized', {
      email: email ? 'Set' : 'Empty',
      password: password ? 'Set' : 'Empty',
    })
  }, [email, password])

  // Pass in the requestId to avoid timing issues with state updates.
  const checkForUpdateResponse = async () => {
    const pollInterval = 1000
    const requestId = identityUpdateIdRef.current

    const getUpdateResponse = async () => {
      if (!requestId) {
        return
      }

      try {
        // Endpoint will be similar to the get-login endpoint in vskylogin
        // Pass the details to the server to generate the request.
        const response = await fetch(
          `${LOCAL_DEV_VSKY_SERVER}/api/v1/identityupdates/get-credential-update-response?requestId=${requestId}`,
        )

        // No response yet
        if (response.status === 204) {
          return
        }

        if (!response.ok) {
          logger.warn('Failed to get update response', {
            status: response.status,
            statusText: response.statusText,
          })
          return
        }

        // Clear the polling interval when we get a valid response
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }

        const data = await response.json()
        const identityUpdateResponse = IdentityUpdateResponse.fromJson(data)

        if (identityUpdateResponse.details.containsTxid()) {
          setStage(Stages.Done)
          logger.debug('Successfully updated VerusSky credentials')
        } else {
          setError(data.error || _(msg`Failed to update credentials`))
          setStage(Stages.UpdateCredentials)
        }

        setIsProcessing(false)
      } catch (e: any) {
        const errMsg = e.toString()
        logger.warn('Error while checking for credential update response', {
          error: errMsg,
        })
        if (isNetworkError(e)) {
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

        // Stop polling on error
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    intervalRef.current = setInterval(() => {
      getUpdateResponse()
    }, pollInterval)
  }

  const onUpdateCredentials = async () => {
    if (!email.trim()) {
      setError(_(msg`Please enter your email`))
      return
    }

    if (!password.trim()) {
      setError(_(msg`Please enter your password`))
      return
    }

    if (currentAccount?.type !== 'vsky') {
      setError(_(msg`Unable to update credentials for non-VerusSky accounts`))
      return
    }

    setError('')
    setIsProcessing(true)

    try {
      // Create the identity update request details.
      const identityUpdateDetailCLIJson = {
        name: currentAccount.name + '@',
        contentmultimap: {
          [IDENTITY_CREDENTIAL.vdxfid]: [
            {
              [DATA_TYPE_OBJECT_CREDENTIAL.vdxfid]: {
                version: Credential.VERSION_CURRENT.toNumber(),
                credentialkey: IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid,
                credential: [email, password],
                scopes: [IADDRESS],
              },
            },
          ],
        },
      }

      const randID = Buffer.from(crypto.randomBytes(20))
      const requestId = new BigNumber(randID)
      // Generate the timestamp in seconds, since that's what block times are in.
      const createdAt = new BigNumber((Date.now() / 1000).toFixed(0))

      const details = IdentityUpdateRequestDetails.fromCLIJson(
        identityUpdateDetailCLIJson,
      )

      // Add the response URIs.
      details.responseuris = [
        ResponseUri.fromUriString(
          `${LOCAL_DEV_VSKY_SERVER}/api/v1/identityupdates/confirm-credential-update`,
          ResponseUri.TYPE_POST,
        ),
      ]

      // IMPORTANT: Set the flag to indicate that response URIs are present
      if (!details.containsResponseUris()) {
        details.toggleContainsResponseUris()
      }

      details.requestid = requestId
      details.createdat = createdAt

      // Get the ID as a string by converting the details to JSON,
      // since we need to do that anyways to send the details.
      const detailsJson = details.toJson()
      identityUpdateIdRef.current = detailsJson.requestid!

      // Send the update request.
      if (isWeb) {
        // Web implementation using signing server
        const response = await fetch(
          `${LOCAL_DEV_VSKY_SERVER}/api/v1/identityupdates/update-credentials`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(detailsJson),
          },
        )

        if (!response.ok) {
          logger.warn('Failed to initiate credential update', {
            status: response.status,
            statusText: response.statusText,
          })
          setError(_(msg`Failed to update credentials`))
          setIsProcessing(false)
          return
        }

        const res = await response.json()

        if (res.error) {
          logger.warn('Failed to get signed identity update request', {
            error: res.error,
          })
          setError('Failed to initiate credential update')
          setIsProcessing(false)
          return
        }

        if (res) {
          const signedRequest = IdentityUpdateRequest.fromJson(res)
          const deeplinkUri = signedRequest.toWalletDeeplinkUri()
          setStage(Stages.AwaitingResponse)
          // Open deeplink in same window
          window.location.href = deeplinkUri
          // Start polling for response and pass the requestId directly to avoid state timing issues
          checkForUpdateResponse()
        } else {
          logger.warn('Failed to get signed identity update request', {
            error: 'No URI or requestId returned',
          })
          setError('Failed to initiate credential update')
          setIsProcessing(false)
        }
      } else if (isNative) {
        // Mobile implementation will be different
        // This is a placeholder for the actual implementation
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
  }

  return (
    <SafeAreaView style={[pal.view, s.flex1]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
        keyboardShouldPersistTaps="handled">
        <View>
          <View style={styles.titleSection}>
            <Text type="title-lg" style={[pal.text, styles.title]}>
              {stage === Stages.Done
                ? _(msg`Credentials Update Confirmed`)
                : _(msg`Update BlueSky Credentials`)}
            </Text>
          </View>

          <Text type="lg" style={[pal.textLight, {marginBottom: 10}]}>
            {stage === Stages.UpdateCredentials ? (
              <Trans>
                Update your BlueSky credentials stored in your VerusSky VerusID.
              </Trans>
            ) : stage === Stages.AwaitingResponse ? (
              <Trans>Please confirm the update in your Verus wallet...</Trans>
            ) : (
              <>
                <Trans>
                  Your credentials update is confirmed and will be completed
                  soon.
                </Trans>
              </>
            )}
          </Text>

          {stage === Stages.UpdateCredentials && (
            <View style={[pal.border, styles.group]}>
              <View style={[styles.groupContent]}>
                <FontAwesomeIcon
                  icon="envelope"
                  style={[pal.textLight, styles.groupContentIcon]}
                />
                <TextInput
                  testID="emailInput"
                  style={[pal.text, styles.textInput]}
                  placeholder={_(msg`Email`)}
                  placeholderTextColor={pal.colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setError('')}
                  accessible={true}
                  accessibilityLabel={_(msg`Email`)}
                  accessibilityHint=""
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                />
              </View>
              <View
                style={[
                  pal.borderDark,
                  styles.groupContent,
                  styles.groupBottom,
                ]}>
                <FontAwesomeIcon
                  icon="lock"
                  style={[pal.textLight, styles.groupContentIcon]}
                />
                <TextInput
                  testID="passwordInput"
                  style={[pal.text, styles.textInput]}
                  placeholder={_(msg`Password`)}
                  placeholderTextColor={pal.colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  accessible={true}
                  accessibilityLabel={_(msg`Password`)}
                  accessibilityHint=""
                  autoCapitalize="none"
                  autoComplete="password"
                />
              </View>
            </View>
          )}
          {error ? (
            <ErrorMessage message={error} style={[styles.error]} />
          ) : undefined}
        </View>
        <View style={[styles.btnContainer]}>
          {isProcessing ? (
            <View style={styles.btn}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={{gap: 6}}>
              {stage === Stages.UpdateCredentials && (
                <Button
                  testID="updateCredentialsBtn"
                  type="primary"
                  onPress={onUpdateCredentials}
                  accessibilityLabel={_(msg`Next`)}
                  accessibilityHint=""
                  label={_(msg`Next`)}
                  labelContainerStyle={{justifyContent: 'center', padding: 4}}
                  labelStyle={[s.f18]}
                />
              )}
              <Button
                testID="cancelBtn"
                type={stage !== Stages.Done ? 'default' : 'primary'}
                onPress={() => {
                  closeModal()
                }}
                accessibilityLabel={
                  stage !== Stages.Done ? _(msg`Cancel`) : _(msg`Close`)
                }
                accessibilityHint=""
                label={stage !== Stages.Done ? _(msg`Cancel`) : _(msg`Close`)}
                labelContainerStyle={{justifyContent: 'center', padding: 4}}
                labelStyle={[s.f18]}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  containerMobile: {
    paddingHorizontal: 18,
    paddingBottom: 35,
  },
  titleSection: {
    paddingTop: isWeb ? 0 : 4,
    paddingBottom: isWeb ? 14 : 10,
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 5,
  },
  error: {
    borderRadius: 6,
  },
  textInput: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    padding: 14,
    backgroundColor: colors.blue3,
  },
  btnContainer: {
    paddingTop: 20,
  },
  group: {
    borderWidth: 1,
    borderRadius: 10,
    marginVertical: 20,
  },
  groupLabel: {
    paddingHorizontal: 20,
    paddingBottom: 5,
  },
  groupContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupBottom: {
    borderTopWidth: 1,
  },
  groupContentIcon: {
    marginLeft: 10,
  },
})
