import { type AppBskyFeedDefs } from '@atproto/api';

/**
 * ForwardSlidingWindow: Manages a forward-moving sliding window for a specific feed source.
 *
 * This class is designed to maintain a list of posts from a single feed source and
 * track the offset of the next post to be retrieved. It provides a "next()" method
 * to retrieve posts sequentially, simulating a sliding window that moves forward
 * through the feed.
 *
 * This is meant to be used by the Cursor class, which manages the shuffling of multiple
 * of these forward windows.
 */
export class ForwardSlidingWindow {
  /**
   * postList: The list of posts from the feed source.
   */
  postList: AppBskyFeedDefs.FeedViewPost[] = [];

  /**
   * offset: The index of the next post to be retrieved.
   */
  offset: number = 0;

  /**
   * Constructor: Initializes the ForwardSlidingWindow with a list of posts.
   *
   * @param postList - The list of posts from the feed source.
   */
  constructor(postList: AppBskyFeedDefs.FeedViewPost[]) {
    this.postList = postList;
  }

  /**
   * next(): Retrieves the next post from the list.
   *
   * This method returns the post at the current offset and increments the offset.
   * If the offset exceeds the length of the list, it returns null, indicating
   * that all posts have been retrieved.
   *
   * @returns The next post, or null if no more posts are available.
   */
  next(): AppBskyFeedDefs.FeedViewPost | null {
    if (this.offset < this.postList.length) {
      return this.postList[this.offset++];
    }
    return null;
  }
}
