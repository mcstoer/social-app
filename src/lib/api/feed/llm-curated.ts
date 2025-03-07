import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'
// Use the AppBskyFeedDefs.FeedViewPost instead of a non-existent type
type BskyFeedViewPost = AppBskyFeedDefs.FeedViewPost

import {FeedAPI, FeedAPIResponse} from './types'
import {llmFeedService} from '../../llm-feed/feed-service'
import {UserProfile} from '../../llm-feed/types'
import {getCurrentUserProfile} from '../../llm-feed/user-profile'

export class LLMCuratedFeedAPI implements FeedAPI {
  private agent: BskyAgent
  private userProfile: UserProfile | null = null
  private rawFeed: BskyFeedViewPost[] = []
  private curatedFeedId: string | null = null
  private curatedPostUris: Set<string> = new Set()
  private isCurating: boolean = false
  private feedParams: {sourceFeed: string; aiMode?: boolean} // Added aiMode flag to support AI mode

  constructor({
    agent,
    feedParams,
  }: {
    agent: BskyAgent
    feedParams: {sourceFeed: string; aiMode?: boolean}
  }) {
    this.agent = agent
    this.feedParams = feedParams
  }

  async fetch({
    cursor,
    limit,
  }: {
    cursor?: string
    limit: number
  }): Promise<FeedAPIResponse> {
    console.log('===== LLM CURATED API - FETCH STARTED =====');
    console.log('LLM CURATED API - fetch called with cursor:', cursor || 'none', 'limit:', limit);
    console.log('LLM CURATED API - Source feed:', this.feedParams.sourceFeed);
    console.log('LLM CURATED API - AI Mode:', this.feedParams.aiMode ? 'enabled' : 'disabled');
    console.log('LLM CURATED API - Current feed state:', {
      hasProfile: !!this.userProfile,
      curatedFeedId: this.curatedFeedId || 'none',
      rawFeedLength: this.rawFeed.length,
      curatedPostUrisCount: this.curatedPostUris.size,
      isCurating: this.isCurating
    });
    
    // Special handling for AI mode
    if (this.feedParams.aiMode) {
      return this.fetchAIModeFeed({cursor, limit})
    }
    
    // If we don't have a user profile yet, try to get it
    if (!this.userProfile) {
      console.log('LLM CURATED API - Getting user profile...');
      this.userProfile = await getCurrentUserProfile(this.agent)
      
      if (this.userProfile) {
        console.log('LLM CURATED API - Got user profile:', {
          name: this.userProfile.name,
          personality: this.userProfile.personality?.substring(0, 100) + '...',
          subscriptionsCount: this.userProfile.subscriptions.length,
          languages: this.userProfile.languages
        });
      } else {
        console.log('LLM CURATED API - Failed to get user profile');
      }
    }

    if (!this.userProfile) {
      console.error('LLM CURATED API - ERROR: Could not get user profile');
      throw new Error('Could not get user profile for LLM feed curation')
    }

    // If we're on the first request, or need to rebuild the feed
    if (!this.curatedFeedId || !cursor) {
      console.log('LLM CURATED API - First request or rebuild feed (no curatedFeedId or cursor)');
      
      // Fetch posts from the source feed
      console.log('LLM CURATED API - Fetching posts from source feed:', this.feedParams.sourceFeed);
      const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
        feed: this.feedParams.sourceFeed,
        limit: Math.min(100, limit * 3), // Get more posts to allow for filtering
      })

      console.log('LLM CURATED API - Source feed returned', sourceFeedResult.data.feed.length, 'posts');
      
      // Store the raw feed for later use
      this.rawFeed = sourceFeedResult.data.feed
      console.log('LLM CURATED API - Stored raw feed with', this.rawFeed.length, 'posts');
      
