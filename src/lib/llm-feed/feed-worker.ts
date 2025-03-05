import {FeedCurator} from './feed-curator'
import {UserProfile} from './types'
import {AppBskyFeedDefs} from '@atproto/api'

// Define message types for worker communication
export type WorkerRequest = {
  type: 'CURATE_FEED'
  rawPosts: string[]
  profile: UserProfile
  apiKey: string
  baseURL: string
}

export type WorkerResponse = {
  type: 'FEED_CURATED'
  curatedFeed: string[]
  feedId: string
} | {
  type: 'ERROR'
  error: string
}

// Create a web worker context
const ctx: Worker = self as any

// Process messages from the main thread
ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const {type, rawPosts, profile, apiKey, baseURL} = event.data
  
  if (type === 'CURATE_FEED') {
    try {
      // Create feed curator instance
      const feedCurator = new FeedCurator(apiKey, baseURL)
      
      // Process the raw posts to create a curated feed
      const result = await feedCurator.curateFeed(
        profile.subscriptions,
        rawPosts,
        profile.personality,
        profile.languages
      )
      
      // Generate a unique feed ID
      const feedId = `llm-curated-${Date.now()}`
      
      // Send the curated feed back to the main thread
      ctx.postMessage({
        type: 'FEED_CURATED',
        curatedFeed: result,
        feedId
      })
    } catch (error) {
      // Handle any errors
      ctx.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
})

export default {} as typeof Worker & { new(): Worker }