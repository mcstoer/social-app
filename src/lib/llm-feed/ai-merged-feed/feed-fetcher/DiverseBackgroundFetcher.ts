import { type AppBskyFeedDefs } from '@atproto/api';

import { type FeedAPIResponse } from '#/lib/api/feed/types';
import { type BackgroundPostFetcher } from '../BackgroundPostFetcher';
import { type ShouldFetchScheduler } from '../ShouldFetchScheduler';
import { type BskyFeedFetcher } from './BskyFeedFetcher';

/**
 * DiverseBackgroundFetcher: Implements background fetching from a diverse list of Bluesky feeds.
 *
 * This class implements the BackgroundPostFetcher interface by managing a list of
 * BskyFeedFetcher instances. It fetches posts from these feeds in a rotating and
 * concurrent manner (up to 3 at a time) to provide a diverse stream of content.
 * The order of feeds is shuffled at the beginning of each fetching cycle to further
 * enhance diversity.
 */
export class DiverseBackgroundFetcher implements BackgroundPostFetcher {
  private shuffledCursorList: FetcherCursor[] = [];
  private _sourcePostLists: AppBskyFeedDefs.FeedViewPost[][] = [];
  private isActive: boolean = false;
  private currentOffset: number = 0;

  /**
   * Constructor: Initializes the DiverseBackgroundFetcher with a list of BskyFeedFetcher instances.
   *
   * @param {BskyFeedFetcher[]} fetchers - The list of BskyFeedFetcher instances representing different feed sources.
   */
  constructor(fetchers: BskyFeedFetcher[]) {
    // Convert each provided BskyFeedFetcher into a FetcherCursor to manage its state.
    this.shuffledCursorList = new Array(fetchers.length);
    for (let i = 0; i < fetchers.length; i++) {
      this.shuffledCursorList[i] = new FetcherCursor(fetchers[i]);
    }

    // Create a list of references to the post lists within each FetcherCursor.
    // This allows the scheduler to easily access the current state of all feeds.
    this._sourcePostLists = new Array(fetchers.length);
    for (let i = 0; i < fetchers.length; i++) {
      this._sourcePostLists[i] = this.shuffledCursorList[i].postList;
    }
  }

  // See BackgroundPostFetcher.sourcePostLists() to learn more.
  sourcePostLists(): AppBskyFeedDefs.FeedViewPost[][] {
    return this._sourcePostLists;
  }

  /**
   * activate(): Starts or resumes the background fetching of posts.
   *
   * @param {ShouldFetchScheduler} scheduler - The ShouldFetchScheduler object that dictates when to fetch more posts.
   */
  async activate(scheduler: ShouldFetchScheduler): Promise<void> {
    // Prevent concurrent activations to avoid race conditions and redundant fetching.
    if (this.isActive) {
      return;
    }
    this.isActive = true;

    while (scheduler.shouldFetchMore(this._sourcePostLists)) {
      // Shuffle the feed list at the start of each cycle to ensure diversity.
      if (this.currentOffset === 0) {
        this.shuffleCursorList();
      }

      const numFetchers = this.shuffledCursorList.length;
      const fetchPromises: Promise<void>[] = [];
      const numToFetch = Math.min(3, numFetchers - this.currentOffset);

      // Initiate concurrent fetch operations for up to 3 feeds.
      for (let i = 0; i < numToFetch; i++) {
        // Calculate the index of the FetcherCursor to use, wrapping around the list if necessary.
        // The modulo operator ensures we cycle through the shuffled list.
        const index = (this.currentOffset + i) % numFetchers;
        const fetcherCursor = this.shuffledCursorList[index];

        // Initiate the fetch operation using the FetcherCursor's method.
        const fetchPromise = fetcherCursor.fetch();
        fetchPromises.push(fetchPromise);
      }

      // Wait for all concurrent fetch operations to complete.
      await Promise.allSettled(fetchPromises);

      // Update the offset for the next iteration.
      this.currentOffset += numToFetch;
      if (this.currentOffset >= numFetchers) {
        this.currentOffset = 0; // Wrap around to the beginning of the list.
      }
    }

    this.isActive = false; // Set the active flag to false when the scheduler says to stop.
  }

  /**
   * shuffleCursorList(): Shuffles the shuffledCursorList array in place using Fisher-Yates algorithm.
   *
   * This method is called at the beginning of each fetching cycle (when currentOffset is 0)
   * to randomize the order in which feeds are fetched, contributing to a more diverse feed.
   */
  private shuffleCursorList(): void {
    for (let i = this.shuffledCursorList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledCursorList[i], this.shuffledCursorList[j]] = [
        this.shuffledCursorList[j],
        this.shuffledCursorList[i],
      ];
    }
  }
}

/**
 * FetcherCursor: Holds the feed fetcher, cursor value, and post list for a specific feed.
 *
 * This class encapsulates the state and functionality for fetching posts from a
 * single feed, including the fetcher instance, cursor for pagination, and the
 * list of fetched posts.
 */
class FetcherCursor {
  fetcher: BskyFeedFetcher;
  cursor: string | undefined = undefined;
  postList: AppBskyFeedDefs.FeedViewPost[] = [];

  constructor(fetcher: BskyFeedFetcher) {
    this.fetcher = fetcher;
  }

  /**
   * fetch(): Fetches posts from the associated BskyFeedFetcher and updates the state.
   *
   * @returns {Promise<void>} A promise that resolves when the fetch operation is complete.
   */
  async fetch(): Promise<void> {
    try {
      const response: FeedAPIResponse = await this.fetcher.fetchPosts({
        cursor: this.cursor,
        limit: 20, // Fetch a reasonable number of posts per feed.
      });
      this.postList.push(...response.feed);
      this.cursor = response.cursor;
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Gracefully handle fetch errors; the background fetcher will continue with other feeds.
    }
  }
}