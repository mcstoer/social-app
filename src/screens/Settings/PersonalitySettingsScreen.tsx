import React, {useState, useEffect, useCallback} from 'react'
import {View, TextInput, Switch, ActivityIndicator} from 'react-native'
import {useFocusEffect} from '@react-navigation/native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {usePalette} from '#/lib/hooks/usePalette'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {CommonNavigatorParams, NativeStackScreenProps} from '#/lib/routes/types'
import {logger} from '#/logger'
import {ScrollView} from '#/view/com/util/Views'
import {ViewHeader} from '#/view/com/util/ViewHeader'
import {Text} from '#/view/com/util/text/Text'
import {Button} from '#/view/com/util/forms/Button'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme, tokens} from '#/alf'
import {useAgent} from '#/state/session'
import {PersonalityUpdater} from '#/lib/llm-feed/personality-updater'
import {LLM_API_KEY, LLM_BASE_URL} from '#/lib/llm-feed/env'

const ASYNC_STORAGE_KEY = 'llm_personality_preference'
const AUTOUPDATE_ENABLED_KEY = 'llm_personality_autoupdate_enabled'
const DEFAULT_PERSONALITY =
  'Interested in a variety of topics including technology, science, art, and culture.'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PersonalitySettings'>
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

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    try {
      const storedPersonality = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)
      setPersonality(storedPersonality || DEFAULT_PERSONALITY)

      const storedAutoUpdate = await AsyncStorage.getItem(AUTOUPDATE_ENABLED_KEY)
      setIsAutoUpdateEnabled(storedAutoUpdate !== 'false')
    } catch (e) {
      logger.error('Failed to load personality settings', {message: e})
      setPersonality(DEFAULT_PERSONALITY)
      setIsAutoUpdateEnabled(true)
      Toast.show(_(msg`Failed to load your preferences.`), 'xmark')
    } finally {
      setIsLoading(false)
    }
  }, [_])

  const savePersonality = useCallback(async () => {
    setIsSaving(true)
    try {
      await AsyncStorage.setItem(ASYNC_STORAGE_KEY, personality)
      Toast.show(_(msg`Preference saved`))
    } catch (e) {
      logger.error('Failed to save personality setting', {message: e})
      Toast.show(_(msg`Failed to save your preference.`), 'xmark')
    } finally {
      setIsSaving(false)
    }
  }, [_, personality])

  const handleManualUpdate = useCallback(async () => {
    if (!agent?.session) {
      Toast.show(_(msg`You must be logged in to update personality automatically.`))
      return
    }
    if (!LLM_API_KEY || !LLM_BASE_URL) {
      logger.error('Manual Personality Update: LLM API Key or Base URL missing.')
      Toast.show(_(msg`Configuration error. Cannot update personality.`))
      return
    }

    setIsManualUpdating(true)
    Toast.show(_(msg`Updating personality based on recent activity...`))
    try {
      const updater = new PersonalityUpdater(LLM_API_KEY, LLM_BASE_URL, agent)
      await updater.updatePersonality()
      Toast.show(_(msg`Personality updated successfully!`))
      await loadSettings()
    } catch (e) {
      logger.error('Failed to manually update personality', {message: e})
      Toast.show(_(msg`Failed to update personality.`), 'xmark')
    } finally {
      setIsManualUpdating(false)
    }
  }, [agent, _, loadSettings])

  const handleToggleAutoUpdate = useCallback(async (newValue: boolean) => {
    setIsAutoUpdateEnabled(newValue)
    try {
      await AsyncStorage.setItem(AUTOUPDATE_ENABLED_KEY, String(newValue))
      Toast.show(_(msg`Automatic update preference saved.`))
    } catch (e) {
      logger.error('Failed to save auto-update preference', {message: e})
      Toast.show(_(msg`Failed to save your preference.`), 'xmark')
      setIsAutoUpdateEnabled(!newValue)
    }
  }, [_])

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
          style={[
            a.gap_lg,
            a.py_lg,
            !isMobile && [a.w_full, {maxWidth: 600}],
          ]}>
          <Text style={[t.atoms.text_contrast_medium]}>
            <Trans>
              Configure the default personality description used when generating
              LLM-based feeds. This helps tailor the content suggestions.
            </Trans>
          </Text>
          <View style={a.gap_sm}>
            <Text style={[a.pb_xs, a.font_bold]}>
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
              accessibilityLabel={_(msg`Describe your interests and personality`)}
              accessibilityHint={_(msg`Input field for LLM personality`)}
            />
            <View style={[a.flex_row, a.justify_end]}>
              <Button
                type="primary"
                label={_(msg`Save Manual Changes`)}
                onPress={savePersonality}
                disabled={isSaving || isLoading || isManualUpdating}
              />
            </View>
          </View>
          <View style={[a.gap_md, a.border_t, a.pt_lg, t.atoms.border_contrast_low]}>
            <Text style={[a.font_bold, a.text_lg]}>
              <Trans>Automatic Updates</Trans>
            </Text>
            <View style={[a.flex_row, a.align_center, a.justify_between]}>
              <View style={{flexShrink: 1}}>
                <Text style={[a.font_bold]}>
                  <Trans>Enable automatic updates</Trans>
                </Text>
                <Text style={[t.atoms.text_contrast_medium]}>
                  <Trans>Periodically update personality based on your activity.</Trans>
                </Text>
              </View>
              <Switch
                value={isAutoUpdateEnabled}
                onValueChange={handleToggleAutoUpdate}
                disabled={isLoading}
                thumbColor={t.palette.primary_50}
                trackColor={{false: t.palette.contrast_200, true: t.palette.primary_500}}
              />
            </View>
            <View style={[a.flex_row, a.justify_start, a.gap_md, a.align_center]}>
              <Button
                type="default"
                label={_(msg`Update Now`)}
                onPress={handleManualUpdate}
                disabled={isManualUpdating || isLoading}
              />
              {isManualUpdating && <ActivityIndicator color={t.palette.primary_500} />}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
