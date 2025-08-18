/**
 * PostWaiter: Interface for waiting for new posts to become available.
 *
 * This interface allows the feed merger to wait for new posts to be fetched from
 * the API. It returns a Promise that resolves when new posts are available.
 */
export interface PostWaiter {
  /**
   * wait(): Waits for new posts to become available.
   *
   * @returns A Promise that resolves when new posts are available.
   */
  wait(): Promise<void>;
}