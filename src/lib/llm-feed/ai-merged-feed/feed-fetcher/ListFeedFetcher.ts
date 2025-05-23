import { BskyAgent } from '@atproto/api';

import { FeedAPIResponse } from '#/lib/api/feed/types';
import { BskyFeedFetcher } from './BskyFeedFetcher';
import { BskyFeedFetcherUtil } from './BskyFeedFetcherUtil';

/**
 * ListFeedFetcher: Fetches posts from a specified Bluesky list.
 *
 * This class implements the BskyFeedFetcher interface to retrieve posts from
 * a specific Bluesky list, identified by its URI. It uses the Bluesky Agent
 * to interact with the API and fetch the list feed data.
 */
export class ListFeedFetcher implements BskyFeedFetcher {
  private agent: BskyAgent;
  private listUri: string;

  /**
   * Constructor: Initializes the ListFeedFetcher with a Bluesky Agent and list URI.
   *
   * @param {BskyAgent} agent - The Bluesky Agent used to interact with the API.
   * @param {string} listUri - The URI of the Bluesky list to fetch posts from.
   */
  constructor(agent: BskyAgent, listUri: string) {
    this.agent = agent;
    this.listUri = listUri;
  }

  /**
   * fetchPosts(): Retrieves a list of posts from the specified Bluesky list.
   *
   * @param {Object} options - The details of what posts we want to fetch.
   * @param {string | undefined} options.cursor - Where we left off in the list, if we're fetching more posts.
   * @param {number} options.limit - How many posts we want to grab in this batch.
   * @returns {Promise<FeedAPIResponse>} A list of posts from the Bluesky list.
   */
  async fetchPosts(options: {
    cursor?: string;
    limit: number;
  }): Promise<FeedAPIResponse> {
    const response = await this.agent.app.bsky.feed.getListFeed({
      list: this.listUri,
      cursor: options.cursor,
      limit: options.limit,
    });
    return BskyFeedFetcherUtil.processApiResponse(response, options.limit, options.cursor);
  }
}