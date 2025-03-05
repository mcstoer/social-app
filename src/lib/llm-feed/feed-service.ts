import {AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api'
import {WorkerRequest, WorkerResponse} from './feed-worker'
import {isWeb, isNative} from '#/platform/detection'
import {EventEmitter} from 'eventemitter3'
import {FeedCurator} from './feed-curator'
import {UserProfile} from './types'

// Constants
const LLM_API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY || ''
const LLM_BASE_URL = process.env.EXPO_PUBLIC_LLM_BASE_URL || 'https://api.mistral.ai/v1'
const FEED_CACHE_EXPIRY = 1000 * 60 * 15 // 15 minutes

// Feed cache type
interface CachedFeed {
  posts: string[]
  timestamp: number
}

// Event types for the service
export type FeedServiceEvents = {
  'feed-updated': (feedId: string, posts: string[]) => void
  'feed-error': (error: string) => void
  'feed-processing': (isProcessing: boolean) => void
}

class LLMFeedService {
  private worker: Worker | null = null
  private curator: FeedCurator | null = null
  private feedCache: Map<string, CachedFeed> = new Map()
  private isProcessing = false
  private events = new EventEmitter<FeedServiceEvents>()

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    if (isWeb) {
      try {
        // In web environment, use a web worker
        const workerUrl = new URL('./feed-worker.ts', import.meta.url)
        this.worker = new Worker(workerUrl, {type: 'module'})
        
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const response = event.data
          
          if (response.type === 'FEED_CURATED') {
            // Cache the curated feed
            this.feedCache.set(response.feedId, {
              posts: response.curatedFeed,
              timestamp: Date.now()
            })
            
            // Emit the feed updated event
            this.events.emit('feed-updated', response.feedId, response.curatedFeed)
            this.setProcessing(false)
          } else if (response.type === 'ERROR') {
            console.error('Feed curation error:', response.error)
            this.events.emit('feed-error', response.error)
            this.setProcessing(false)
          }
        }
        
        this.worker.onerror = (error) => {
          console.error('Worker error:', error)
          this.events.emit('feed-error', error.message)
          this.setProcessing(false)
        }
      } catch (error) {
        console.error('Failed to initialize web worker:', error)
        // Fallback to direct curation on web if worker fails
        this.curator = new FeedCurator(LLM_API_KEY, LLM_BASE_URL)
      }
    } else {
      // For native, use direct curation
      this.curator = new FeedCurator(LLM_API_KEY, LLM_BASE_URL)
    }
  }

  // Subscribe to feed service events
  public on<E extends keyof FeedServiceEvents>(
    event: E, 
    listener: FeedServiceEvents[E]
  ) {
    this.events.on(event, listener as any)
    return () => this.events.off(event, listener as any)
  }

  private setProcessing(state: boolean) {
    this.isProcessing = state
    this.events.emit('feed-processing', state)
  }

  // Process posts using LLM to create a curated feed
  public async curateFeed(
    rawPosts: AppBskyFeedDefs.FeedViewPost[], 
    profile: UserProfile
  ): Promise<string> {
    if (this.isProcessing) {
      throw new Error('Feed curation already in progress')
    }
    
    // Extract post text from the feed posts
    const postTexts = rawPosts.map(post => {
      const record = post.post.record as AppBskyFeedPost.Record
      return record.text
    })
    
    // Generate a feed ID based on the user profile
    const feedId = `llm-feed-${profile.name}-${Date.now()}`
    
    // Check if we have a cached feed that's still valid
    const cachedFeed = this.feedCache.get(feedId)
    if (cachedFeed && (Date.now() - cachedFeed.timestamp < FEED_CACHE_EXPIRY)) {
      return feedId
    }
    
    this.setProcessing(true)
    
    // Use web worker if available, otherwise use direct approach
    if (this.worker) {
      const request: WorkerRequest = {
        type: 'CURATE_FEED',
        rawPosts: postTexts,
        profile,
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL
      }
      
      this.worker.postMessage(request)
      return feedId
    } else if (this.curator) {
      try {
        const curatedFeed = await this.curator.curateFeed(
          profile.subscriptions,
          postTexts,
          profile.personality,
          profile.languages
        )
        
        // Cache the result
        this.feedCache.set(feedId, {
          posts: curatedFeed,
          timestamp: Date.now()
        })
        
        // Emit feed updated event
        this.events.emit('feed-updated', feedId, curatedFeed)
        this.setProcessing(false)
        
        return feedId
      } catch (error) {
        this.setProcessing(false)
        this.events.emit('feed-error', error instanceof Error ? error.message : String(error))
        throw error
      }
    } else {
      this.setProcessing(false)
      const errorMsg = 'No feed curation method available'
      this.events.emit('feed-error', errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Get a cached feed by ID
  public getCachedFeed(feedId: string): string[] | null {
    const cached = this.feedCache.get(feedId)
    if (cached && (Date.now() - cached.timestamp < FEED_CACHE_EXPIRY)) {
      return cached.posts
    }
    return null
  }

  // Clear specific feed from cache
  public clearFeedCache(feedId: string) {
    this.feedCache.delete(feedId)
  }

  // Clear all cached feeds
  public clearAllCaches() {
    this.feedCache.clear()
  }
}

// Export a singleton instance
export const llmFeedService = new LLMFeedService()