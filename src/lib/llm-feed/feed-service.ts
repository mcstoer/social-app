import {AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api'
import {WorkerRequest, WorkerResponse} from './feed-worker'
import {isWeb, isNative} from '#/platform/detection'
import {EventEmitter} from 'eventemitter3'
import {FeedCurator} from './feed-curator'
import {UserProfile} from './types'

// Constants
const LLM_API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY || 'YaYRpfI7BiIX0yTac43qMjt0h2XugirD'
const LLM_BASE_URL = process.env.EXPO_PUBLIC_LLM_BASE_URL || 'https://api.deepinfra.com/v1/openai' // TODO !EA -- need to figure out how to set this in the app itself
const FEED_CACHE_EXPIRY = 1000 * 60 * 15 // 15 minutes

// DEBUG FLAG: Set to true to bypass web workers and use direct curation
// This helps isolate issues by avoiding web worker complications
const DEBUG_BYPASS_WORKER = true

// Constants for AI mode
const FEED_BANK_SIZE_LIMIT = 5 // Maximum number of feeds to keep in the bank
const FEED_BANK_EXPIRY = 1000 * 60 * 60 // 1 hour
const AI_MODE_LOOP_INTERVAL = 5000 // 5 seconds

// Feed cache type
interface CachedFeed {
  posts: string[]
  timestamp: number
}

// Feed bank item type
interface FeedBankItem {
  feedId: string
  posts: string[]
  timestamp: number
  consumed: boolean
}

// Event types for the service
export type FeedServiceEvents = {
  'feed-updated': (feedId: string, posts: string[]) => void
  'feed-error': (error: string) => void
  'feed-processing': (isProcessing: boolean) => void
  'ai-mode-changed': (enabled: boolean) => void
  'feed-bank-updated': (feedBank: FeedBankItem[]) => void
}

class LLMFeedService {
  private worker: Worker | null = null
  private curator: FeedCurator | null = null
  private feedCache: Map<string, CachedFeed> = new Map()
  private isProcessing = false
  private events = new EventEmitter<FeedServiceEvents>()
  private aiModeEnabled = false
  private feedBank: FeedBankItem[] = []
  private aiModeLoopTimer: NodeJS.Timeout | null = null
  private seenPostUris = new Set<string>()
  
  // Dependencies that will be injected from React components
  private agent: any = null
  private preferences: any = null
  private dependenciesReady = false

  constructor() {
    this.initWorker()
  }
  
  /**
   * Set the agent dependency
   * Should be called from a React component that has access to the agent
   */
  public setAgent(agent: any) {
    console.log('FEED SERVICE - Agent set:', !!agent);
    this.agent = agent;
    this.checkDependenciesReady();
  }
  
  /**
   * Set the preferences dependency
   * Should be called from a React component that has access to user preferences
   */
  public setPreferences(preferences: any) {
    console.log('FEED SERVICE - Preferences set:', !!preferences);
    this.preferences = preferences;
    this.checkDependenciesReady();
  }
  
  /**
   * Check if all dependencies are ready and update the state
   */
  private checkDependenciesReady() {
    const wasReady = this.dependenciesReady;
    this.dependenciesReady = !!this.agent && !!this.preferences;
    
    console.log('FEED SERVICE - Dependencies ready:', this.dependenciesReady);
    console.log('FEED SERVICE - Agent:', !!this.agent, 'Preferences:', !!this.preferences);
    
    // If we just became ready and AI mode is enabled, start the loop
    if (!wasReady && this.dependenciesReady && this.aiModeEnabled) {
      console.log('FEED SERVICE - Dependencies just became ready with AI mode enabled, starting loop');
      this.startAIModeLoop();
    }
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
  
  // AI Mode methods
  
  /**
   * Enable or disable AI mode
   * When enabled, the service will continuously generate AI-curated feeds
   */
  public setAIMode(enabled: boolean) {
    if (this.aiModeEnabled === enabled) return
    
    console.log(`FEED SERVICE - AI mode ${enabled ? 'enabled' : 'disabled'}`);
    
    // Set the mode flag
    this.aiModeEnabled = enabled
    
    if (enabled) {
      // Only start the loop if dependencies are ready
      if (this.dependenciesReady) {
        console.log('FEED SERVICE - Dependencies ready, starting AI mode loop');
        this.startAIModeLoop()
      } else {
        console.log('FEED SERVICE - Dependencies not ready, AI mode loop will start when dependencies are available');
        console.log('FEED SERVICE - Current dependency state - Agent:', !!this.agent, 'Preferences:', !!this.preferences);
      }
    } else {
      this.stopAIModeLoop()
    }
    
    this.events.emit('ai-mode-changed', enabled)
  }
  
  /**
   * Check if AI mode is enabled
   */
  public isAIModeEnabled(): boolean {
    return this.aiModeEnabled
  }
  
  /**
   * Start the background loop for AI mode
   */
  private startAIModeLoop() {
    if (this.aiModeLoopTimer) {
      clearInterval(this.aiModeLoopTimer)
    }
    
    console.log('FEED SERVICE - Starting AI mode loop');
    
    // Safety check to make sure dependencies are ready
    if (!this.dependenciesReady) {
      console.error('FEED SERVICE - Cannot start AI mode loop: dependencies not ready');
      return;
    }
    
    // Immediately run the loop once
    this.runAIModeLoop()
    
    // Then set up the regular interval
    this.aiModeLoopTimer = setInterval(() => {
      this.runAIModeLoop()
    }, AI_MODE_LOOP_INTERVAL)
  }
  
  /**
   * Stop the background loop for AI mode
   */
  private stopAIModeLoop() {
    console.log('FEED SERVICE - Stopping AI mode loop');
    
    if (this.aiModeLoopTimer) {
      clearInterval(this.aiModeLoopTimer)
      this.aiModeLoopTimer = null
    }
  }
  
  /**
   * The main AI mode loop logic
   * - Checks if the feed bank needs to be replenished
   * - Triggers feed curation if needed
   * - Updates user profile if needed
   */
  private async runAIModeLoop() {
    console.log('===== FEED SERVICE - AI MODE LOOP STARTED =====');
    console.log('FEED SERVICE - AI Mode Enabled:', this.aiModeEnabled);
    console.log('FEED SERVICE - Is Processing:', this.isProcessing);
    console.log('FEED SERVICE - Current Feed Bank Size:', this.feedBank.length);
    console.log('FEED SERVICE - Dependencies Ready:', this.dependenciesReady);
    
    // Triple check that AI mode is enabled and dependencies are ready
    if (!this.aiModeEnabled || !this.dependenciesReady) {
      console.log('FEED SERVICE - AI Mode disabled or dependencies not ready, skipping loop');
      return;
    }
    
    if (this.isProcessing) {
      console.log('FEED SERVICE - Already processing a feed, skipping loop');
      return;
    }
    
    try {
      // Check if we need to add more feeds to the bank
      const needsReplenishment = this.shouldReplenishFeedBank();
      console.log('FEED SERVICE - Feed bank needs replenishment:', needsReplenishment);
      console.log('FEED SERVICE - Valid feeds count:', this.feedBank.filter(feed => !feed.consumed).length);
      
      if (needsReplenishment) {
        console.log('FEED SERVICE - Starting feed bank replenishment process');
        await this.replenishFeedBank();
      } else {
        console.log('FEED SERVICE - Feed bank is adequately stocked, no action needed');
      }
      
      // Future: Update user profile based on recent interactions
      // await this.updateUserProfile()
      
      console.log('===== FEED SERVICE - AI MODE LOOP COMPLETED =====');
    } catch (error) {
      console.error('FEED SERVICE - Error in AI mode loop:', error);
      console.error('FEED SERVICE - Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }
  
  /**
   * Check if the feed bank needs replenishment
   */
  private shouldReplenishFeedBank(): boolean {
    console.log('FEED SERVICE - Checking if feed bank needs replenishment');
    console.log('FEED SERVICE - Current feed bank size before cleaning:', this.feedBank.length);
    
    // Clean expired feeds from the bank
    this.cleanFeedBank()
    
    // Check if we have enough valid feeds
    const validFeeds = this.feedBank.filter(feed => !feed.consumed)
    console.log('FEED SERVICE - Valid feeds after cleaning:', validFeeds.length);
    console.log('FEED SERVICE - Feed bank size limit:', FEED_BANK_SIZE_LIMIT);
    console.log('FEED SERVICE - Needs replenishment?', validFeeds.length < FEED_BANK_SIZE_LIMIT);
    
    return validFeeds.length < FEED_BANK_SIZE_LIMIT
  }
  
  /**
   * Clean expired feeds from the feed bank
   */
  private cleanFeedBank() {
    console.log('FEED SERVICE - Starting feed bank cleaning');
    const now = Date.now()
    const initialLength = this.feedBank.length
    
    // Log each feed's expiration status
    this.feedBank.forEach((feed, index) => {
      const age = now - feed.timestamp;
      const isExpired = age >= FEED_BANK_EXPIRY;
      console.log(`FEED SERVICE - Feed ${index} (${feed.feedId}): age=${Math.round(age/1000)}s, expired=${isExpired}, consumed=${feed.consumed}`);
    });
    
    // Filter out expired feeds
    this.feedBank = this.feedBank.filter(feed => {
      return (now - feed.timestamp) < FEED_BANK_EXPIRY
    })
    
    if (initialLength !== this.feedBank.length) {
      console.log(`FEED SERVICE - Cleaned feed bank, removed ${initialLength - this.feedBank.length} expired feeds`);
      this.events.emit('feed-bank-updated', this.feedBank)
    } else {
      console.log('FEED SERVICE - No expired feeds to remove');
    }
    
    console.log('FEED SERVICE - Feed bank after cleaning:', this.feedBank.length);
  }
  
  /**
   * Replenish the feed bank with a new curated feed
   * This collects posts from multiple feeds and creates an AI-curated feed
   */
  private async replenishFeedBank() {
    console.log('===== FEED SERVICE - REPLENISH FEED BANK STARTED =====');
    
    if (this.isProcessing) {
      console.log('FEED SERVICE - Feed curation already in progress, skipping replenishment');
      return;
    }
    
    // Safety check for dependencies - should never happen since we check in runAIModeLoop
    if (!this.dependenciesReady || !this.agent || !this.preferences) {
      console.error('FEED SERVICE - Dependencies not ready, cannot replenish feed bank');
      return;
    }
    
    try {
      console.log('FEED SERVICE - Starting feed bank replenishment');
      
      // Check if agent has an active session
      const hasSession = this.agent && this.agent.session;
      console.log('FEED SERVICE - Agent has session:', !!hasSession);
      
      if (!hasSession) {
        console.error('FEED SERVICE - No active session, cannot replenish feed bank');
        return;
      }
      
      // Collect posts from random feeds
      console.log('FEED SERVICE - Total saved feeds:', this.preferences.savedFeeds?.length || 0);
      
      const savedFeeds = (this.preferences.savedFeeds || []).filter(f => 
        f.type === 'feed' || f.type === 'list'
      );
      
      console.log('FEED SERVICE - Filtered feeds (feed/list types):', savedFeeds.length);
      console.log('FEED SERVICE - Available feed types:', savedFeeds.map(f => f.type).join(', '));
      
      if (savedFeeds.length === 0) {
        console.error('FEED SERVICE - No saved feeds available, cannot replenish feed bank');
        return;
      }
      
      // Randomly select up to 3 feeds
      const shuffledFeeds = [...savedFeeds].sort(() => Math.random() - 0.5);
      const selectedFeeds = shuffledFeeds.slice(0, Math.min(3, shuffledFeeds.length));
      
      console.log(`FEED SERVICE - Selected ${selectedFeeds.length} feeds for collecting posts`);
      console.log('FEED SERVICE - Selected feed URIs:', selectedFeeds.map(f => f.value).join(', '));
      
      // Collect posts from each feed
      const allPosts: AppBskyFeedDefs.FeedViewPost[] = [];
      
      for (const feed of selectedFeeds) {
        try {
          console.log(`FEED SERVICE - Fetching posts from feed: ${feed.value}`);
          
          // Use a different approach based on feed type
          let result;
          if (feed.type === 'feed') {
            result = await this.agent.app.bsky.feed.getFeed({
              feed: feed.value,
              limit: 30,
            });
          } else if (feed.type === 'list') {
            result = await this.agent.app.bsky.feed.getListFeed({
              list: feed.value,
              limit: 30,
            });
          }
          
          if (result?.data?.feed) {
            allPosts.push(...result.data.feed);
            console.log(`FEED SERVICE - Added ${result.data.feed.length} posts from ${feed.value}`);
          }
        } catch (error) {
          console.error(`FEED SERVICE - Error fetching feed ${feed.value}:`, error);
        }
      }
      
      // Deduplicate posts
      console.log('FEED SERVICE - Total posts collected before deduplication:', allPosts.length);
      const dedupedPosts = this.deduplicatePosts(allPosts);
      console.log(`FEED SERVICE - Collected ${dedupedPosts.length} unique posts from feeds`);
      console.log(`FEED SERVICE - Removed ${allPosts.length - dedupedPosts.length} duplicate posts`);
      
      if (dedupedPosts.length < 10) {
        console.warn('FEED SERVICE - Not enough posts collected for curation, minimum 10 required');
        console.warn(`FEED SERVICE - Only ${dedupedPosts.length} posts available`);
        return;
      }
      
      // Get the user profile
      console.log('FEED SERVICE - Getting user profile');
      const userProfileModule = await import('./user-profile');
      console.log('FEED SERVICE - User profile module imported:', !!userProfileModule);
      
      if (!userProfileModule || !userProfileModule.getCurrentUserProfile) {
        console.error('FEED SERVICE - User profile module not available');
        return;
      }
      
      const getCurrentUserProfile = userProfileModule.getCurrentUserProfile;
      console.log('FEED SERVICE - Calling getCurrentUserProfile with injected agent');
      const profile = await getCurrentUserProfile(this.agent);
      console.log('FEED SERVICE - Got user profile:', !!profile);
      
      if (!profile) {
        console.error('FEED SERVICE - Could not get user profile for feed curation');
        return;
      }
      
      console.log('FEED SERVICE - User profile details:', {
        name: profile.name,
        subscriptionsCount: profile.subscriptions?.length || 0,
        personalityLength: profile.personality?.length || 0,
        languages: profile.languages || 'none',
      });
      
      // Extract post texts
      console.log('FEED SERVICE - Extracting post texts');
      const postTexts = dedupedPosts.map(post => {
        const record = post.post.record as AppBskyFeedPost.Record;
        return record.text;
      });
      console.log(`FEED SERVICE - Extracted ${postTexts.length} post texts`);
      
      // Curate the feed
      console.log('FEED SERVICE - Setting processing flag to true');
      this.setProcessing(true);
      
      try {
        // Use the feed curator directly since we're not exposing this to the UI
        console.log('FEED SERVICE - Curator available:', !!this.curator);
        if (!this.curator) {
          console.error('FEED SERVICE - Feed curator not initialized');
          this.setProcessing(false);
          return;
        }
        
        console.log('FEED SERVICE - Starting feed curation process');
        console.log('FEED SERVICE - Inputs:', {
          subscriptionsCount: profile.subscriptions.length,
          postTextsCount: postTexts.length,
          personalityLength: profile.personality.length,
        });
        
        const curatedFeed = await this.curator.curateFeed(
          profile.subscriptions,
          postTexts,
          profile.personality,
          profile.languages
        );
        
        console.log(`FEED SERVICE - Successfully curated feed with ${curatedFeed.length} posts`);
        if (curatedFeed.length > 0) {
          console.log('FEED SERVICE - First curated post preview:', curatedFeed[0].substring(0, 50) + '...');
        }
        
        // Generate a feed ID
        const feedId = `ai-feed-bank-${Date.now()}`;
        console.log('FEED SERVICE - Generated feed ID:', feedId);
        
        // Add to feed bank
        console.log('FEED SERVICE - Adding feed to bank');
        this.addToFeedBank(feedId, curatedFeed);
        
        console.log('FEED SERVICE - Setting processing flag to false');
        this.setProcessing(false);
        console.log('===== FEED SERVICE - REPLENISH FEED BANK COMPLETED SUCCESSFULLY =====');
      } catch (error) {
        console.error('FEED SERVICE - Error during feed curation:', error);
        console.error('FEED SERVICE - Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        console.log('FEED SERVICE - Setting processing flag to false after error');
        this.setProcessing(false);
        console.log('===== FEED SERVICE - REPLENISH FEED BANK FAILED =====');
      }
      
    } catch (error) {
      console.error('FEED SERVICE - Error replenishing feed bank:', error);
      this.setProcessing(false);
    }
  }
  
  /**
   * Get the next available feed from the feed bank
   * Returns null if no feeds are available
   */
  public getNextFeedFromBank(): string[] | null {
    console.log('===== FEED SERVICE - GET NEXT FEED FROM BANK =====');
    console.log('FEED SERVICE - Current feed bank size:', this.feedBank.length);
    
    // Clean the feed bank first
    this.cleanFeedBank();
    
    // Check for unconsumed feeds
    const unconsumedFeeds = this.feedBank.filter(feed => !feed.consumed);
    console.log('FEED SERVICE - Unconsumed feeds count:', unconsumedFeeds.length);
    
    if (unconsumedFeeds.length === 0) {
      console.log('FEED SERVICE - No unconsumed feeds available');
      return null;
    }
    
    // Find the oldest unconsumed feed
    const sortedUnconsumed = [...unconsumedFeeds].sort((a, b) => a.timestamp - b.timestamp);
    console.log('FEED SERVICE - Sorted unconsumed feeds by age (oldest first)');
    sortedUnconsumed.forEach((feed, index) => {
      const age = Math.round((Date.now() - feed.timestamp) / 1000);
      console.log(`FEED SERVICE - Feed ${index}: ID=${feed.feedId}, age=${age}s, postCount=${feed.posts.length}`);
    });
    
    const nextFeed = sortedUnconsumed[0];
    
    if (!nextFeed) {
      console.log('FEED SERVICE - No feeds available in feed bank');
      return null;
    }
    
    // Mark as consumed
    nextFeed.consumed = true;
    console.log(`FEED SERVICE - Retrieved feed from bank: ${nextFeed.feedId}`);
    console.log(`FEED SERVICE - Feed post count: ${nextFeed.posts.length}`);
    console.log(`FEED SERVICE - Feed age: ${Math.round((Date.now() - nextFeed.timestamp) / 1000)}s`);
    
    if (nextFeed.posts.length > 0) {
      console.log('FEED SERVICE - Sample post:', nextFeed.posts[0].substring(0, 50) + '...');
    }
    
    // Notify listeners
    this.events.emit('feed-bank-updated', this.feedBank);
    console.log('FEED SERVICE - Notified listeners of bank update');
    
    console.log('===== FEED SERVICE - GET NEXT FEED FROM BANK COMPLETED =====');
    return nextFeed.posts;
  }
  
  /**
   * Add a curated feed to the feed bank
   */
  public addToFeedBank(feedId: string, posts: string[]) {
    console.log('===== FEED SERVICE - ADD TO FEED BANK =====');
    console.log(`FEED SERVICE - Adding feed to bank: ${feedId}`);
    console.log(`FEED SERVICE - Posts count: ${posts.length}`);
    console.log('FEED SERVICE - Current bank size before adding:', this.feedBank.length);
    
    // Create new feed bank item
    const newFeedItem = {
      feedId,
      posts,
      timestamp: Date.now(),
      consumed: false
    };
    
    this.feedBank.push(newFeedItem);
    console.log('FEED SERVICE - Feed added to bank');
    console.log('FEED SERVICE - New bank size:', this.feedBank.length);
    
    // Check if we need to trim the bank
    if (this.feedBank.length > FEED_BANK_SIZE_LIMIT) {
      console.log(`FEED SERVICE - Bank exceeds size limit of ${FEED_BANK_SIZE_LIMIT}, trimming...`);
      
      // Get counts
      const consumedFeeds = this.feedBank.filter(feed => feed.consumed);
      const unconsumedFeeds = this.feedBank.filter(feed => !feed.consumed);
      
      console.log('FEED SERVICE - Consumed feeds count:', consumedFeeds.length);
      console.log('FEED SERVICE - Unconsumed feeds count:', unconsumedFeeds.length);
      
      if (consumedFeeds.length > 0) {
        // Sort consumed feeds by timestamp (oldest first)
        const sortedConsumed = [...consumedFeeds].sort((a, b) => a.timestamp - b.timestamp);
        const oldestConsumed = sortedConsumed[0];
        
        console.log('FEED SERVICE - Removing oldest consumed feed:', oldestConsumed.feedId);
        console.log('FEED SERVICE - Feed age:', Math.round((Date.now() - oldestConsumed.timestamp) / 1000) + 's');
        
        this.feedBank = this.feedBank.filter(feed => feed.feedId !== oldestConsumed.feedId);
      } else {
        // Remove the oldest feed
        this.feedBank.sort((a, b) => a.timestamp - b.timestamp);
        const oldestFeed = this.feedBank[0];
        
        console.log('FEED SERVICE - Removing oldest feed (all are unconsumed):', oldestFeed.feedId);
        console.log('FEED SERVICE - Feed age:', Math.round((Date.now() - oldestFeed.timestamp) / 1000) + 's');
        
        this.feedBank.shift();
      }
      
      console.log('FEED SERVICE - Bank size after trimming:', this.feedBank.length);
    }
    
    console.log(`FEED SERVICE - Added feed to bank: ${feedId}, bank size: ${this.feedBank.length}`);
    this.events.emit('feed-bank-updated', this.feedBank);
    console.log('FEED SERVICE - Notified listeners of bank update');
    console.log('===== FEED SERVICE - ADD TO FEED BANK COMPLETED =====');
  }
  
  /**
   * Helper function to deduplicate posts by URI
   */
  public deduplicatePosts(posts: AppBskyFeedDefs.FeedViewPost[]): AppBskyFeedDefs.FeedViewPost[] {
    const deduplicated: AppBskyFeedDefs.FeedViewPost[] = []
    const seenUris = new Set<string>()
    
    for (const post of posts) {
      const uri = post.post.uri
      if (!seenUris.has(uri) && !this.seenPostUris.has(uri)) {
        seenUris.add(uri)
        this.seenPostUris.add(uri)
        deduplicated.push(post)
      }
    }
    
    return deduplicated
  }
}

// Export a singleton instance
export const llmFeedService = new LLMFeedService()