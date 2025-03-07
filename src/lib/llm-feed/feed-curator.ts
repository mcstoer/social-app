import {BskyAgent} from '@atproto/api'
import {UserProfile} from './types'
import {logger} from '#/logger'
import OpenAI from 'openai'
import { FEED_PROMPTS } from './prompts'

// Notably, this code is separate from bluesky's normal code/flow, it can be customized at will so long as it still returns the needed information

/**
 * Implements LLM-based feed curation functionality
 */
export class FeedCurator {
  private apiKey: string
  private baseURL: string
  private openai: OpenAI | null = null
  private readonly defaultMaxPosts = 50;
  private readonly feedSourcesDivisor = 2;
  
  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey
    this.baseURL = baseURL
    this.openai = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Allow browser usage with caution
    })
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
      // Log inputs
      console.log('==== LLM FEED CURATION STARTED ====');
      console.log('INPUT - Personality:', personality);
      console.log('INPUT - Languages:', languages || 'Not specified');
      console.log('INPUT - Subscriptions count:', subscriptions.length);
      console.log('INPUT - Posts count:', posts.length);
      
      // Log sample of subscriptions
      console.log('INPUT - Subscriptions sample (first 5):');
      subscriptions.slice(0, 5).forEach((sub, i) => {
        console.log(`SUB ${i+1}: @${sub.user_handle} - ${sub.user_bio}`);
      });
      
      // Log sample of posts
      console.log('INPUT - Posts sample (first 3):');
      posts.slice(0, 3).forEach((post, i) => {
        console.log(`POST ${i+1}:\n${post}\n---`);
      });
      
      // Format inputs for the LLM
      const stringified_subscriptions = this.stringifySubscriptions(subscriptions)
      const stringified_posts = this.stringifyPosts(posts)
      
      // Build what would be the prompt in a real implementation
      const promptMessages = [...FEED_PROMPTS.POST_CURATION,
          {
              role: 'user',
              content: `User personality: 
"""
${personality}
"""

User subscriptions list:
"""
${stringified_subscriptions}
"""

----

Some raw materials (recent posts from the subscribers) to make a feed from:
"""
${stringified_posts}
"""

Preferred languages:
"""
${languages}
"""

Note that user subscriptions are shown to give you additional hints about their interests. The user's subscriptions may not show up in the raw materials you see, and in fact you do not know who has written each individual post.

Only select posts that are in the preferred languages.

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`
        }
    ]
      
      const openai = this.openai || null;
      if (!openai) {
        throw new Error('OpenAI client is not initialized');
      }
      
      const chatCompletion = await openai.chat.completions.create({
        messages: promptMessages as any,
        model: 'meta-llama/Meta-Llama-3-70B-Instruct',
        max_completion_tokens: 500
      })

      console.log('SIMULATED PROMPT:\n', promptMessages);
      const selectedIndices = [...new Set(
          chatCompletion.choices[0].message.content?.
              split('\n')
              .map(line => parseInt(line.trim()))
              .filter(num => !isNaN(num))  // Only keep valid numbers
              .map(num => num - 1)  // Convert to 0-based indices
              .filter(idx => idx >= 0 && idx < posts.length)  // Ensure index is valid
      )];

      // Limit the number of selected posts
      const maxPosts = Math.floor(this.defaultMaxPosts / this.feedSourcesDivisor);
      const limitedIndices = selectedIndices.slice(0, maxPosts);
      
      // Return selected posts in the order specified by the deduplicated indices
      return limitedIndices.map(idx => posts[idx as number]);
      
    } catch (error) {
      console.error('ERROR IN FEED CURATION:', error);
      logger.error('Error in curate feed:', {
        error: String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        personality: personality,
        languagesCount: languages ? languages.length : 0,
        postsCount: posts.length,
        subscriptionsCount: subscriptions.length
      });
      return []
    }
  }
  
  /**
   * Simulates LLM-based curation (in actual implementation, this would call the LLM API)
   */
  private simulateLLMCuration(posts: string[], personality: string, languages?: string): number[] {
    console.log('SIMULATION - Starting LLM simulation with personality:', personality);
    console.log('SIMULATION - Using selection criteria based on content patterns...');
    
    // Simple algorithm to select about half of the posts
    const selectedIndices: number[] = []
    
    // Create a map to track selection reasons for debugging
    const selectionReasons: Record<number, string[]> = {}
    
    // Track selection statistics
    let skippedShortPosts = 0;
    let selectedQuestionsCount = 0;
    let selectedLinksCount = 0;
    let selectedEmphasisCount = 0;
    let selectedPositionCount = 0;
    let selectedPersonalityMatchCount = 0;
    
    // Attempt to parse personality keywords for matching
    const personalityLower = personality.toLowerCase();
    const personalityKeywords = personalityLower
      .split(/[,.\s]+/)
      .filter(word => word.length > 4)
      .map(word => word.trim());
    
    console.log('SIMULATION - Extracted personality keywords:', personalityKeywords);
    
    // Select posts based on length and content patterns
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      const reasons: string[] = [];
      
      // Skip very short posts
      if (post.length < 10) {
        skippedShortPosts++;
        continue;
      }
      
      // Check for questions (potential engagement)
      if (post.includes('?')) {
        reasons.push('Contains question');
        selectedQuestionsCount++;
      }
      
      // Check for links (potential resources)
      if (post.includes('http')) {
        reasons.push('Contains link');
        selectedLinksCount++;
      }
      
      // Check for emphasis or excitement
      if (post.includes('!')) {
        reasons.push('Contains emphasis');
        selectedEmphasisCount++;
      }
      
      // Select some posts based on position for variety
      if (i % 3 === 0) {
        reasons.push('Position-based selection');
        selectedPositionCount++;
      }
      
      // Check for personality keyword matches
      const postLower = post.toLowerCase();
      const matchedKeywords = personalityKeywords.filter(keyword => 
        postLower.includes(keyword)
      );
      
      if (matchedKeywords.length > 0) {
        reasons.push(`Matched personality keywords: ${matchedKeywords.join(', ')}`);
        selectedPersonalityMatchCount++;
      }
      
      // If any selection criteria were met, add to selected indices
      if (reasons.length > 0) {
        selectedIndices.push(i);
        selectionReasons[i] = reasons;
      }
    }
    
    // Ensure we return at least some posts
    if (selectedIndices.length === 0 && posts.length > 0) {
      console.log('SIMULATION - No posts matched criteria, selecting fallback posts');
      // If no posts were selected, select a few based on position
      for (let i = 0; i < Math.min(posts.length, 5); i++) {
        selectedIndices.push(i);
        selectionReasons[i] = ['Fallback selection'];
      }
    }
    
    // Log selection statistics
    console.log('SIMULATION STATS - Posts skipped (too short):', skippedShortPosts);
    console.log('SIMULATION STATS - Posts with questions:', selectedQuestionsCount);
    console.log('SIMULATION STATS - Posts with links:', selectedLinksCount);
    console.log('SIMULATION STATS - Posts with emphasis:', selectedEmphasisCount);
    console.log('SIMULATION STATS - Posts selected by position:', selectedPositionCount);
    console.log('SIMULATION STATS - Posts matching personality keywords:', selectedPersonalityMatchCount);
    
    // Log selection reasons for first 10 posts
    console.log('SELECTION REASONS (sample):');
    const sampleIndices = selectedIndices.slice(0, 10);
    sampleIndices.forEach(idx => {
      console.log(`Post ${idx} selected because: ${selectionReasons[idx].join(', ')}`);
    });
    
    console.log('SIMULATION - Finished with', selectedIndices.length, 'posts selected');
    
    return selectedIndices;
  }
}