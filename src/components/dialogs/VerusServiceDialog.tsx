import {useState} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {VerusdRpcInterface} from 'verusd-rpc-ts-client'

import {VSKY_SERVICE, VSKY_SERVICE_ID} from '#/lib/constants'
import {logger} from '#/logger'
import {
  useSetVerusServicePreferences,
  useVerusService,
} from '#/state/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'

export function VerusServiceDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <VerusServiceInner />
    </Dialog.Outer>
  )
}

function VerusServiceInner() {
  const t = useTheme()
  const {_} = useLingui()
  const {state} = useVerusService()
  const setVerusServicePreferences = useSetVerusServicePreferences()
  const control = Dialog.useDialogContext()

  const [url, setUrl] = useState(state.url)
  const [system, setSystem] = useState(state.system)
  const [username, setUsername] = useState(state.auth?.username || '')
  const [password, setPassword] = useState(state.auth?.password || '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')

  const hasChanges =
    url !== state.url ||
    system !== state.system ||
    (username !== (state.auth?.username || '') &&
      password !== (state.auth?.password || ''))

  const onUpdate = async () => {
    if (!url.trim()) {
      setError(_(msg`Please enter a service URL`))
      return
    }

    try {
      // Just check if the URL is valid
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      setError(_(msg`Please enter a valid URL`))
      return
    }

    if (!system.trim()) {
      setError(_(msg`Please enter a system ID`))
      return
    }

    if (username && !password) {
      setError(_(msg`Please enter a password for the provided username`))
      return
    }

    setIsUpdating(true)
    setError('')

    try {
      const newSettings = {
        url,
        system,
        auth:
          username && password
            ? {
                username,
                password,
              }
            : undefined,
      }

      // Check if the Verus service configuration works before saving
      const testInterface = new VerusdRpcInterface(
        newSettings.system,
        newSettings.url,
        newSettings.auth
          ? {
              auth: {
                username: newSettings.auth.username,
                password: newSettings.auth.password,
              },
            }
          : undefined,
      )

      const info = await testInterface.getInfo()

      if (info.error) {
        if (info.error.code === 401) {
          setError(
            _(msg`Authentication failed. Please check your credentials.`),
          )
          return
        }

        setError(
          _(
            msg`Unable to connect to the Verus Service endpoint. Please verify your input details are correct and try again.`,
          ),
        )
        return
      }

      setVerusServicePreferences(newSettings)

      control.close()
    } catch (e: any) {
      logger.error(`Failed to update the Verus Service endpoint`, {
        safeMessage: e.message,
      })
      setError(
        _(msg`Failed to update the Verus Service endpoint. Please try again`),
      )
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog.ScrollableInner label={_(msg`Update Verus Service Instance`)}>
      <View>
        <Text
          style={[
            a.text_md,
            a.font_semi_bold,
            a.pb_sm,
            t.atoms.text_contrast_high,
          ]}>
          <Trans>Update Verus Service Endpoint</Trans>
        </Text>
        <Text style={[a.pb_lg, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Set the Verus service endpoint to use for VerusID and media.
          </Trans>
        </Text>

        <View style={[a.gap_lg]}>
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>Service URL</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                label={_(msg`Service URL`)}
                placeholder={VSKY_SERVICE}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </TextField.Root>
          </View>

          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>System ID</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <Dialog.Input
                label={_(msg`System ID`)}
                placeholder={VSKY_SERVICE_ID}
                value={system}
                onChangeText={setSystem}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>

          <View style={[a.gap_sm]}>
            <Text
              style={[
                a.text_sm,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>Authentication (Optional)</Trans>
            </Text>
            <Text style={[a.text_sm, a.leading_snug]}>
              <Trans>
                If the Verus service requires authentication, enter the
                credentials below. Credentials will only be stored locally on
                your device.
              </Trans>
            </Text>

            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Username</Trans>
              </TextField.LabelText>
              <TextField.Root>
                <Dialog.Input
                  label={_(msg`Username`)}
                  placeholder={`Username`}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </TextField.Root>
            </View>

            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Password</Trans>
              </TextField.LabelText>
              <TextField.Root>
                <Dialog.Input
                  label={_(msg`Password`)}
                  placeholder={`Password`}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </TextField.Root>
            </View>
          </View>

          {error ? <Admonition type="error">{error}</Admonition> : null}

          <Button
            color="primary"
            size="large"
            label={_(msg`Update`)}
            onPress={onUpdate}
            disabled={!hasChanges || isUpdating}>
            <ButtonText>
              <Trans>Update</Trans>
            </ButtonText>
            {isUpdating && <ButtonIcon icon={Loader} />}
          </Button>
        </View>
      </View>

      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
