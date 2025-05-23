import { AppBskyFeedDefs } from '@atproto/api';

import { type FeedAPI, type FeedAPIResponse } from '#/lib/api/feed/types'; // Import FeedAPI and FeedAPIResponse
import { Cursor } from './Cursor';
import { PostWaiter } from './PostWaiter';
import { StringCursorManager } from './StringCursorManager';
import { WindowMergedAdvisor } from './WindowMergedAdvisor';


/**
 * AIMergedFeed: Implements an AI-driven merged feed using sliding windows.
 *
 * This class manages the merging and shuffling of posts from multiple feed sources,
 * providing a unified and diverse feed experience. It utilizes a sliding window
 * approach to efficiently manage and shuffle posts, ensuring a continuous flow
 * of fresh and varied content.
 */
export class AIMergedFeed implements FeedAPI {
  private sourcePostLists: AppBskyFeedDefs.FeedViewPost[][];
  private advisor: WindowMergedAdvisor;
  private waiter: PostWaiter;
  private cursorManager: StringCursorManager = new StringCursorManager();

  /**
   * Constructor: Initializes the AIMergedFeed with feed sources, advisor, and waiter.
   *
   * @param sourcePostLists - The lists of posts from the feed sources.
   * @param advisor - The advisor for notifying about post consumption.
   * @param waiter - The waiter for waiting for new posts.
   */
  constructor(
    sourcePostLists: AppBskyFeedDefs.FeedViewPost[][],
    advisor: WindowMergedAdvisor,
    waiter: PostWaiter,
  ) {
    this.sourcePostLists = sourcePostLists;
    this.advisor = advisor;
    this.waiter = waiter;
  }

  /**
   * fetch(): Retrieves posts from the merged feed.
   *
   * This method retrieves a specified number of posts from the merged feed,
   * using a sliding window approach. It manages cursors and waits for new posts
   * when necessary.
   *
   * @param cursor - The cursor to use for retrieval.
   * @param limit - The number of posts to retrieve.
   * @returns A Promise that resolves to a FeedAPIResponse.
   */
  async fetch({
    cursor,
    limit,
  }: {
    cursor: string | undefined;
    limit: number;
  }): Promise<FeedAPIResponse> {
    let currentCursor: Cursor | null = null;
    if (cursor == null) {
      currentCursor = this.cursorManager.create(
        limit * 3,
        this.sourcePostLists,
      );

      // Forcefully wait few seconds to allow AI to collect posts.
      await new Promise(function(resolve) {
        setTimeout(resolve, 10000);
      });
    } else {
      currentCursor = this.cursorManager.find(cursor);
    }

    while (true) {
      const posts = this._fetchSingleRun(currentCursor, limit);
      if (posts != null && posts.length > 0) {
        this.advisor.adviseMerger(currentCursor.getForwardWindows());
        return {
          feed: posts,
          cursor: this.cursorManager.emit(currentCursor),
        };
      }
      await this.waiter.wait();
    }
  }

  /**
   * _fetchSingleRun(): Retrieves posts from the shuffled window synchronously.
   *
   * This method retrieves posts from the shuffled window associated with the
   * given cursor. It does not wait for new posts.
   *
   * @param cursor - The cursor to use for retrieval.
   * @param limit - The number of posts to retrieve.
   * @returns The retrieved posts, or null if no posts are available.
   */
  private _fetchSingleRun(
    cursor: Cursor,
    limit: number,
  ): AppBskyFeedDefs.FeedViewPost[] | null {
    return cursor.take(limit);
  }

  /**
   * peekLatest(): Retrieves the latest post from the merged feed.
   *
   * This method is not implemented in the AIMergedFeed class, as it requires
   * a different approach to determine the latest post across multiple feed sources.
   *
   * @returns A Promise that resolves to undefined.
   */
  async peekLatest(): Promise<AppBskyFeedDefs.FeedViewPost> {
    // Never resolve.
    return new Promise((_) => {});
  }
}
