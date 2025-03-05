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
  private feedParams: {sourceFeed: string}

  constructor({
    agent,
    feedParams,
  }: {
    agent: BskyAgent
    feedParams: {sourceFeed: string}
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
    // If we don't have a user profile yet, try to get it
    if (!this.userProfile) {
      this.userProfile = await getCurrentUserProfile(this.agent)
    }

    if (!this.userProfile) {
      throw new Error('Could not get user profile for LLM feed curation')
    }

    // If we're on the first request, or need to rebuild the feed
    if (!this.curatedFeedId || !cursor) {
      // Fetch posts from the source feed
      const sourceFeedResult = await this.agent.app.bsky.feed.getFeed({
        feed: this.feedParams.sourceFeed,
        limit: Math.min(100, limit * 3), // Get more posts to allow for filtering
      })

      // Store the raw feed for later use
      this.rawFeed = sourceFeedResult.data.feed
      
      try {
        // Launch the curation process
        this.isCurating = true
        this.curatedFeedId = await llmFeedService.curateFeed(
          this.rawFeed,
          this.userProfile
        )
        
        // Once curation has completed, update our local feed state
        const onFeedUpdated = (feedId: string, posts: string[]) => {
          if (feedId === this.curatedFeedId) {
            this.processCuratedFeed(posts)
            llmFeedService.on('feed-updated', onFeedUpdated)
          }
        }
        
        // Listen for feed updates
        llmFeedService.on('feed-updated', onFeedUpdated)
        
        // Get the cached feed if available (might be available immediately if cached)
        const cachedFeed = llmFeedService.getCachedFeed(this.curatedFeedId)
        if (cachedFeed) {
          this.processCuratedFeed(cachedFeed)
        }
        
        // Return what we have so far (may be uncurated if curation is still running)
        return this.buildResponse(limit, cursor)
      } catch (error) {
        console.error('Error curating feed:', error)
        // Fallback to returning the raw feed if curation fails
        return {
          cursor: undefined,
          feed: this.rawFeed.slice(0, limit),
        }
      }
    } else {
      // For subsequent pages, just return more results from our existing feed
      return this.buildResponse(limit, cursor)
    }
  }

  private processCuratedFeed(curatedPosts: string[]) {
    // Store the URIs of posts that were selected by the LLM
    this.curatedPostUris = new Set(curatedPosts)
    this.isCurating = false
  }

  private buildResponse(limit: number, cursor?: string): FeedAPIResponse {
    // If we have a curated feed, filter the raw feed based on the curated post URIs
    let resultFeed: BskyFeedViewPost[] = []
    
    if (this.curatedPostUris.size > 0) {
      // Filter to only include curated posts
      // Keep the original post objects but filter based on text content
      // Note: we're comparing by text content which is not ideal but works for prototype
      resultFeed = this.rawFeed.filter(post => {
        const record = post.post.record as any
        return record?.text && this.curatedPostUris.has(record.text)
      })
      
      // If we don't have any posts after filtering, use a subset of the raw feed 
      // to avoid showing an empty feed with styling issues
      if (resultFeed.length === 0 && this.rawFeed.length > 0) {
        resultFeed = this.rawFeed.slice(0, Math.min(10, this.rawFeed.length))
      }
    } else {
      // If curation is still in progress or failed, just use the raw feed
      resultFeed = this.rawFeed
    }
    
    // Handle pagination
    let startIndex = 0
    if (cursor) {
      // Simple cursor implementation based on index
      startIndex = parseInt(cursor, 10)
    }
    
    // Get a slice of the feed for this page
    const endIndex = Math.min(startIndex + limit, resultFeed.length)
    const slicedFeed = resultFeed.slice(startIndex, endIndex)
    
    // Determine if there are more results
    const nextCursor = endIndex < resultFeed.length ? endIndex.toString() : undefined
    
    // Add proper styling context to each feed item if needed
    const processedFeed = slicedFeed.map(post => {
      // Ensure we don't lose any styling or context properties
      return {...post}
    })
    
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
}