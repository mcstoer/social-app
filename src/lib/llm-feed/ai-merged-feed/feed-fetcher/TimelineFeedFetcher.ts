import { BskyAgent } from '@atproto/api';
import { BskyFeedFetcher } from './BskyFeedFetcher';
import { BskyFeedFetcherUtil } from './BskyFeedFetcherUtil';
import { FeedAPIResponse } from 'lib/api/feed/types';

/**
 * TimelineFeedFetcher: Fetches posts from the user's timeline.
 *
 * This class implements the BskyFeedFetcher interface to retrieve posts from the
 * user's main timeline. It uses the Bluesky Agent to interact with the API
 * and fetch the timeline data.
 */
export class TimelineFeedFetcher implements BskyFeedFetcher {
  private agent: BskyAgent;

  /**
   * Constructor: Initializes the TimelineFeedFetcher with a Bluesky Agent.
   *
   * @param {BskyAgent} agent - The Bluesky Agent used to interact with the API.
   */
  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  /**
   * fetchPosts(): Retrieves a list of posts from the user's timeline.
   *
   * @param {Object} options - The details of what posts we want to fetch.
   * @param {string | undefined} options.cursor - Where we left off in the timeline, if we're fetching more posts.
   * @param {number} options.limit - How many posts we want to grab in this batch.
   * @returns {Promise<FeedAPIResponse>} A list of posts from the timeline.
   */
  async fetchPosts(options: {
    cursor?: string;
    limit: number;
  }): Promise<FeedAPIResponse> {
    const response = await this.agent.getTimeline({
      cursor: options.cursor,
      limit: options.limit,
    });
    return BskyFeedFetcherUtil.processApiResponse(response, options.limit, options.cursor);
  }
}