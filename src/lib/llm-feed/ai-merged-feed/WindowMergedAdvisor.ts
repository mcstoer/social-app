import { type ForwardSlidingWindow } from './ForwardSlidingWindow';

/**
 * WindowMergedAdvisor: Interface for notifying an external component about the pace of post consumption.
 *
 * This interface allows the feed merger to notify an external component (e.g., a scheduler)
 * about the progress of post fetching and consumption. The component might use the offset
 * of each ForwardSlidingWindow as a clue to restart fetching in the background.
 */
export interface WindowMergedAdvisor {
  /**
   * adviseMerger(): Notifies the advisor about the current state of the forward sliding windows.
   *
   * @param forwardWindows - The list of ForwardSlidingWindow instances representing the feed sources.
   */
  adviseMerger(forwardWindows: ForwardSlidingWindow[]): void;
}