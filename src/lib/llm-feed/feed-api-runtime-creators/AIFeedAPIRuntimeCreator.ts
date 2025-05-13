import {type FeedAPI} from '#/lib/api/feed/types'
import {aiModeFeedDescriptor} from '#/lib/llm-feed/types'
import {ShellAIFeedAPI} from '../ai-merged-feed/ShellAIFeedAPI'
import {
  type FeedAPICreationArgs,
  type FeedAPIRuntimeCreator,
} from './FeedAPIRuntimeCreator'
import {preferences} from './FeedAPIRuntimeCreatorContext'

/**
 * AIFeedAPIRuntimeCreator: Creates and manages the AI-driven merged feed API.
 *
 * This class implements the FeedAPIRuntimeCreator interface to provide a factory
 * for creating and caching ShellAIFeedAPI instances. It handles the initialization
 * of the AI-driven feed and ensures that only one instance is active.
 */
export class AIFeedAPIRuntimeCreator implements FeedAPIRuntimeCreator {
  private static instance: AIFeedAPIRuntimeCreator | null = null

  /**
   * getInstance(): Returns a singleton instance of AIFeedAPIRuntimeCreator.
   *
   * This static method ensures that only one instance of the creator exists
   * throughout the application, optimizing resource usage.
   * (This static method might disappear if constructor arguments are required later)
   *
   * @returns The singleton instance of AIFeedAPIRuntimeCreator.
   */
  static getInstance(): AIFeedAPIRuntimeCreator {
    if (!AIFeedAPIRuntimeCreator.instance) {
      AIFeedAPIRuntimeCreator.instance = new AIFeedAPIRuntimeCreator()
    }
    return AIFeedAPIRuntimeCreator.instance
  }

  private cache: FeedAPI | null = null

  /**
   * initializeAIFeed(): Initializes the AI feed and returns a cached instance if available.
   *
   * This private method is responsible for creating and starting the asynchronous
   * initialization of the ShellAIFeedAPI. It also implements a caching mechanism
   * to return the same instance on subsequent calls, improving performance.
   *
   * @param args - The arguments required for creating the FeedAPI.
   * @returns The initialized ShellAIFeedAPI instance.
   * @throws Error - If preferences data is unavailable, preventing AI feed creation.
   */
  private initializeAIFeed(args: FeedAPICreationArgs): FeedAPI {
    // If the AI feed API has already been created and cached, return the existing instance.
    // This avoids redundant initialization, which can be resource-intensive.
    if (this.cache != null) {
      return this.cache
    }

    const agent = args.agent

    // 1. Ensure preferences data is available before proceeding.
    if (!preferences) {
      throw new Error('Preferences data is unavailable.')
    }

    // 2. Create a new instance of the ShellAIFeedAPI with the necessary dependencies.
    const shellFeed = new ShellAIFeedAPI(agent, preferences.savedFeeds)

    // 3. Initiate the asynchronous initialization process of the AI feed.
    // This allows the feed to start fetching and analyzing data in the background.
    shellFeed.startInitialization()

    // 4. Cache the created ShellAIFeedAPI instance for future use and return it.
    this.cache = shellFeed

    return this.cache
  }

  /**
   * maybeCreateAPI(): Attempts to create and return the ShellAIFeedAPI instance if the feed descriptor matches.
   *
   * This method implements the FeedAPIRuntimeCreator interface. It first ensures
   * that the AI feed is initialized (or retrieves the cached instance). Then, it
   * checks if the provided feed descriptor matches the one for the AI mode feed.
   * It ONLY returns the AI feed API instance when the descriptor specifically
   * requests the AI mode feed, not for other types like LLM curated feeds.
   *
   * @param args - The arguments for creating the FeedAPI, including the feed descriptor.
   * @returns The ShellAIFeedAPI instance if the feed descriptor matches 'ai-mode-feed',
   * otherwise returns null, indicating this creator does not handle the request.
   * @throws Error - If preferences data is unavailable during initialization.
   */
  maybeCreateAPI(args: FeedAPICreationArgs): FeedAPI | null {
    // Ensure the AI feed is initialized. This happens in the background,
    // so calling it here ensures it starts even if this specific request isn't for the AI feed.
    //
    // This allows to start curating posts well in advance to improve performance and
    // diversity.
    const aiModeFeedAPI = this.initializeAIFeed(args)

    // Check if this creator should handle the provided feed descriptor.
    // It should only return the AI feed API when the descriptor explicitly asks for the AI mode feed.
    if (args.feedDesc !== aiModeFeedDescriptor) {
      return null // This creator does not handle the requested feed descriptor.
    }

    return aiModeFeedAPI // Return the initialized AI feed API instance.
  }
}
