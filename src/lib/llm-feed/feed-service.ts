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

// DEBUG FLAG: Set to true to bypass web workers and use direct curation
// This helps isolate issues by avoiding web worker complications
const DEBUG_BYPASS_WORKER = true

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
    console.log('FEED SERVICE - Web Worker support check:', {
      isWeb: isWeb,
      workersSupported: typeof Worker !== 'undefined',
      workerConstructible: typeof Worker === 'function',
      debugBypassEnabled: DEBUG_BYPASS_WORKER
    });
    
    if (DEBUG_BYPASS_WORKER) {
      console.log('FEED SERVICE - DEBUG MODE: Bypassing web worker, using direct curation');
      this.worker = null;
      this.curator = new FeedCurator(LLM_API_KEY, LLM_BASE_URL);
      return;
    }
    
    if (isWeb) {
      try {
        console.log('FEED SERVICE - Initializing web worker...');
        // In web environment, use a web worker
        const workerUrl = new URL('./feed-worker.ts', import.meta.url)
        this.worker = new Worker(workerUrl, {type: 'module'})
        
        this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          console.log('FEED SERVICE - Received message from worker');
          const response = event.data
          console.log('FEED SERVICE - Worker response type:', response.type);
          
          // Handle debug logs from worker
          if (response.type === 'DEBUG_LOG') {
            console.log('WORKER LOG:', response.message);
            return; // Just log and return, no other processing needed
          }
          
          // Handle logs in any response
          if ('logs' in response && response.logs && response.logs.length > 0) {
            console.log('FEED SERVICE - Worker logs:');
            response.logs.forEach(log => {
              console.log(log);
            });
          }
          
          if (response.type === 'FEED_CURATED') {
            console.log('FEED SERVICE - Received FEED_CURATED response:', {
              feedId: response.feedId,
              curatedFeedCount: response.curatedFeed.length
            });
            
            // Log sample of received curated posts
            if (response.curatedFeed.length > 0) {
              console.log('FEED SERVICE - Curated posts from worker (first 3):');
              response.curatedFeed.slice(0, 3).forEach((post, idx) => {
                console.log(`WORKER POST ${idx+1}:\n${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
              });
            } else {
              console.warn('FEED SERVICE - Worker returned 0 curated posts!');
            }
            
            // Cache the curated feed
            this.feedCache.set(response.feedId, {
              posts: response.curatedFeed,
              timestamp: Date.now()
            })
            console.log('FEED SERVICE - Cached worker feed with ID:', response.feedId);
            
            // Emit the feed updated event
            console.log('FEED SERVICE - Emitting feed-updated event with', response.curatedFeed.length, 'posts');
            this.events.emit('feed-updated', response.feedId, response.curatedFeed)
            
            this.setProcessing(false)
            console.log('FEED SERVICE - Processing complete, set to false');
          } else if (response.type === 'ERROR') {
            console.error('FEED SERVICE - Feed curation error from worker:', response.error)
            this.events.emit('feed-error', response.error)
            this.setProcessing(false)
            console.log('FEED SERVICE - Processing set to false due to error');
          }
        }
        
        this.worker.onerror = (error) => {
          console.error('FEED SERVICE - Worker error:', error)
          console.error('FEED SERVICE - Worker error details:', {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno
          });
          this.events.emit('feed-error', error.message)
          this.setProcessing(false)
          console.log('FEED SERVICE - Processing set to false due to worker error');
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
    console.log('===== FEED SERVICE: CURATION STARTED =====');
    console.log('FEED SERVICE - Raw posts received:', rawPosts.length);
    console.log('FEED SERVICE - User profile:', JSON.stringify(profile, null, 2));
    
    // Log sample of raw posts with rich metadata
    console.log('FEED SERVICE - Raw posts sample:');
    rawPosts.slice(0, 3).forEach((post, idx) => {
      const author = post.post.author;
      const record = post.post.record as AppBskyFeedPost.Record;
      console.log(`POST ${idx+1}:`);
      console.log(`- Author: @${author.handle} (${author.displayName || 'No display name'})`);
      console.log(`- Post URI: ${post.post.uri}`);
      console.log(`- Text: ${record.text}`);
      console.log(`- Has media: ${!!post.post.embed}`);
      console.log(`- Likes: ${post.post.likeCount || 0}`);
      console.log(`- Reposts: ${post.post.repostCount || 0}`);
      console.log('---');
    });
    
    if (this.isProcessing) {
      console.log('FEED SERVICE ERROR - Feed curation already in progress');
      throw new Error('Feed curation already in progress')
    }
    
    // Extract post text from the feed posts
    console.log('FEED SERVICE - Extracting post text for curation...');
    const postTexts = rawPosts.map(post => {
      const record = post.post.record as AppBskyFeedPost.Record
      return record.text
    })
    
    // Generate a feed ID based on the user profile
    const feedId = `llm-feed-${profile.name}-${Date.now()}`
    console.log('FEED SERVICE - Generated feed ID:', feedId);
    
    // Check if we have a cached feed that's still valid
    const cachedFeed = this.feedCache.get(feedId)
    if (cachedFeed && (Date.now() - cachedFeed.timestamp < FEED_CACHE_EXPIRY)) {
      console.log('FEED SERVICE - Using cached feed:', {
        feedId,
        postsCount: cachedFeed.posts.length,
        cacheAge: Math.round((Date.now() - cachedFeed.timestamp) / 1000) + ' seconds'
      });
      return feedId
    }
    
    this.setProcessing(true)
    console.log('FEED SERVICE - Processing state set to true');
    
    // Use web worker if available, otherwise use direct approach
    if (this.worker) {
      console.log('FEED SERVICE - Using web worker for processing');
      const request: WorkerRequest = {
        type: 'CURATE_FEED',
        rawPosts: postTexts,
        profile,
        apiKey: LLM_API_KEY,
        baseURL: LLM_BASE_URL
      }
      
      console.log('FEED SERVICE - Sending request to worker:', {
        type: request.type,
        postsCount: request.rawPosts.length,
        profileName: request.profile.name,
        hasApiKey: !!request.apiKey,
      });
      
      this.worker.postMessage(request)
      console.log('FEED SERVICE - Request sent to worker, returning feed ID for client');
      return feedId
    } else if (this.curator) {
      console.log('FEED SERVICE - Using direct curation (no worker)');
      try {
        console.log('FEED SERVICE - Calling curator with profile:', {
          name: profile.name,
          subscriptions: profile.subscriptions.length,
          postTexts: postTexts.length,
        });
        
        const curatedFeed = await this.curator.curateFeed(
          profile.subscriptions,
          postTexts,
          profile.personality,
          profile.languages
        )
        
        console.log('FEED SERVICE - Curator returned', curatedFeed.length, 'posts');
        
        // Cache the result
        this.feedCache.set(feedId, {
          posts: curatedFeed,
          timestamp: Date.now()
        })
        console.log('FEED SERVICE - Results cached with ID:', feedId);
        
        // Emit feed updated event
        this.events.emit('feed-updated', feedId, curatedFeed)
        console.log('FEED SERVICE - Emitted feed-updated event with', curatedFeed.length, 'posts');
        
        this.setProcessing(false)
        console.log('FEED SERVICE - Processing set to false, curation complete');
        
        console.log('===== FEED SERVICE: CURATION COMPLETED =====');
        return feedId
      } catch (error) {
        console.error('FEED SERVICE ERROR - Curation failed:', error);
        this.setProcessing(false)
        this.events.emit('feed-error', error instanceof Error ? error.message : String(error))
        throw error
      }
    } else {
      console.error('FEED SERVICE ERROR - No curation method available');
      this.setProcessing(false)
      const errorMsg = 'No feed curation method available'
      this.events.emit('feed-error', errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Get a cached feed by ID
  public getCachedFeed(feedId: string): string[] | null {
    console.log('FEED SERVICE - Getting cached feed, ID:', feedId);
    const cached = this.feedCache.get(feedId)
    
    if (!cached) {
      console.log('FEED SERVICE - No cache found for ID:', feedId);
      return null;
    }
    
    const cacheAge = Date.now() - cached.timestamp;
    const isExpired = cacheAge >= FEED_CACHE_EXPIRY;
    
    console.log('FEED SERVICE - Cache info:', {
      feedId,
      postsCount: cached.posts.length,
      cacheAge: Math.round(cacheAge / 1000) + ' seconds',
      isExpired,
      expiryTime: FEED_CACHE_EXPIRY / 1000 + ' seconds'
    });
    
    // Sample of cached posts
    if (cached.posts.length > 0) {
      console.log('FEED SERVICE - Cached posts sample (first 3):');
      cached.posts.slice(0, 3).forEach((post, idx) => {
        console.log(`CACHED POST ${idx+1}:\n${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
      });
    }
    
    if (cached && !isExpired) {
      console.log('FEED SERVICE - Returning valid cached feed with', cached.posts.length, 'posts');
      return cached.posts
    }
    
    console.log('FEED SERVICE - Cache expired, returning null');
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