import { type AppBskyFeedDefs } from '@atproto/api';

/**
 * ShouldFetchScheduler: Intelligent feed content evaluator for fetching decisions.
 *
 * This interface outlines the logic for a component that decides when to ask for more posts.
 * It acts like a smart gatekeeper, looking at the current state of the feed sources
 * (like how many posts are available from each) and figuring out if we need to
 * grab more content to keep the user happy.
 *
 * Think of it as a feed manager that prevents us from overloading the API with
 * unnecessary requests, while still ensuring we have enough content to show.
 */
export interface ShouldFetchScheduler {
  /**
   * shouldFetchMore(): Determines if we should get more posts based on the feed's current content.
   *
   * @param sourcePostLists - The lists of posts we've already fetched from each feed source.
   * @returns `true` if we should fetch more posts, `false` if we're good for now.
   */
  shouldFetchMore(sourcePostLists: AppBskyFeedDefs.FeedViewPost[][]): boolean;
}