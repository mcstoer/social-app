import {FeedDescriptor} from '#/state/queries/post-feed'
import {navigate} from '#/Navigation'

/**
 * Create and navigate to an LLM-curated feed based on a source feed
 * 
 * @param sourceFeedUri The URI of the feed to be curated by the LLM
 * @param displayName Optional display name for the curated feed
 */
export function createAndViewLLMCuratedFeed(
  sourceFeedUri: string,
  displayName?: string
): void {
  // Create the LLM feed descriptor
  const llmFeedDescriptor: FeedDescriptor = `llm-curated|${sourceFeedUri}`
  
  // Navigate to the custom feed screen with the LLM-curated feed
  navigate('CustomFeed', {
    name: displayName ? `${displayName} (AI Curated)` : 'AI Curated Feed',
    feed: llmFeedDescriptor
  })
}