import OpenAI from 'openai'

import {logger} from '#/logger'
import {FEED_PROMPTS} from './prompts'

// Global status tracking instance - we need this accessible outside React context
let globalStatusUpdate: {
  markInProgress: () => void
  markWorking: () => void
  markFailing: () => void
} | null = null

export function setGlobalAIFeedStatusUpdater(updater: {
  markInProgress: () => void
  markWorking: () => void
  markFailing: () => void
}) {
  globalStatusUpdate = updater
}

// Notably, this code is separate from bluesky's normal code/flow, it can be customized at will so long as it still returns the needed information

/**
 * Implements LLM-based feed curation functionality
 */
export class FeedCurator {
  private modelName: string
  private openai: OpenAI | null = null

  constructor(
    apiKey: string,
    baseURL: string,
    modelName: string = 'mistralai/Mistral-Small-24B-Instruct-2501',
  ) {
    this.modelName = modelName
    this.openai = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey,
      dangerouslyAllowBrowser: true, // Allow browser usage with caution
    })
  }

  /**
   * Creates a string representation of user subscriptions for LLM prompt
   */
  private stringifySubscriptions(
    subscriptions: {user_handle: string; user_bio: string}[],
  ): string {
    let stringified_subscriptions = ''
    for (const sub of subscriptions) {
      stringified_subscriptions += `Subscribed personality handle: ${sub.user_handle}\nSubscribed personality bio: ${sub.user_bio}\n\n`
    }
    return stringified_subscriptions
  }

  /**
   * Creates a string representation of posts for LLM prompt
   */
  private stringifyPosts(posts: string[]): string {
    let stringified_posts = ''
    for (let idx = 0; idx < posts.length; idx++) {
      stringified_posts += `POST INDEX: ${idx + 1}\nPost content:\n${posts[idx]}\n--end content--\n\n`
    }
    return stringified_posts
  }

  /**
   * Curates a feed using LLM
   */
  public async curateFeed(
    subscriptions: {user_handle: string; user_bio: string}[],
    posts: string[],
    personality: string,
    languages?: string,
  ): Promise<number[]> {
    try {
      // Mark as in progress when starting OpenAI request
      globalStatusUpdate?.markInProgress()

      // Log inputs
      // console.log('==== LLM FEED CURATION STARTED ====');
      // console.log('INPUT - Personality:', personality);
      // console.log('INPUT - Languages:', languages || 'Not specified');
      // console.log('INPUT - Subscriptions count:', subscriptions.length);
      // console.log('INPUT - Posts count:', posts.length);

      // Log sample of subscriptions
      // console.log('INPUT - Subscriptions sample (first 5):');
      // subscriptions.slice(0, 5).forEach((sub, i) => {
      //   // console.log(`SUB ${i+1}: @${sub.user_handle} - ${sub.user_bio}`);
      // });

      // Log sample of posts
      // console.log('INPUT - Posts sample (first 3):');
      // posts.slice(0, 3).forEach((post, i) => {
      //   // console.log(`POST ${i+1}:\n${post || 'No text available'}\n---`);
      // });

      // Format inputs for the LLM
      const stringified_subscriptions =
        this.stringifySubscriptions(subscriptions)
      const stringified_posts = this.stringifyPosts(posts)

      // Build what would be the prompt in a real implementation
      const promptMessages = [
        ...FEED_PROMPTS.POST_CURATION,
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

Note that user subscriptions are shown to give you additional hints about their interests. The user's subscriptions may not show up in the raw materials you see, and in fact you may not know who has written each individual post.

Only select posts that are in the preferred languages.

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`,
        },
      ]

      const openai = this.openai || null
      if (!openai) {
        throw new Error('OpenAI client is not initialized')
      }

      const chatCompletion = await openai.chat.completions.create({
        messages: promptMessages as any,
        model: this.modelName,
        max_completion_tokens: 500,
      })

      // Mark as working after successful OpenAI request
      globalStatusUpdate?.markWorking()

      // console.log('SIMULATED PROMPT:\n', promptMessages);
      const selectedIndices = [
        ...new Set(
          chatCompletion.choices[0].message.content
            ?.split('\n')
            .map(line => parseInt(line.trim()))
            .filter(num => !isNaN(num)) // Only keep valid numbers
            .map(num => num - 1) // Convert to 0-based indices
            .filter(idx => idx >= 0 && idx < posts.length), // Ensure index is valid
        ),
      ]

      // console.log('SELECTED INDICES:', selectedIndices);
      // console.log('POSTS:', posts);

      // Return selected post IDs in the order specified by the deduplicated indices
      return selectedIndices
    } catch (error) {
      // Mark as failing when OpenAI request errors
      globalStatusUpdate?.markFailing()

      // Reduce console logging and rely on visual indicator instead
      logger.error('Error in curate feed:', {
        error: String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        personality: personality,
        languagesCount: languages ? languages.length : 0,
        postsCount: posts.length,
        subscriptionsCount: subscriptions.length,
      })
      return []
    }
  }
}
