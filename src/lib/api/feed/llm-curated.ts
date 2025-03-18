import {AppBskyFeedDefs, BskyAgent} from '@atproto/api'
// Use the AppBskyFeedDefs.FeedViewPost instead of a non-existent type
type BskyFeedViewPost = AppBskyFeedDefs.FeedViewPost

import {FeedAPI, FeedAPIResponse} from './types'
import type {LLMFeedService} from '../../llm-feed/feed-service' // Import as type only
import {UserProfile} from '../../llm-feed/types'
import {getCurrentUserProfile} from '../../llm-feed/user-profile'

// Get the LLMFeedService from the global context
let globalLLMFeedService: LLMFeedService | null = null;

export class LLMCuratedFeedAPI implements FeedAPI {
  private agent: BskyAgent
  private userProfile: UserProfile | null = null
  private rawFeed: BskyFeedViewPost[] = []
  private curatedFeedId: string | null = null
  private curatedPostIds: Set<string> = new Set()
  private isCurating: boolean = false
  private feedParams: {sourceFeed: string; aiMode?: boolean} // Added aiMode flag to support AI mode

  constructor({
    agent,
    feedParams,
    feedService,
  }: {
    agent: BskyAgent
    feedParams: {sourceFeed: string; aiMode?: boolean}
    feedService?: LLMFeedService
  }) {
    console.log('LLM CURATED API - Constructor called with params:', 
      'sourceFeed:', feedParams.sourceFeed,
      'aiMode:', feedParams.aiMode,
      'feedService provided:', !!feedService);
    this.agent = agent
    this.feedParams = feedParams
    
    // Store the provided feed service in the global variable
    if (feedService) {
      globalLLMFeedService = feedService;
      console.log('LLM CURATED API - Using provided feed service instance');
    } else {
      console.warn('LLM CURATED API - No feed service provided! AI feeds may not work properly');
    }
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
      curatedPostIdsCount: this.curatedPostIds?.size || 0,
      isCurating: this.isCurating
    });
    
    // Special handling for AI mode
    if (this.feedParams.aiMode) {
      if (!globalLLMFeedService) {
        console.error('LLM CURATED API - Feed service not available for AI mode!');
        return {
          cursor: undefined,
          feed: [{
            post: {
              uri: `at://did:plc:temporary/app.bsky.feed.post/error-${Date.now()}`,
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
                text: 'Error: Feed service not available. Please try toggling AI mode off and on again.',
                $type: 'app.bsky.feed.post',
                createdAt: new Date().toISOString()
              },
              indexedAt: new Date().toISOString(),
              viewer: {},
              replyCount: 0,
              repostCount: 0,
              likeCount: 0,
              labels: []
            }
          }]
        };
      }
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
        if (!globalLLMFeedService) {
          console.error('LLM CURATED API - Feed service not available for curation!');
          throw new Error('Feed service not available');
        }
        
        this.curatedFeedId = await globalLLMFeedService.curateFeed(
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
            // globalLLMFeedService.on('feed-updated', onFeedUpdated)
          } else {
            console.log('LLM CURATED API - Feed ID does not match our feed ID, ignoring update');
            console.log('LLM CURATED API - Received ID:', feedId);
            console.log('LLM CURATED API - Expected ID:', this.curatedFeedId);
          }
        }
        
        // Listen for feed updates
        console.log('LLM CURATED API - Setting up feed-updated listener');
        if (globalLLMFeedService) {
          globalLLMFeedService.on('feed-updated', onFeedUpdated);
        }
        
        // Get the cached feed if available (might be available immediately if cached)
        console.log('LLM CURATED API - Checking for cached feed...');
        const cachedFeed = globalLLMFeedService ? globalLLMFeedService.getCachedFeed(this.curatedFeedId) : null
        
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

  private processCuratedFeed(curatedPostIds: string[]) {
    console.log('LLM CURATED API - Processing curated feed with', curatedPostIds.length, 'post IDs');
    
    // Log a sample of the curated post IDs
    if (curatedPostIds.length > 0) {
      console.log('LLM CURATED API - Curated post IDs sample (first 3):');
      curatedPostIds.slice(0, 3).forEach((id, idx) => {
        console.log(`CURATED POST ID ${idx+1}: ${id}`);
      });
    }
    
    // Store the IDs of posts that were selected by the LLM
    this.curatedPostIds = new Set(curatedPostIds)
    console.log('LLM CURATED API - Stored', this.curatedPostIds.size, 'post IDs in curatedPostIds set');
    
    this.isCurating = false
    console.log('LLM CURATED API - Set isCurating to false');
  }

  private buildResponse(limit: number, cursor?: string): FeedAPIResponse {
    console.log('LLM CURATED API - Building response, limit:', limit, 'cursor:', cursor || 'none');
    console.log('LLM CURATED API - Raw feed length:', this.rawFeed.length);
    console.log('LLM CURATED API - Curated post IDs count:', this.curatedPostIds?.size || 0);
    console.log('LLM CURATED API - Is curation in progress:', this.isCurating);
    
    // If we have a curated feed, filter the raw feed based on the curated post IDs
    let resultFeed: BskyFeedViewPost[] = []
    
    if (this.curatedPostIds && this.curatedPostIds.size > 0) {
      console.log('LLM CURATED API - Using curated feed filter logic');
      
      // Log some raw feed samples to debug matching
      console.log('LLM CURATED API - Raw feed sample before filtering:');
      this.rawFeed.slice(0, 3).forEach((post, idx) => {
        console.log(`RAW POST ${idx+1}:`);
        console.log(`- URI: ${post.post.uri}`);
        console.log(`- Author: @${post.post.author.handle}`);
        console.log(`- Will match: ${this.curatedPostIds.has(post.post.uri)}`);
      });
      
      // Track matching stats
      let totalPostsChecked = 0;
      let postsMatchingCuration = 0;
      
      // Filter to only include curated posts by URI
      resultFeed = this.rawFeed.filter(post => {
        totalPostsChecked++;
        const matches = this.curatedPostIds.has(post.post.uri);
        if (matches) postsMatchingCuration++;
        return matches;
      })
      
      console.log('LLM CURATED API - Filter stats:', {
        totalPostsChecked,
        postsMatchingCuration,
        percentMatched: totalPostsChecked > 0 ? Math.round((postsMatchingCuration / totalPostsChecked) * 100) + '%' : '0%'
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
   * Uses the feed bank managed by the global LLM feed service to provide AI-curated posts
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
      if (!globalLLMFeedService) {
        console.error('LLM CURATED API - Feed service not available!');
        return { cursor: undefined, feed: [] };
      }
      const postIds = globalLLMFeedService.getNextFeedFromBank();
      
      if (!postIds || postIds.length === 0) {
        console.log('LLM CURATED API - No feeds available in bank, returning empty feed');
        // No feeds available yet, just return an empty feed with a cursor to trigger pagination
        return { 
          cursor: '0', 
          feed: [] 
        };
      }
      
      console.log(`LLM CURATED API - Got feed with ${postIds.length} post IDs from bank`);
      
      try {
        // Collect posts from multiple sources to maximize matching chances
        console.log('LLM CURATED API - Fetching multiple source feeds to match posts against');
        
        // Create an array to store all source posts for matching
        let allSourcePosts: BskyFeedViewPost[] = [];
        
        // Get primary source feed
        console.log('LLM CURATED API - Fetching primary source feed:', this.feedParams.sourceFeed);
        const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
          feed: this.feedParams.sourceFeed,
          limit: 100,
        });
        allSourcePosts = [...sourceFeedResult.data.feed];
        console.log(`LLM CURATED API - Fetched ${allSourcePosts.length} posts from source feed`);
        
        // Also get home timeline for better matching
        try {
          console.log('LLM CURATED API - Fetching home timeline for additional matching');
          const homeResult = await this.agent.app.bsky.feed.getTimeline({
            limit: 100,
          });
          
          if (homeResult?.data?.feed) {
            const existingUris = new Set(allSourcePosts.map(p => p.post.uri));
            const newPosts = homeResult.data.feed.filter(p => !existingUris.has(p.post.uri));
            allSourcePosts = [...allSourcePosts, ...newPosts];
            console.log(`LLM CURATED API - Added ${newPosts.length} unique posts from home timeline`);
          }
        } catch (error) {
          console.error('LLM CURATED API - Error fetching home timeline:', error);
        }
        
        // Try fetching popular feeds to increase matching chances
        try {
          const popularFeedUris = [
            'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
            'at://did:plc:jfhpnnst6flqway4eaeqzj2a/app.bsky.feed.generator/for-science'
          ];
          
          for (const feedUri of popularFeedUris) {
            if (feedUri !== this.feedParams.sourceFeed) {
              const feedResult = await this.agent.app.bsky.feed.getFeed({
                feed: feedUri,
                limit: 50,
              });
              
              if (feedResult?.data?.feed) {
                const existingUris = new Set(allSourcePosts.map(p => p.post.uri));
                const newPosts = feedResult.data.feed.filter(p => !existingUris.has(p.post.uri));
                allSourcePosts = [...allSourcePosts, ...newPosts];
                console.log(`LLM CURATED API - Added ${newPosts.length} unique posts from ${feedUri}`);
              }
            }
          }
        } catch (error) {
          console.error('LLM CURATED API - Error fetching additional feeds:', error);
        }
        
        // Save all sources for future pagination
        this.rawFeed = allSourcePosts;
        
        // Match posts by post ID
        const matchedPosts: BskyFeedViewPost[] = [];
        const unmatchedIds: string[] = [];
        
        // First pass - direct URI matching
        for (const postId of postIds) {
          // Find post with matching URI
          const matchingPost = allSourcePosts.find(post => post.post.uri === postId);
          
          if (matchingPost) {
            matchedPosts.push(matchingPost);
          } else {
            unmatchedIds.push(postId);
          }
        }
        
        // We don't need a second pass with text matching anymore since we're using IDs
        if (unmatchedIds.length > 0) {
          console.log(`LLM CURATED API - Could not find ${unmatchedIds.length} posts by URI. First unmatched ID:`, 
            unmatchedIds[0]);
        }
        
        console.log(`LLM CURATED API - Matched ${matchedPosts.length} out of ${postIds.length} curated posts`);
        
        if (matchedPosts.length === 0) {
          // If we couldn't match any posts, create placeholder posts with the IDs
          console.log(`LLM CURATED API - Creating ${Math.min(postIds.length, limit)} placeholder posts with IDs`);
          const placeholderPosts: BskyFeedViewPost[] = [];
          
          // Create placeholder posts for the first 'limit' post IDs
          for (let i = 0; i < Math.min(postIds.length, limit); i++) {
            placeholderPosts.push({
              post: {
                uri: postIds[i] || `at://did:plc:temporary/app.bsky.feed.post/ai-curated-${Date.now()}-${i}`,
                cid: `temporary-${Date.now()}-${i}`,
                author: {
                  did: 'did:plc:bsky',
                  handle: 'bsky.app',
                  displayName: 'AI Feed',
                  avatar: 'https://bsky.social/static/logo.png',
                  viewer: {},
                  labels: []
                },
                record: {
                  text: `Post ID: ${postIds[i]}`,
                  $type: 'app.bsky.feed.post',
                  createdAt: new Date().toISOString()
                },
                indexedAt: new Date().toISOString(),
                viewer: {},
                replyCount: 0,
                repostCount: 0,
                likeCount: 0,
                labels: []
              }
            });
          }
          
          if (placeholderPosts.length > 0) {
            return {
              cursor: placeholderPosts.length < limit ? undefined : '0',
              feed: placeholderPosts
            };
          }
        }
        
        // Return matched posts with pagination
        const responseSlice = matchedPosts.slice(0, limit);
        
        // Ensure pagination continues when needed
        const nextCursor = matchedPosts.length > limit 
          ? limit.toString() 
          : '0'; // Use '0' to trigger additional feed fetch
        
        return {
          cursor: nextCursor,
          feed: responseSlice,
        };
      } catch (error) {
        console.error('LLM CURATED API - Error fetching AI mode feed:', error);
        return { cursor: undefined, feed: [] };
      }
    } else {
      // This is a pagination request (user scrolled to bottom)
      console.log('LLM CURATED API - Pagination request received with cursor:', cursor);
      
      // Try to get next feed from bank
      if (!globalLLMFeedService) {
        console.error('LLM CURATED API - Feed service not available for pagination!');
        return { cursor: undefined, feed: [] };
      }
      
      // Log bank state for debugging
      const bankInfo = globalLLMFeedService.debugGetFeedBankStatus();
      console.log(`LLM CURATED API - PAGINATION DEBUG - Bank size: ${bankInfo.total}, Consumed feeds: ${bankInfo.consumed}, Unused feeds: ${bankInfo.unconsumed}`);
      
      // Try to get a fresh feed from the bank
      const freshPostIds = globalLLMFeedService.getNextFeedFromBank();
      console.log(`LLM CURATED API - PAGINATION DEBUG - getNextFeedFromBank returned:`, freshPostIds ? `${freshPostIds.length} post IDs` : 'null');
      
      // Log updated bank state
      const bankInfoAfter = globalLLMFeedService.debugGetFeedBankStatus();
      console.log(`LLM CURATED API - PAGINATION DEBUG - Bank after fetch: Total=${bankInfoAfter.total}, Consumed=${bankInfoAfter.consumed}, Unused=${bankInfoAfter.unconsumed}`);
      
      if (freshPostIds && freshPostIds.length > 0) {
        console.log(`LLM CURATED API - Found fresh feed with ${freshPostIds.length} post IDs for pagination`);
        
        // Ensure we have an up-to-date raw feed for matching
        if (this.rawFeed.length < 50) {
          try {
            console.log('LLM CURATED API - Refreshing source feeds for pagination');
            const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
              feed: this.feedParams.sourceFeed,
              limit: 100,
            });
            
            this.rawFeed = sourceFeedResult.data.feed;
            
            // Add home timeline
            try {
              const homeResult = await this.agent.app.bsky.feed.getTimeline({
                limit: 100,
              });
              
              if (homeResult?.data?.feed) {
                const existingUris = new Set(this.rawFeed.map(p => p.post.uri));
                const newPosts = homeResult.data.feed.filter(p => !existingUris.has(p.post.uri));
                this.rawFeed = [...this.rawFeed, ...newPosts];
              }
            } catch (error) {
              console.error('LLM CURATED API - Error fetching home timeline for pagination:', error);
            }
          } catch (error) {
            console.error('LLM CURATED API - Error refreshing feeds for pagination:', error);
          }
        }
        
        // Match posts by URI
        const matchedPosts: BskyFeedViewPost[] = [];
        const unmatchedIds: string[] = [];
        
        // Direct URI matching
        for (const postId of freshPostIds) {
          const matchingPost = this.rawFeed.find(post => post.post.uri === postId);
          
          if (matchingPost) {
            matchedPosts.push(matchingPost);
          } else {
            unmatchedIds.push(postId);
          }
        }
        
        // Log unmatched IDs
        if (unmatchedIds.length > 0) {
          console.log(`LLM CURATED API - Could not find ${unmatchedIds.length} post IDs for pagination. First unmatched ID:`, 
            unmatchedIds[0]);
        }
        
        console.log(`LLM CURATED API - Matched ${matchedPosts.length} out of ${freshPostIds.length} posts for pagination`);
        
        if (matchedPosts.length === 0) {
          // If we couldn't match any posts, create placeholder posts with IDs
          console.log(`LLM CURATED API - Creating ${Math.min(freshPostIds.length, limit)} placeholder posts for AI content`);
          const placeholderPosts: BskyFeedViewPost[] = [];
          
          for (let i = 0; i < Math.min(freshPostIds.length, limit); i++) {
            placeholderPosts.push({
              post: {
                uri: freshPostIds[i] || `at://did:plc:temporary/app.bsky.feed.post/ai-curated-${Date.now()}-${i}`,
                cid: `temporary-${Date.now()}-${i}`,
                author: {
                  did: 'did:plc:bsky',
                  handle: 'bsky.app',
                  displayName: 'AI Feed', 
                  avatar: 'https://bsky.social/static/logo.png',
                  viewer: {},
                  labels: []
                },
                record: {
                  text: `Post ID: ${freshPostIds[i]}`,
                  $type: 'app.bsky.feed.post',
                  createdAt: new Date().toISOString()
                },
                indexedAt: new Date().toISOString(),
                viewer: {},
                replyCount: 0,
                repostCount: 0,
                likeCount: 0,
                labels: []
              }
              });
            }
          }
          
          if (placeholderPosts.length > 0) {
            return {
              cursor: placeholderPosts.length < limit ? undefined : '0',
              feed: placeholderPosts
            };
          }
        }
        
        // Return matched posts with pagination
        return {
          cursor: matchedPosts.length < limit ? undefined : '0',
          feed: matchedPosts,
        };
      }
      
      // If we couldn't get a fresh feed or failed to match posts, return empty with numeric cursor
      // This ensures the client will try to paginate again later
      console.log('LLM CURATED API - No additional AI feed pages available');
      return { 
        cursor: '0', 
        feed: [] 
      };
    }
  }