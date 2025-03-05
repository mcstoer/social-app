import React from 'react'
import {NativeStackScreenProps} from '@react-navigation/native-stack'
import {StyleSheet, View, useWindowDimensions} from 'react-native'
import {useFocusEffect, useIsFocused, useNavigation} from '@react-navigation/native'

import {FeedDescriptor} from '#/state/queries/post-feed'
import {AllNavigatorParams} from '#/lib/routes/types'
import {useSetMinimalShellMode} from '#/state/shell'
import {PostFeed} from '#/view/com/posts/PostFeed'
import {MainScrollProvider} from '#/view/com/util/MainScrollProvider'
import {useTheme} from '#/alf'
import {EmptyState} from '#/view/com/util/EmptyState'
import {useSetTitle} from '#/lib/hooks/useSetTitle'
import * as Layout from '#/components/Layout'
import {FeedFeedbackProvider, useFeedFeedback} from '#/state/feed-feedback'
import {useHeaderOffset} from '#/components/hooks/useHeaderOffset'
import {ComposeIcon2} from '#/lib/icons'
import {FAB} from '#/view/com/util/fab/FAB'
import {LoadLatestBtn} from '#/view/com/util/load-latest/LoadLatestBtn'
import {useComposerControls} from '#/state/shell/composer'
import {isWeb, isNative} from '#/platform/detection'
import {useSession} from '#/state/session'

type Props = NativeStackScreenProps<AllNavigatorParams, 'CustomFeed'>

export function CustomFeedScreen({route}: Props) {
  const setMinimalShellMode = useSetMinimalShellMode()
  const theme = useTheme()
  const {openComposer} = useComposerControls()
  const headerOffset = useHeaderOffset()
  const navigation = useNavigation()
  const {currentAccount, hasSession} = useSession()
  const {width: screenWidth} = useWindowDimensions()
  const isMobile = screenWidth < 768
  
  const feedName = route.params?.name || 'Custom Feed'
  const feed = route.params?.feed as FeedDescriptor
  
  // For FAB
  const isFocused = useIsFocused()
  
  // Create the feed feedback hooks
  const feedFeedback = useFeedFeedback(feed, hasSession)
  
  useSetTitle(feedName)
  
  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
      return () => {}
    }, [setMinimalShellMode]),
  )
  
  const renderEmptyState = React.useCallback(() => {
    if (feed.startsWith('llm-curated')) {
      return (
        <EmptyState
          icon="growth"
          message="AI is processing your feed. The LLM is currently analyzing and curating posts based on your interests. This may take a moment."
        />
      )
    }
    return (
      <EmptyState
        icon="user-group"
        message="No posts found in this feed"
      />
    )
  }, [feed])
  
  return (
    <FeedFeedbackProvider value={feedFeedback}>
      <Layout.Screen 
        testID="CustomFeedScreen" 
        style={styles.container}>
        <View style={[styles.feed, theme.atoms.bg]}>
          <MainScrollProvider>
            <PostFeed
              testID="customFeed"
              feed={feed}
              renderEmptyState={renderEmptyState}
              enabled={true}
              isPageFocused={isFocused}
              isPageAdjacent={false}
            />
          </MainScrollProvider>
          {isNative ? (
            <>
              <LoadLatestBtn
                testID="loadLatestBtn"
                onPress={() => {}}
                style={{top: headerOffset + 10}}
              />
              {isFocused && currentAccount && (
                <FAB 
                  testID="composeFAB"
                  onPress={() => {
                    openComposer({})
                  }}
                  icon={<ComposeIcon2 size={24} style={{color: 'white'}} />}
                  accessibilityRole="button"
                  accessibilityLabel="New post"
                  accessibilityHint="Composes a new post"
                />
              )}
            </>
          ) : null}
        </View>
      </Layout.Screen>
    </FeedFeedbackProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feed: {
    flex: 1,
  },
})