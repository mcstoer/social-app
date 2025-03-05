import React from 'react'
import {StyleSheet, TouchableOpacity, View, Text, ActivityIndicator} from 'react-native'
import {useNavigation} from '@react-navigation/native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {FeedDescriptor} from '#/state/queries/post-feed'
import {AppBskyActorDefs} from '@atproto/api'
import {s, colors} from '#/lib/styles'
import {useTheme} from '#/alf'
import {logger} from '#/logger'
import {isWeb} from '#/platform/detection'
import {CogIcon} from '#/lib/icons'

interface LLMCurateFeedButtonProps {
  feed: FeedDescriptor
  savedFeed?: AppBskyActorDefs.SavedFeed
}

export function LLMCurateFeedButton({feed, savedFeed}: LLMCurateFeedButtonProps) {
  const {_} = useLingui()
  const theme = useTheme()
  const navigation = useNavigation()
  const [isCreating, setIsCreating] = React.useState(false)
  
  // Only allow curation of feedgen type feeds
  const canCurate = feed.startsWith('feedgen')
  const feedUri = feed.split('|')[1]
  
  const handleCreateLLMFeed = React.useCallback(() => {
    if (isCreating || !canCurate) return
    
    setIsCreating(true)
    
    try {
      // Import the helper function
      const {createAndViewLLMCuratedFeed} = require('#/lib/llm-feed/create-llm-feed')
      
      // Create and navigate to the LLM-curated feed
      // Use the feed URI as fallback if no name is provided
      createAndViewLLMCuratedFeed(feedUri, feedUri.split('/').pop() || '')
      
      setTimeout(() => {
        setIsCreating(false)
      }, 1000)
    } catch (error) {
      logger.error('Failed to create LLM curated feed', {error})
      setIsCreating(false)
    }
  }, [feedUri, savedFeed, isCreating, canCurate])
  
  if (!canCurate) return null
  
  return (
    <TouchableOpacity
      style={[styles.button, {backgroundColor: theme.palette.white}]}
      onPress={handleCreateLLMFeed}
      disabled={isCreating}>
      {isCreating ? (
        <ActivityIndicator size="small" color={theme.palette.primary_500} />
      ) : (
        <View style={styles.buttonContent}>
          <Text style={[styles.buttonText, {color: theme.palette.primary_500}]}>
            {_(msg`AI Curate`)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    padding: 8,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray2,
    minWidth: 110,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  }
})