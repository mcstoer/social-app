import React, {useState, useEffect, useCallback} from 'react'
import {View, TextInput} from 'react-native'
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
import {atoms as a, useTheme} from '#/alf'

const ASYNC_STORAGE_KEY = 'llm_personality_preference'
// Default personality description if none is provided or fetched
const DEFAULT_PERSONALITY =
  'Interested in a variety of topics including technology, science, art, and culture.'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PersonalitySettings'>
export function PersonalitySettingsScreen({}: Props) {
  const pal = usePalette('default')
  const {_} = useLingui()
  const t = useTheme()
  const {isMobile} = useWebMediaQueries()
  const [personality, setPersonality] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadPersonality = useCallback(async () => {
    setIsLoading(true)
    try {
      const storedPersonality = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)
      setPersonality(storedPersonality || DEFAULT_PERSONALITY)
    } catch (e) {
      logger.error('Failed to load personality setting', {message: e})
      setPersonality(DEFAULT_PERSONALITY) // Fallback on error
      Toast.show(_(msg`Failed to load your preference.`), 'xmark')
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

  useFocusEffect(
    useCallback(() => {
      loadPersonality()
    }, [loadPersonality]),
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
            a.gap_md,
            a.py_lg,
            !isMobile && [a.w_full, {maxWidth: 600}],
          ]}>
          <Text style={[t.atoms.text_contrast_medium]}>
            <Trans>
              Configure the default personality description used when generating
              LLM-based feeds. This helps tailor the content suggestions.
            </Trans>
          </Text>
          <View>
            <Text style={[a.pb_xs, a.font_bold, {color: 'white'}]}>
              <Trans>Personality Description</Trans>
            </Text>
            <TextInput
              style={[
                a.border,
                a.rounded_md,
                a.p_md,
                t.atoms.border_contrast_medium,
                t.atoms.text,
                pal.view,
                {minHeight: 100},
              ]}
              value={personality}
              onChangeText={setPersonality}
              placeholder={DEFAULT_PERSONALITY}
              placeholderTextColor={pal.textLight.color}
              editable={!isLoading}
              multiline={true}
              scrollEnabled={true}
              accessibilityLabel={_(msg`Describe your interests and personality`)}
              accessibilityHint={_(msg`Input field for LLM personality`)}
            />
          </View>
          <View style={[a.flex_row, a.justify_end]}>
            <Button
              type="primary"
              label={_(msg`Save`)}
              onPress={savePersonality}
              disabled={isSaving || isLoading}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
