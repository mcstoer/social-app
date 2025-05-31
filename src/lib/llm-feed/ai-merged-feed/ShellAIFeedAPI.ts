import { type AppBskyActorDefs,type BskyAgent } from '@atproto/api';

 import {
  type FeedAPI,
  type FeedAPIResponse,
 } from '#/lib/api/feed/types';
 import { LLM_API_KEY, LLM_BASE_URL } from '../env'; // Constants for LLM API access
 import { FeedCurator } from '../feed-curator'; // Class for AI curation logic
 import { getCurrentUserProfile } from '../user-profile'; // Function to fetch user profile
 import { AIMergedFeed } from './AIMergedFeed'; // AI-powered feed implementation
 import { AIMergedFeedScheduler } from './AIMergedFeedScheduler'; // Schedules feed updates
 import { DiverseBackgroundFetcher } from './feed-fetcher/DiverseBackgroundFetcher'; // Fetches diverse background posts
import { AICuratorFilter } from './feed-fetcher/filter/AICuratorFilter'; // AI filter plug-in for FilterFeedFetcher
 import { FilterFeedFetcher } from './feed-fetcher/filter/FilterFeedFetcher'; // Filters a single feed fetcher
 import { FilterSavedFeedConverter } from './feed-fetcher/FilterSavedFeedConverter'; // Filters saved feeds
 import { SavedFeedConverter } from './feed-fetcher/SavedFeedConverter'; // Converts saved feeds
 import { TimelineFeedFetcher } from './feed-fetcher/TimelineFeedFetcher'; // Fetches timeline feed

 /**
  * ShellAIFeedAPI: A wrapper around the AI-powered feed API, handling asynchronous initialization.
  *
  * This class acts as an intermediary, allowing for immediate return of a FeedAPI object
  * while the actual AI feed is initialized asynchronously. It ensures that fetch and peekLatest
  * operations wait for the initialization to complete and handles potential errors during the process.
  */
export class ShellAIFeedAPI implements FeedAPI {
  private realFeed: FeedAPI | null = null; // Holds the initialized AI-powered FeedAPI
  private initializationPromise: Promise<void> | null = null; // Promise tracking initialization
  private agent: BskyAgent; // Bluesky agent for API interactions
  private savedFeeds: AppBskyActorDefs.SavedFeed[]; // Array of saved feeds
  private requestSwitchToAccount: (props: {requestedAccount?: string | undefined;}) => void; // Updated signature
  private userNotLoggedIn: boolean = false; // Track if user is not logged in

  /**
   * Constructor: Initializes the ShellAIFeedAPI with the Bluesky agent and saved feeds.
   *
   * @param agent - The Bluesky agent instance.
   * @param savedFeeds - An array of SavedFeed objects.
   * @param requestSwitchToAccount - Function to trigger sign-in flow.
   */
  constructor(
    agent: BskyAgent,
    savedFeeds: AppBskyActorDefs.SavedFeed[],
    requestSwitchToAccount: (props: {requestedAccount?: string | undefined;}) => void,
  ) {
    this.agent = agent;
    this.savedFeeds = savedFeeds;
    this.requestSwitchToAccount = requestSwitchToAccount; // Store the function
  }

