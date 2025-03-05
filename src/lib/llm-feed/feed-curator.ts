import {BskyAgent} from '@atproto/api'
import {UserProfile} from './types'
import {logger} from '#/logger'

/**
 * Implements LLM-based feed curation functionality
 */
export class FeedCurator {
  private apiKey: string
  private baseURL: string
  
  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey
    this.baseURL = baseURL
  }
  
  /**
   * Creates a string representation of user subscriptions for LLM prompt
   */
  private stringifySubscriptions(subscriptions: {user_handle: string, user_bio: string}[]): string {
    let stringified_subscriptions = ""
    for (const sub of subscriptions) {
      stringified_subscriptions += `Subscribed personality handle: ${sub.user_handle}\nSubscribed personality bio: ${sub.user_bio}\n\n`
    }
    return stringified_subscriptions
  }
  
  /**
   * Creates a string representation of posts for LLM prompt
   */
  private stringifyPosts(posts: string[]): string {
    let stringified_posts = ""
    for (let idx = 0; idx < posts.length; idx++) {
      stringified_posts += `POST INDEX: ${idx + 1}\nPost content:\n${posts[idx]}\n--end content--\n\n`
    }
    return stringified_posts
  }
  
  /**
   * Curates a feed using LLM
   */
  public async curateFeed(
    subscriptions: {user_handle: string, user_bio: string}[],
    posts: string[],
    personality: string,
    languages?: string
  ): Promise<string[]> {
    try {
      const stringified_subscriptions = this.stringifySubscriptions(subscriptions)
      const stringified_posts = this.stringifyPosts(posts)
      
      // In an actual implementation, this would call an LLM API
      // For now, we'll simulate the LLM response with a basic algorithm
      
      // Simple filtering algorithm (in a real implementation, this would be LLM-based)
      const selectedIndices = this.simulateLLMCuration(posts, personality, languages)
      
      // Return selected posts
      // Add a special marker to the posts to make them easier to identify
      return selectedIndices.map(idx => {
        // We keep the original post text intact to make it easier to identify later
        return posts[idx]
      })
      
    } catch (error) {
      logger.error('Error in curate feed:', {error: String(error)})
      return []
    }
  }
  
  /**
   * Simulates LLM-based curation (in actual implementation, this would call the LLM API)
   */
  private simulateLLMCuration(posts: string[], personality: string, languages?: string): number[] {
    // Simple algorithm to select about half of the posts
    const selectedIndices: number[] = []
    
    // Select posts based on length and content patterns
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      
      // Skip very short posts
      if (post.length < 10) continue
      
      // Select posts that might be more interesting based on content
      if (
        // Posts with questions
        post.includes('?') ||
        // Posts with links (potential resources)
        post.includes('http') ||
        // Posts with emphasis
        post.includes('!') ||
        // Select some posts simply based on position (for variety)
        i % 3 === 0
      ) {
        selectedIndices.push(i)
      }
    }
    
    // Ensure we return at least some posts
    if (selectedIndices.length === 0 && posts.length > 0) {
      // If no posts were selected, select a few based on position
      for (let i = 0; i < Math.min(posts.length, 5); i++) {
        selectedIndices.push(i)
      }
    }
    
    return selectedIndices
  }
}