      try {
        // Launch the curation process
        console.log('LLM CURATED API - Starting curation process...');
        this.isCurating = true
        
        console.log('LLM CURATED API - Calling feed service to curate posts');
        this.curatedFeedId = await llmFeedService.curateFeed(
          this.rawFeed,
          this.userProfile
        )
        console.log('LLM CURATED API - Feed service returned feed ID:', this.curatedFeedId);
        
        // Once curation has completed, update our local feed state
        const onFeedUpdated = (feedId: string, posts: string[]) => {
          console.log('LLM CURATED API - Received feed-updated event for ID:', feedId);
          console.log('LLM CURATED API - Expected feedId:', this.curatedFeedId);
          console.log('LLM CURATED API - Match?', feedId === this.curatedFeedId);
          
          if (posts.length === 0) {
            console.warn('LLM CURATED API - Received feed-updated event with 0 posts!');
          }
          
          if (feedId === this.curatedFeedId) {
            console.log('LLM CURATED API - Feed ID matches our curated feed, processing', posts.length, 'posts');
            this.processCuratedFeed(posts)
            
            // NOTE: We should NOT be re-adding the event listener here
            // This was in the original code but could cause memory leaks or duplicate handlers
            // Removing this line and only setting up the listener once
            console.log('LLM CURATED API - Not re-adding event listener (fixed potential bug)')
            // llmFeedService.on('feed-updated', onFeedUpdated)
          } else {
            console.log('LLM CURATED API - Feed ID does not match our feed ID, ignoring update');
            console.log('LLM CURATED API - Received ID:', feedId);
            console.log('LLM CURATED API - Expected ID:', this.curatedFeedId);
          }
        }
        
        // Listen for feed updates
        console.log('LLM CURATED API - Setting up feed-updated listener');
        llmFeedService.on('feed-updated', onFeedUpdated)
        
        // Get the cached feed if available (might be available immediately if cached)
        console.log('LLM CURATED API - Checking for cached feed...');
        const cachedFeed = llmFeedService.getCachedFeed(this.curatedFeedId)
        
        if (cachedFeed) {
          console.log('LLM CURATED API - Found cached feed with', cachedFeed.length, 'posts');
          this.processCuratedFeed(cachedFeed)
        } else {
          console.log('LLM CURATED API - No cached feed available, will wait for feed-updated event');
        }
        
        // Return what we have so far (may be uncurated if curation is still running)
        console.log('LLM CURATED API - Building initial response...');
        const response = this.buildResponse(limit, cursor);
        console.log('===== LLM CURATED API - FETCH COMPLETED =====');
        return response;
      } catch (error) {
        console.error('LLM CURATED API - ERROR curating feed:', error);
        
        // Fallback to returning the raw feed if curation fails
        console.log('LLM CURATED API - Falling back to raw feed due to error');
        
        const fallbackResponse = {
          cursor: undefined,
          feed: this.rawFeed.slice(0, limit),
        };
        
        console.log('LLM CURATED API - Returning fallback with', fallbackResponse.feed.length, 'posts');
        console.log('===== LLM CURATED API - FETCH COMPLETED WITH ERROR =====');
        return fallbackResponse;
      }
    } else {
      // For subsequent pages, just return more results from our existing feed
      console.log('LLM CURATED API - Pagination request for existing feed, cursor:', cursor);
      const response = this.buildResponse(limit, cursor);
      console.log('===== LLM CURATED API - FETCH COMPLETED (PAGINATION) =====');
      return response;
    }
  }

  private processCuratedFeed(curatedPosts: string[]) {
    console.log('LLM CURATED API - Processing curated feed with', curatedPosts.length, 'posts');
    
    // Log a sample of the curated posts
    if (curatedPosts.length > 0) {
      console.log('LLM CURATED API - Curated posts sample (first 3):');
      curatedPosts.slice(0, 3).forEach((text, idx) => {
        console.log(`CURATED TEXT ${idx+1}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });
    }
    
    // Store the URIs of posts that were selected by the LLM
    this.curatedPostUris = new Set(curatedPosts)
    console.log('LLM CURATED API - Stored', this.curatedPostUris.size, 'post texts in curatedPostUris set');
    
    this.isCurating = false
    console.log('LLM CURATED API - Set isCurating to false');
  }

  private buildResponse(limit: number, cursor?: string): FeedAPIResponse {
    console.log('LLM CURATED API - Building response, limit:', limit, 'cursor:', cursor || 'none');
    console.log('LLM CURATED API - Raw feed length:', this.rawFeed.length);
    console.log('LLM CURATED API - Curated post URIs count:', this.curatedPostUris.size);
    console.log('LLM CURATED API - Is curation in progress:', this.isCurating);
    
    // If we have a curated feed, filter the raw feed based on the curated post URIs
    let resultFeed: BskyFeedViewPost[] = []
    
    if (this.curatedPostUris.size > 0) {
      console.log('LLM CURATED API - Using curated feed filter logic');
      
      // Log some raw feed samples with text contents to debug matching
      console.log('LLM CURATED API - Raw feed sample before filtering:');
      this.rawFeed.slice(0, 3).forEach((post, idx) => {
        const record = post.post.record as any;
        console.log(`RAW POST ${idx+1}:`);
        console.log(`- URI: ${post.post.uri}`);
        console.log(`- Author: @${post.post.author.handle}`);
        console.log(`- Text: ${record?.text || 'No text'}`);
        console.log(`- Will match: ${record?.text && this.curatedPostUris.has(record.text)}`);
      });
      
      // Track matching stats
      let totalPostsChecked = 0;
      let postsWithText = 0;
      let postsMatchingCuration = 0;
      
      // Filter to only include curated posts
      // Keep the original post objects but filter based on text content
      // Note: we're comparing by text content which is not ideal but works for prototype
      resultFeed = this.rawFeed.filter(post => {
        totalPostsChecked++;
        const record = post.post.record as any;
        
        if (record?.text) {
          postsWithText++;
          const matches = this.curatedPostUris.has(record.text);
          if (matches) postsMatchingCuration++;
          return matches;
        }
        return false;
      })
      
      console.log('LLM CURATED API - Filter stats:', {
        totalPostsChecked,
        postsWithText,
        postsMatchingCuration,
        percentMatched: postsWithText > 0 ? Math.round((postsMatchingCuration / postsWithText) * 100) + '%' : '0%'
      });
      
      // If we don't have any posts after filtering, use a subset of the raw feed 
      // to avoid showing an empty feed with styling issues
      if (resultFeed.length === 0 && this.rawFeed.length > 0) {
        console.log('LLM CURATED API - No posts matched! Using fallback raw feed subset');
        resultFeed = this.rawFeed.slice(0, Math.min(10, this.rawFeed.length))
      }
    } else {
      // If curation is still in progress or failed, just use the raw feed
      console.log('LLM CURATED API - No curated posts available, using raw feed');
      resultFeed = this.rawFeed
    }
    
    console.log('LLM CURATED API - Result feed length after filtering:', resultFeed.length);
    
    // Handle pagination
    let startIndex = 0
    if (cursor) {
      // Simple cursor implementation based on index
      startIndex = parseInt(cursor, 10)
      console.log('LLM CURATED API - Using cursor to start at index:', startIndex);
    }
    
    // Get a slice of the feed for this page
    const endIndex = Math.min(startIndex + limit, resultFeed.length)
    console.log('LLM CURATED API - Slicing feed from', startIndex, 'to', endIndex);
    const slicedFeed = resultFeed.slice(startIndex, endIndex)
    
    // Determine if there are more results
    const nextCursor = endIndex < resultFeed.length ? endIndex.toString() : undefined
    console.log('LLM CURATED API - Next cursor:', nextCursor || 'None (end of feed)');
    
    // Add proper styling context to each feed item if needed
    const processedFeed = slicedFeed.map(post => {
      // Ensure we don't lose any styling or context properties
      return {...post}
    })
    
    console.log('LLM CURATED API - Final processed feed length:', processedFeed.length);
    
    // Log sample of returned feed items
    if (processedFeed.length > 0) {
      console.log('LLM CURATED API - Processed feed sample (first 3):');
      processedFeed.slice(0, 3).forEach((post, idx) => {
        const record = post.post.record as any;
        console.log(`RETURNED POST ${idx+1}:`);
        console.log(`- URI: ${post.post.uri}`);
        console.log(`- Author: @${post.post.author.handle}`);
        console.log(`- Text: ${record?.text?.substring(0, 100) || 'No text'}${record?.text?.length > 100 ? '...' : ''}`);
      });
    }
    
    return {
      cursor: nextCursor,
      feed: processedFeed,
    }
  }

  async peekLatest(): Promise<BskyFeedViewPost | undefined> {
    // Simple implementation that just checks for new content in the source feed
    try {
      const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
        feed: this.feedParams.sourceFeed,
        limit: 1,
      })
      
      if (sourceFeedResult.data.feed.length > 0) {
        return sourceFeedResult.data.feed[0]
      }
    } catch (error) {
      console.error('Error peeking for latest posts:', error)
    }
    
    return undefined
  }
  
  /**
   * Fetch feed in AI Mode
   * Uses the feed bank managed by the llmFeedService to provide AI-curated posts
   */
  private async fetchAIModeFeed({
    cursor,
    limit,
  }: {
    cursor?: string
    limit: number
  }): Promise<FeedAPIResponse> {
    console.log('===== LLM CURATED API - FETCH AI MODE FEED =====');
    
    // If this is the first request or we're refreshing, get a new feed from the bank
    if (!cursor) {
      // Get the next available feed from the bank
      console.log('LLM CURATED API - Getting next feed from bank...');
      const posts = llmFeedService.getNextFeedFromBank();
      
      if (!posts || posts.length === 0) {
        console.log('LLM CURATED API - No feeds available in bank, creating temporary post');
        // Create a temporary loading post instead of returning empty feed
        const timestamp = new Date().toISOString();
        const loadingPost = {
          post: {
            uri: `at://did:plc:temporary/app.bsky.feed.post/loading-${Date.now()}`,
            cid: 'temporary',
            author: {
              did: 'did:plc:bsky',
              handle: 'bsky.app',
              displayName: 'Bluesky',
              avatar: 'https://bsky.social/static/logo.png',
              viewer: {},
              labels: []
            },
            record: {
              text: 'Creating your personalized AI feed... This might take a moment.',
              $type: 'app.bsky.feed.post',
              createdAt: timestamp
            },
            indexedAt: timestamp,
            viewer: {},
            replyCount: 0,
            repostCount: 0,
            likeCount: 0,
            labels: []
          }
        };
        
        return { 
          cursor: undefined, 
          feed: [loadingPost] 
        };
      }
      
      console.log(`LLM CURATED API - Got feed with ${posts.length} posts from bank`);
      
      // We need to convert text posts back to FeedViewPost objects
      // For now, since we don't have a direct way to do this, we'll try to match with the posts
      // in the raw feed by content, or fetch a new raw feed if needed
      
      try {
        // Always fetch more posts to match against when in AI mode - this increases matching chances
        console.log('LLM CURATED API - Fetching multiple source feeds to match posts against');
        
        // Get first source
        console.log('LLM CURATED API - Fetching primary source feed:', this.feedParams.sourceFeed);
        const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
          feed: this.feedParams.sourceFeed,
          limit: 100,
        });
        
        this.rawFeed = sourceFeedResult.data.feed;
        console.log(`LLM CURATED API - Fetched ${this.rawFeed.length} posts from source feed`);
        
        // Also get home timeline for better matching
        try {
          console.log('LLM CURATED API - Fetching home timeline for additional matching');
          const homeResult = await this.agent.app.bsky.feed.getTimeline({
            limit: 100,
          });
          
          if (homeResult?.data?.feed) {
            const existingUris = new Set(this.rawFeed.map(p => p.post.uri));
            const newPosts = homeResult.data.feed.filter(p => !existingUris.has(p.post.uri));
            this.rawFeed = [...this.rawFeed, ...newPosts];
            console.log(`LLM CURATED API - Added ${newPosts.length} unique posts from home timeline`);
          }
        } catch (error) {
          console.error('LLM CURATED API - Error fetching home timeline:', error);
        }
        
        // Match the curated post texts to actual posts in the raw feed
        const matchedPosts: BskyFeedViewPost[] = [];
        
        for (const postText of posts) {
          // Find a post with matching text
          const matchingPost = this.rawFeed.find(post => {
            const record = post.post.record as any;
            return record?.text === postText;
          });
          
          if (matchingPost) {
            matchedPosts.push(matchingPost);
          }
        }
        
        console.log(`LLM CURATED API - Matched ${matchedPosts.length} out of ${posts.length} curated posts`);
        
        // Return the matched posts, with pagination if needed
        const responseSlice = matchedPosts.slice(0, limit);
        const nextCursor = matchedPosts.length > limit ? limit.toString() : undefined;
        
        return {
          cursor: nextCursor,
          feed: responseSlice,
        }
      } catch (error) {
        console.error('LLM CURATED API - Error fetching AI mode feed:', error);
        return { cursor: undefined, feed: [] }
      }
    } else {
      // For subsequent pages, we would use the cursor to get more results
      // For now we'll just return an empty array since we're not handling pagination yet
      console.log('LLM CURATED API - No additional AI feed pages available');
      return { cursor: undefined, feed: [] }
    }
  }
}