  /**
   * initializeRealFeed: Asynchronously initializes the AI-powered FeedAPI.
   *
   * This method fetches the user profile, creates the AI curator, and constructs the
   * necessary feed fetchers and scheduler. It sets the realFeed property upon successful
   * initialization.
   *
   * @throws Error - If fetching the user profile or any other initialization step fails.
   */
  private async initializeRealFeed(): Promise<void> {
    try {
      // 0. Check if user is logged in
      if (!this.agent.hasSession) {
        this.userNotLoggedIn = true; // Set flag
        this.requestSwitchToAccount({requestedAccount: 'none'}); // Call the stored function
        // Return early without throwing an error that would be displayed to the user
        // The redirect will happen, so we just need to prevent further initialization
        return;
      }

      // 1. Fetch user profile data
      const userProfile = await getCurrentUserProfile(this.agent);
      if (!userProfile) {
        throw new Error('Failed to get user profile.');
      }

      // 2. Create the AI feed curator
      const curator = new FeedCurator(LLM_API_KEY, LLM_BASE_URL);

      // 3. Construct the AI curator filter
      const aiCuratorFilter = new AICuratorFilter(
        curator,
        userProfile.subscriptions || [],
        userProfile.personality,
        userProfile.languages
      );

      // 4. Create feed fetchers and converters
      const filterSavedFeedConverter = new FilterSavedFeedConverter(
        new SavedFeedConverter(this.agent),
        aiCuratorFilter
      );

      // 5. Combine all feed fetchers
      const fetchers = [
        new FilterFeedFetcher(
          new TimelineFeedFetcher(this.agent),
          aiCuratorFilter
        ),
        ...filterSavedFeedConverter.convert(this.savedFeeds),
      ];

      // 6. Create the background post fetcher and scheduler
      const backgroundFetcher = new DiverseBackgroundFetcher(fetchers);
      const scheduler = new AIMergedFeedScheduler(backgroundFetcher, 100);

      // 7. Start fetching in background...
      scheduler.wait();

      // 8. Initialize the real AI feed
      this.realFeed = new AIMergedFeed(
        backgroundFetcher.sourcePostLists(),
        scheduler,
        scheduler
      );
    } catch (error) {
      // 9. Rethrow any errors during initialization
      console.error('Failed to initialize real AI feed:', error);
      throw error;
    }
  }

  /**
   * fetch: Retrieves posts from the feed.
   *
   * This method waits for the AI feed to be initialized if it's not ready yet,
   * then delegates the actual fetching to the realFeed's fetch method.
   *
   * @param options - Options for fetching the feed (cursor, limit).
   * @returns A Promise that resolves to a FeedAPIResponse containing the feed and cursor.
   * @throws Error - If the AI feed initialization has not been started or if it failed.
   */
  async fetch(options: {
    cursor: string | undefined;
    limit: number;
  }): Promise<FeedAPIResponse> {
    // 1. Ensure initialization has been started
    if (!this.initializationPromise) {
      throw new Error(
        'AI Feed initialization has not been started. Call startInitialization() first.'
      );
    }

    // 2. Wait for initialization if realFeed is not ready
    if (!this.realFeed) {
      try {
        await this.initializationPromise;
      } catch (error) {
        // Propagate the error if initialization failed (e.g. user not logged in)
        throw error;
      }

      // 3. If user is not logged in, return empty feed instead of throwing error
      if (this.userNotLoggedIn) {
        return {
          cursor: options.cursor,
          feed: [],
        };
      }

      // 3. Throw an error if initialization failed
      if (!this.realFeed) {
        throw new Error('AI Feed initialization failed.');
      }
    }

    // 4. Delegate to the real feed's fetch method
    return this.realFeed.fetch(options);
  }

  /**
   * peekLatest: Retrieves the latest posts from the feed.
   *
   * Similar to fetch, this method waits for initialization and delegates to the
   * realFeed's peekLatest method.
   *
   * @returns A Promise that resolves to the latest posts.
   * @throws Error - If the AI feed initialization has not been started or if it failed.
   */
  async peekLatest(): Promise<any> {
    // 1. Ensure initialization has been started
    if (!this.initializationPromise) {
      throw new Error(
        'AI Feed initialization has not been started. Call startInitialization() first.'
      );
    }

    // 2. Wait for initialization if realFeed is not ready
    if (!this.realFeed) {
      try {
        await this.initializationPromise;
      } catch (error) {
        // Propagate the error if initialization failed (e.g. user not logged in)
        throw error;
      }

      // 3. If user is not logged in, return empty array instead of throwing error
      if (this.userNotLoggedIn) {
        return [];
      }

      // 3. Throw an error if initialization failed
      if (!this.realFeed) {
        throw new Error('AI Feed initialization failed.');
      }
    }

    // 4. Delegate to the real feed's peekLatest method
    return this.realFeed.peekLatest();
  }

  /**
   * startInitialization: Starts the asynchronous initialization of the AI feed.
   *
   * This method should be called externally to begin the process of fetching user
   * data and constructing the AI-powered feed. It ensures that initialization is
   * only started once.
   */
  startInitialization(): void {
    if (!this.initializationPromise) {
      this.initializationPromise = this.initializeRealFeed();
    }
  }
 }