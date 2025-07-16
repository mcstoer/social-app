import { type AppBskyFeedDefs } from '@atproto/api';

import { type ShouldFetchScheduler } from './ShouldFetchScheduler';

/**
 * BackgroundPostFetcher: Manages the automated retrieval of posts for a seamless feed experience.
 *
 * This interface outlines the actions for a component that automatically fetches new posts in the background.
 * Its purpose is to keep the user's feed continuously updated and engaging without requiring manual refreshes.
 *
 * Think of it as a dedicated content delivery system, working behind the scenes to ensure the user always has fresh posts.
 */
export interface BackgroundPostFetcher {
  /**
   * sourcePostLists(): Returns the list of post lists, one for each feed source.
   *
   * This is the primary way to access the fetched posts managed by the background fetcher.
   * The outer list representing the feeds is immutable (its order and the feeds it contains
   * do not change after initialization). However, the individual post lists within this
   * collection are mutable; they will be updated over time as new posts are fetched
   * from their respective feeds.
   *
   * @returns An array where each element is an array of AppBskyFeedDefs.FeedViewPost,
   * representing the fetched posts for a single feed source.
   */
  sourcePostLists(): AppBskyFeedDefs.FeedViewPost[][];

  /**
   * activate(): Starts or resumes the background fetching of posts.
   *
   * This method initiates the process of fetching new posts, using the provided
   * ShouldFetchScheduler to determine when to retrieve more content. It can be called
   * multiple times, but will only start or resume fetching if it is not already active
   * with the same scheduler.
   *
   * scheduler should only change when the fetcher isn't active - if activate has never
   * been called or previous scheduler did stop.
   *
   * @param scheduler - The ShouldFetchScheduler object that dictates when to fetch more posts.
   */
  activate(scheduler: ShouldFetchScheduler): void;
}