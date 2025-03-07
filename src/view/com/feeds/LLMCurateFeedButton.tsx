import React from 'react'
import {StyleSheet, TouchableOpacity, View, Text, ActivityIndicator, Switch} from 'react-native'
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
  
  // Only allow curation of feedgen type feeds for instant curation
  const canCurate = feed.startsWith('feedgen')
  const feedUri = feed.split('|')[1]
  
  // Import dependencies
  const {llmFeedService} = require('#/lib/llm-feed/feed-service')
  const {useSession} = require('#/state/session')
  const {usePreferencesQuery} = require('#/state/queries/preferences')
  
  // Get agent and preferences from React hooks
  const {agent} = useSession()
  const {data: preferences} = usePreferencesQuery()
  
  // Inject dependencies into the service
  React.useEffect(() => {
    if (agent) {
      console.log('Injecting agent into feed service');
      llmFeedService.setAgent(agent);
    }
  }, [agent]);
  
  React.useEffect(() => {
    if (preferences) {
      console.log('Injecting preferences into feed service');
      llmFeedService.setPreferences(preferences);
    }
  }, [preferences]);
  
  // Check if AI mode is enabled
  const [aiModeEnabled, setAiModeEnabled] = React.useState(() => 
    llmFeedService.isAIModeEnabled()
  )
  
  // Listen for AI mode changes
  React.useEffect(() => {
    const unsubscribe = llmFeedService.on('ai-mode-changed', (enabled) => {
      setAiModeEnabled(enabled)
    })
    return unsubscribe
  }, [])
  
  // Handle toggling AI mode
  const handleToggleAIMode = React.useCallback(() => {
    const newState = !aiModeEnabled
    llmFeedService.setAIMode(newState)
  }, [aiModeEnabled])
  
  // Handle creating a one-time AI-curated feed
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
  }, [feedUri, isCreating, canCurate])
  
  return (
    <View style={styles.container}>
      {/* AI Mode Toggle */}
      <View style={styles.toggleButton}>
        <Text style={[styles.toggleLabel, {color: theme.palette.primary_500}]}>
          {_(msg`AI Mode`)}
        </Text>
        <Switch
          trackColor={{
            false: theme.palette.gray_200,
            true: theme.palette.primary_500
          }}
          thumbColor={theme.palette.white}
          ios_backgroundColor={theme.palette.gray_200}
          onValueChange={handleToggleAIMode}
          value={aiModeEnabled}
        />
      </View>
      
      {/* One-time AI Curation Button */}
      {canCurate && !aiModeEnabled && (
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
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
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
  toggleButton: {
    borderRadius: 16,
    padding: 8,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gray2,
    minWidth: 130,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
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