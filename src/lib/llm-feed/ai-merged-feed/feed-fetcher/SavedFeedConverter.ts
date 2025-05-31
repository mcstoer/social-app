import { type AppBskyActorDefs,type BskyAgent } from '@atproto/api';

import { type BskyFeedFetcher } from './BskyFeedFetcher';
import { CustomFeedFetcher } from './CustomFeedFetcher';
import { ListFeedFetcher } from './ListFeedFetcher';

/**
 * SavedFeedConverter: Converts an array of SavedFeed objects to a list of BskyFeedFetcher instances.
 *
 * This class provides a utility to convert saved feed preferences into a list of
 * BskyFeedFetcher instances, which can be used to fetch posts from various feed sources.
 * It excludes timeline feeds, as they should be explicitly added by the caller.
 */
export class SavedFeedConverter {
  private agent: BskyAgent;

  /**
   * Constructor: Initializes the SavedFeedConverter with a Bluesky Agent.
   *
   * @param {BskyAgent} agent - The Bluesky Agent used to interact with the API.
   */
  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  /**
   * convert(): Converts an array of SavedFeed objects to a list of BskyFeedFetcher instances.
   *
   * @param {AppBskyActorDefs.SavedFeed[]} savedFeeds - The array of saved feed preferences.
   * @returns {BskyFeedFetcher[]} A list of BskyFeedFetcher instances.
   */
  convert(savedFeeds: AppBskyActorDefs.SavedFeed[]): BskyFeedFetcher[] {
    const fetchers: BskyFeedFetcher[] = [];

    for (const feed of savedFeeds) {
      if (feed.type === 'feed') {
        // 'value' contains the URI of the custom feed.
        fetchers.push(new CustomFeedFetcher(this.agent, feed.value));
      } else if (feed.type === 'list') {
        // 'value' contains the URI of the Bluesky list.
        fetchers.push(new ListFeedFetcher(this.agent, feed.value));
      }
      // Timeline feeds are excluded, as per the requirement.
    }

    return fetchers;
  }
} 