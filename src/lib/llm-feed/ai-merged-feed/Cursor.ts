import { AppBskyFeedDefs } from '@atproto/api';
import { ForwardSlidingWindow } from './ForwardSlidingWindow';

/**
 * Cursor: Manages a shuffled sliding window and tracks the number of posts given.
 *
 * This class is responsible for maintaining a shuffled sliding window of posts,
 * filling it from multiple ForwardSlidingWindow instances, and keeping track of
 * how many posts have been provided to the caller. It prioritizes diversity by:
 * - Using a round-robin approach to select posts from different feed sources, ensuring
 * a balanced representation.
 * - Shuffling the posts to randomize their order, preventing a bias towards any
 * particular feed or recency.
 */
export class Cursor {
  private _postsGiven: number = 0;
  private currentWindow: AppBskyFeedDefs.FeedViewPost[] = [];
  private target: number;
  private forwardWindows: ForwardSlidingWindow[];

  /**
   * Constructor: Initializes the Cursor with a target window size and source post lists.
   *
   * @param target - The target size of the shuffled sliding window.
   * @param sourcePostLists - The lists of posts from the feed sources.
   */
  constructor(
    target: number,
    sourcePostLists: AppBskyFeedDefs.FeedViewPost[][],
  ) {
    this.target = target;
    this.forwardWindows = [];
    for (const list of sourcePostLists) {
      this.forwardWindows.push(new ForwardSlidingWindow(list));
    }
  }

  /**
   * fillWithoutShuffle(): Fills the current window with new posts without shuffling.
   *
   * This method retrieves posts from the forward windows until the current window
   * reaches the target size. It does not shuffle the posts, allowing for sequential
   * retrieval from the feed sources.
   */
  private fillWithoutShuffle(): void {
    let hasAdded = true; // Ensure the loop runs at least once
    while (this.currentWindow.length < this.target && hasAdded) {
      hasAdded = false; // Reset before checking each forward window
      for (const window of this.forwardWindows) {
        const post = window.next();
        if (post) {
          this.currentWindow.push(post);
          hasAdded = true; // Set to true if any post was added
        }
      }
      // Loop continues only if posts were added in the previous iteration,
      // preventing infinite loops when no new posts are available.
    }
  }

  /**
   * shuffle(): Shuffles the current window using the Fisher-Yates algorithm.
   */
  private shuffle(): void {
    for (let i = this.currentWindow.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.currentWindow[i], this.currentWindow[j]] = [
        this.currentWindow[j],
        this.currentWindow[i],
      ];
    }
  }

  /**
   * fill(): Fills the current window and shuffles it.
   */
  private fill(): void {
    this.fillWithoutShuffle();
    this.shuffle();
  }

  /**
   * take(): Retrieves posts from the shuffled window.
   *
   * This method retrieves a specified number of posts from the shuffled window.
   * If the window does not contain enough posts, it fills the window first.
   *
   * @param limit - The number of posts to retrieve.
   * @returns The retrieved posts, or null if no posts are available.
   */
  take(limit: number): AppBskyFeedDefs.FeedViewPost[] | null {
    if (limit * 3 > this.target) {
      this.target = limit * 3;
    }

    if (this.currentWindow.length < limit) {
      this.fill();
    }

    if (this.currentWindow.length === 0) {
      return null;
    }

    const extractedPosts = this.currentWindow.splice(0, limit);
    this._postsGiven += extractedPosts.length;
    // splice is safe even if limit is bigger than currentWindow length:
    // in that case, it just removes all the posts available.
    return extractedPosts;
  }

  /**
   * postsGiven(): Returns the number of posts given.
   *
   * @returns The number of posts given.
   */
  postsGiven(): number {
    return this._postsGiven;
  }

  /**
   * getForwardWindows(): Returns the list of forward windows.
   *
   * @returns The list of forward windows.
   */
  getForwardWindows(): ForwardSlidingWindow[] {
    return this.forwardWindows;
  }
}