import { type AppBskyFeedDefs } from '@atproto/api';

/**
 * PostFilter: Filter class to filter the list of posts, without any reliance on the custom implementation.
 */
export interface PostFilter {
  /**
   * filter(): Asynchronously filter entries in postList to create a new filtered list of posts.
   *
   * The returned post list is a a new, separate list, but posts aren't deep cloned.
   *
   * @param {AppBskyFeedDefs.FeedViewPost[]} postList - The list of posts to filter.
   * @returns {Promise<AppBskyFeedDefs.FeedViewPost[]>} A filtered list of posts.
   */
  filter(postList: AppBskyFeedDefs.FeedViewPost[]): Promise<AppBskyFeedDefs.FeedViewPost[]>;
}
