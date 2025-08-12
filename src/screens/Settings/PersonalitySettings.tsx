import {useCallback, useState} from 'react'
import {
  ActivityIndicator,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {useFocusEffect} from '@react-navigation/native'

import {usePalette} from '#/lib/hooks/usePalette'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {LLM_API_KEY, LLM_BASE_URL} from '#/lib/llm-feed/env'
import {AIFeedAPIRuntimeCreator} from '#/lib/llm-feed/feed-api-runtime-creators/AIFeedAPIRuntimeCreator'
import {PersonalityUpdater} from '#/lib/llm-feed/personality-updater'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useAgent} from '#/state/session'
import {Button} from '#/view/com/util/forms/Button'
import {Text} from '#/view/com/util/text/Text'
import * as Toast from '#/view/com/util/Toast'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {ScrollView} from '#/view/com/util/Views'
import {atoms as a, useTheme} from '#/alf'

const ASYNC_STORAGE_KEY = 'llm_personality_preference'
const AUTOUPDATE_ENABLED_KEY = 'llm_personality_autoupdate_enabled'
const LLM_API_KEY_STORAGE_KEY = 'llm_api_key'
const LLM_BASE_URL_STORAGE_KEY = 'llm_base_url'
const LLM_MODEL_NAME_STORAGE_KEY = 'llm_model_name'
const DEFAULT_PERSONALITY =
  'Interested in a variety of topics including technology, science, art, and culture.'
