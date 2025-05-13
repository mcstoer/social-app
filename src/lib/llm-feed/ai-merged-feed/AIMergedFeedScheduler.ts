// AIMergedFeedScheduler.ts

import { AppBskyFeedDefs } from '@atproto/api';
import { CombinedScheduler } from './CombinedScheduler';
import { ForwardSlidingWindow } from './ForwardSlidingWindow';
import { BackgroundPostFetcher } from './BackgroundPostFetcher';

/**
 * AIMergedFeedScheduler: An implementation of the CombinedScheduler interface.
 *
 * This class combines the logic for deciding when to fetch more posts,
 * tracking the consumption of posts, and managing the waiting for new content.
 * It acts as a central hub for coordinating the fetching and consumption of posts,
 * ensuring a smooth and efficient feed experience.
 */
export class AIMergedFeedScheduler implements CombinedScheduler {
  private postsConsumed: number = 0;
  private targetPosts: number;
  private currentWaitPromise: Promise<void> | null = null;
  private currentResolve: (() => void) | null = null;
  private lastTotalPosts: number = 0;
  private fetcher: BackgroundPostFetcher;

  constructor(fetcher: BackgroundPostFetcher, targetPosts: number) {
    this.fetcher = fetcher;
    this.targetPosts = targetPosts;
  }

  /**
   * shouldFetchMoreCheck(): Checks if more posts should be fetched based on the current state.
   *
   * @returns `true` if more posts should be fetched, `false` otherwise.
   */
  private shouldFetchMoreCheck(): boolean {
    return this.postsConsumed > this.lastTotalPosts * 0.7 || this.lastTotalPosts < this.targetPosts;
  }

  /**
   * shouldFetchMore(): Determines if more posts should be fetched based on feed content and manages waiting.
   *
   * This implementation checks if the number of posts consumed is approaching the target,
   * stores the total posts for future checks, and resolves the wait promise if needed.
   *
   * @param sourcePostLists - The current lists of posts from the feed sources.
   * @returns `true` if more posts should be fetched, `false` otherwise.
   */
  shouldFetchMore(sourcePostLists: AppBskyFeedDefs.FeedViewPost[][]): boolean {
    // Count the total number of posts from all feed sources.
    let totalPosts = 0;
    for (const list of sourcePostLists) {
      totalPosts += list.length;
    }

    // Resolve the wait promise only if the total number of posts has changed.
    if (this.currentResolve !== null && totalPosts !== this.lastTotalPosts) {
      this.currentResolve();
      this.currentResolve = null;
      this.currentWaitPromise = null;
    }

    // Update the last total posts count for future checks.
    this.lastTotalPosts = totalPosts;

    // Return the result of the check.
    return this.shouldFetchMoreCheck();
  }

  /**
   * adviseMerger(): Notifies the scheduler about the current state of the forward sliding windows.
   *
   * This implementation updates the postsConsumed count based on the window offsets.
   *
   * @param forwardWindows - The list of ForwardSlidingWindow instances representing the feed sources.
   */
  adviseMerger(forwardWindows: ForwardSlidingWindow[]): void {
    // Update the number of posts consumed.
    this.postsConsumed = 0;
    for (const window of forwardWindows) {
      this.postsConsumed += window.offset;
    }

    // Activate the fetcher if more posts should be fetched.
    if (this.shouldFetchMoreCheck()) {
      this.fetcher.activate(this);
    }
  }

  /**
   * wait(): Waits for new posts to become available and activates the fetcher.
   *
   * @returns A Promise that resolves when new posts are available.
   */
  wait(): Promise<void> {
    // Activate the fetcher to start fetching new posts.
    this.fetcher.activate(this);

    // Create a new promise only if one doesn't exist.
    if (this.currentWaitPromise === null) {
      this.currentWaitPromise = new Promise(resolve => {
        this.currentResolve = resolve;
      });
    }

    // Return the stored promise.
    return this.currentWaitPromise;
  }
}