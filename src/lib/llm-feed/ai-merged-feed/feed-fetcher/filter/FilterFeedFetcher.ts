import { type FeedAPIResponse } from '#/lib/api/feed/types';
import { type BskyFeedFetcher } from '../BskyFeedFetcher';
import { type PostFilter } from './PostFilter';

/**
 * FilterFeedFetcher: Filters posts obtained via a wrapped BskyFeedFetcher.
 *
 * As the filter is generally meant to be an AI, PostFilter interface is async.
 */
export class FilterFeedFetcher implements BskyFeedFetcher {
  private base: BskyFeedFetcher;
  private filter: PostFilter;

  /**
   * Constructor: Sets the base fetcher used and the filter that will be applied upon fetch.
   */
  constructor(base: BskyFeedFetcher, filter: PostFilter) {
    this.base = base;
    this.filter = filter;
  }

  /**
   * fetchPosts(): Delegates fetch to base and then filter the post list while leaving cursor unmodified.
   *
   * @param {Object} options - see your base fetcher for more details.
   */
  async fetchPosts(options: {
    cursor?: string;
    limit: number;
  }): Promise<FeedAPIResponse> {
    const response: FeedAPIResponse = await this.base.fetchPosts(options);

    response.feed = await this.filter.filter(response.feed);

    return response;
  }
}