const DEFAULT_MODEL_NAME = 'mistralai/Mistral-Small-24B-Instruct-2501'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'PersonalitySettings'
>
export function PersonalitySettingsScreen({}: Props) {
  const pal = usePalette('default')
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const {isMobile} = useWebMediaQueries()
  const [personality, setPersonality] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isManualUpdating, setIsManualUpdating] = useState(false)
  const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(true)
  const [llmApiKey, setLlmApiKey] = useState<string>('')
  const [llmBaseUrl, setLlmBaseUrl] = useState<string>('')
  const [llmModelName, setLlmModelName] = useState<string>('')
  const [isApiKeyRevealed, setIsApiKeyRevealed] = useState(false)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const storedPersonality = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)
      setPersonality(storedPersonality || DEFAULT_PERSONALITY)

      const storedAutoUpdate = await AsyncStorage.getItem(
        AUTOUPDATE_ENABLED_KEY,
      )
      setIsAutoUpdateEnabled(storedAutoUpdate !== 'false')

      const storedApiKey = await AsyncStorage.getItem(LLM_API_KEY_STORAGE_KEY)
      setLlmApiKey(storedApiKey || LLM_API_KEY || '')

      const storedBaseUrl = await AsyncStorage.getItem(LLM_BASE_URL_STORAGE_KEY)
      setLlmBaseUrl(storedBaseUrl || LLM_BASE_URL || '')

      const storedModelName = await AsyncStorage.getItem(
        LLM_MODEL_NAME_STORAGE_KEY,
      )
      setLlmModelName(storedModelName || DEFAULT_MODEL_NAME)
    } catch (e) {
      logger.error('Failed to load personality settings', {message: e})
      setPersonality(DEFAULT_PERSONALITY)
      setIsAutoUpdateEnabled(true)
      setLlmApiKey(LLM_API_KEY || '')
      setLlmBaseUrl(LLM_BASE_URL || '')
      setLlmModelName(DEFAULT_MODEL_NAME)
      Toast.show(_(msg`Failed to load your preferences.`), 'xmark')
    } finally {
      setIsLoading(false)
    }
  }, [_])

  const saveSettings = useCallback(async () => {
    setIsSaving(true)
    try {
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, personality)
      await AsyncStorage.setItem(LLM_API_KEY_STORAGE_KEY, llmApiKey)
      await AsyncStorage.setItem(LLM_BASE_URL_STORAGE_KEY, llmBaseUrl)
      await AsyncStorage.setItem(LLM_MODEL_NAME_STORAGE_KEY, llmModelName)

      // Clear the AI feed cache to force reload with new settings
      AIFeedAPIRuntimeCreator.getInstance().clearCache()

      Toast.show(_(msg`Settings saved`))
    } catch (e) {
      logger.error('Failed to save settings', {message: e})
      Toast.show(_(msg`Failed to save your settings.`), 'xmark')
    } finally {
      setIsSaving(false)
    }
  }, [_, personality, llmApiKey, llmBaseUrl, llmModelName])

  const handleManualUpdate = useCallback(async () => {
    if (!agent?.session) {
      Toast.show(
        _(msg`You must be logged in to update personality automatically.`),
      )
      return
    }
    if (!llmApiKey || !llmBaseUrl) {
      logger.error(
        'Manual Personality Update: LLM API Key or Base URL missing.',
      )
      Toast.show(_(msg`Please configure LLM API settings first.`))
      return
    }

    setIsManualUpdating(true)
    Toast.show(_(msg`Updating personality based on recent activity...`))
    try {
      const updater = new PersonalityUpdater(llmApiKey, llmBaseUrl, agent)
      await updater.updatePersonality()
      Toast.show(_(msg`Personality updated successfully!`))
      await loadSettings()
    } catch (e) {
      logger.error('Failed to manually update personality', {message: e})
      Toast.show(_(msg`Failed to update personality.`), 'xmark')
    } finally {
      setIsManualUpdating(false)
    }
  }, [agent, _, loadSettings, llmApiKey, llmBaseUrl])

  const handleToggleAutoUpdate = useCallback(
    async (newValue: boolean) => {
      setIsAutoUpdateEnabled(newValue)
      try {
        await AsyncStorage.setItem(AUTOUPDATE_ENABLED_KEY, String(newValue))
        Toast.show(_(msg`Automatic update preference saved.`))
      } catch (e) {
        logger.error('Failed to save auto-update preference', {message: e})
        Toast.show(_(msg`Failed to save your preference.`), 'xmark')
        setIsAutoUpdateEnabled(!newValue)
      }
    },
    [_],
  )

  useFocusEffect(
    useCallback(() => {
      loadSettings()
    }, [loadSettings]),
  )

  return (
    <View style={[a.flex_1]}>
      <ViewHeader title={_(msg`LLM Personality`)} showBorder />
      <ScrollView
        style={[a.flex_1, isMobile ? a.px_lg : a.px_xl, a.pb_xl]}
        contentContainerStyle={[!isMobile && a.align_center]}
        scrollIndicatorInsets={{right: 1}}>
        <View
          style={[a.gap_lg, a.py_lg, !isMobile && [a.w_full, {maxWidth: 600}]]}>
          <Text style={[t.atoms.text_contrast_medium]}>
            <Trans>
              Configure the default personality description used when generating
              LLM-based feeds. This helps tailor the content suggestions.
            </Trans>
          </Text>
          <View style={a.gap_sm}>
            <Text style={[a.pb_xs, a.font_bold, t.atoms.text]}>
              <Trans>Personality Description</Trans>
            </Text>
            <TextInput
              style={[
                a.border,
                a.rounded_md,
                a.p_md,
                {minHeight: 120, textAlignVertical: 'top'},
                t.atoms.border_contrast_medium,
                t.atoms.text,
                pal.view,
                (isLoading || isSaving || isManualUpdating) && {opacity: 0.6},
              ]}
              value={personality}
              onChangeText={setPersonality}
              placeholder={DEFAULT_PERSONALITY}
              placeholderTextColor={pal.textLight.color}
              editable={!isLoading && !isSaving && !isManualUpdating}
              multiline={true}
              numberOfLines={6}
              accessibilityLabel={_(
                msg`Describe your interests and personality`,
              )}
              accessibilityHint={_(msg`Input field for LLM personality`)}
            />
          </View>
          <View
            style={[
              a.gap_md,
              a.border_t,
              a.pt_lg,
              t.atoms.border_contrast_low,
            ]}>
            <Text style={[a.font_bold, a.text_lg, t.atoms.text]}>
              <Trans>Automatic Updates</Trans>
            </Text>
            <View style={[a.flex_row, a.align_center, a.justify_between]}>
              <View style={{flexShrink: 1}}>
                <Text style={[a.font_bold, t.atoms.text]}>
                  <Trans>Enable automatic updates</Trans>
                </Text>
                <Text style={[t.atoms.text_contrast_medium]}>
                  <Trans>
                    Periodically update personality based on your activity.
                  </Trans>
                </Text>
              </View>
              <Switch
                value={isAutoUpdateEnabled}
                onValueChange={handleToggleAutoUpdate}
                disabled={isLoading}
                thumbColor={t.palette.primary_50}
                trackColor={{
                  false: t.palette.contrast_200,
                  true: t.palette.primary_500,
                }}
              />
            </View>
            <View
              style={[a.flex_row, a.justify_start, a.gap_md, a.align_center]}>
              <Button
                type="default"
                label={_(msg`Update Now`)}
                onPress={handleManualUpdate}
                disabled={isManualUpdating || isLoading}
              />
              {isManualUpdating && (
                <ActivityIndicator color={t.palette.primary_500} />
              )}
            </View>
          </View>
          <View
            style={[
              a.gap_md,
              a.border_t,
              a.pt_lg,
              t.atoms.border_contrast_low,
            ]}>
            <Text style={[a.font_bold, a.text_lg, t.atoms.text]}>
              <Trans>LLM Configuration</Trans>
            </Text>
            <View style={a.gap_sm}>
              <Text style={[a.pb_xs, a.font_bold, t.atoms.text]}>
                <Trans>API Key</Trans>
              </Text>
              <TextInput
                style={[
                  a.border,
                  a.rounded_md,
                  a.p_md,
                  t.atoms.border_contrast_medium,
                  t.atoms.text,
                  pal.view,
                  (isLoading || isSaving) && {opacity: 0.6},
                ]}
                value={llmApiKey}
                onChangeText={setLlmApiKey}
                placeholder="Enter your LLM API key"
                placeholderTextColor={pal.textLight.color}
                editable={!isLoading && !isSaving}
                secureTextEntry={!isApiKeyRevealed}
                accessibilityLabel={_(msg`LLM API Key`)}
                accessibilityHint={_(msg`Input field for LLM API key`)}
              />
              <TouchableOpacity
                onPress={() => setIsApiKeyRevealed(!isApiKeyRevealed)}
                style={[a.flex_row, a.justify_end, a.gap_sm]}
                accessibilityLabel={
                  isApiKeyRevealed
                    ? _(msg`Hide API key`)
                    : _(msg`Reveal API key`)
                }
                accessibilityHint={
                  isApiKeyRevealed
                    ? _(msg`Press to hide the API key`)
                    : _(msg`Press to reveal the API key`)
                }>
                <Text style={[t.atoms.text_contrast_medium]}>
                  {isApiKeyRevealed ? _(msg`Hide`) : _(msg`Reveal`)}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={a.gap_sm}>
              <Text style={[a.pb_xs, a.font_bold, t.atoms.text]}>
                <Trans>Base URL</Trans>
              </Text>
              <TextInput
                style={[
                  a.border,
                  a.rounded_md,
                  a.p_md,
                  t.atoms.border_contrast_medium,
                  t.atoms.text,
                  pal.view,
                  (isLoading || isSaving) && {opacity: 0.6},
                ]}
                value={llmBaseUrl}
                onChangeText={setLlmBaseUrl}
                placeholder="https://api.deepinfra.com/v1/openai"
                placeholderTextColor={pal.textLight.color}
                editable={!isLoading && !isSaving}
                accessibilityLabel={_(msg`LLM Base URL`)}
                accessibilityHint={_(msg`Input field for LLM API base URL`)}
              />
            </View>
            <View style={a.gap_sm}>
              <Text style={[a.pb_xs, a.font_bold, t.atoms.text]}>
                <Trans>Model Name</Trans>
              </Text>
              <TextInput
                style={[
                  a.border,
                  a.rounded_md,
                  a.p_md,
                  t.atoms.border_contrast_medium,
                  t.atoms.text,
                  pal.view,
                  (isLoading || isSaving) && {opacity: 0.6},
                ]}
                value={llmModelName}
                onChangeText={setLlmModelName}
                placeholder={DEFAULT_MODEL_NAME}
                placeholderTextColor={pal.textLight.color}
                editable={!isLoading && !isSaving}
                accessibilityLabel={_(msg`LLM Model Name`)}
                accessibilityHint={_(msg`Input field for LLM model name`)}
              />
            </View>
          </View>
          <View style={[a.flex_row, a.justify_end, a.pt_xl]}>
            <Button
              type="primary"
              label={_(msg`Save Settings`)}
              onPress={saveSettings}
              disabled={isSaving || isLoading || isManualUpdating}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
