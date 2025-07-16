import { type FeedAPIResponse } from '#/lib/api/feed/types';

/**
 * BskyFeedFetcher: A generic interface for fetching posts from a single Bluesky feed.
 *
 * This interface provides a consistent way to fetch posts from a specific Bluesky feed,
 * such as a custom feed, list, or the main timeline. The feed URI is provided during
 * the creation of the fetcher, allowing for a focused retrieval of posts from a
 * single source.
 *
 * Think of it as a dedicated channel for retrieving posts from a specific feed,
 * ensuring that all fetched posts come from the same source.
 */
export interface BskyFeedFetcher {
  /**
   * fetchPosts(): Grabs a list of posts from the associated Bluesky feed.
   *
   * @param {Object} options - The details of what posts we want to fetch.
   * @param {string | undefined} options.cursor - Where we left off in the feed, if we're fetching more posts.
   * @param {number} options.limit - How many posts we want to grab in this batch.
   * @returns {Promise<FeedAPIResponse>} A list of posts, ready to be displayed.
   */
  fetchPosts(options: {
    cursor?: string;
    limit: number;
  }): Promise<FeedAPIResponse>;
}
