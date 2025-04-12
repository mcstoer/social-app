import { BskyAgent } from '@atproto/api';
import { BskyFeedFetcher } from './BskyFeedFetcher';
import { BskyFeedFetcherUtil } from './BskyFeedFetcherUtil';
import { FeedAPIResponse } from 'lib/api/feed/types';

/**
 * CustomFeedFetcher: Fetches posts from a specified custom feed.
 *
 * This class implements the BskyFeedFetcher interface to retrieve posts from
 * a specific custom feed, identified by its URI. It uses the Bluesky Agent
 * to interact with the API and fetch the feed data.
 */
export class CustomFeedFetcher implements BskyFeedFetcher {
  private agent: BskyAgent;
  private feedUri: string;

  /**
   * Constructor: Initializes the CustomFeedFetcher with a Bluesky Agent and feed URI.
   *
   * @param {BskyAgent} agent - The Bluesky Agent used to interact with the API.
   * @param {string} feedUri - The URI of the custom feed to fetch posts from.
   */
  constructor(agent: BskyAgent, feedUri: string) {
    this.agent = agent;
    this.feedUri = feedUri;
  }

  /**
   * fetchPosts(): Retrieves a list of posts from the specified custom feed.
   *
   * @param {Object} options - The details of what posts we want to fetch.
   * @param {string | undefined} options.cursor - Where we left off in the feed, if we're fetching more posts.
   * @param {number} options.limit - How many posts we want to grab in this batch.
   * @returns {Promise<FeedAPIResponse>} A list of posts from the custom feed.
   */
  async fetchPosts(options: {
    cursor?: string;
    limit: number;
  }): Promise<FeedAPIResponse> {
    const response = await this.agent.app.bsky.feed.getFeed({
      feed: this.feedUri,
      cursor: options.cursor,
      limit: options.limit,
    });
    return BskyFeedFetcherUtil.processApiResponse(response, options.limit, options.cursor);
  }
}