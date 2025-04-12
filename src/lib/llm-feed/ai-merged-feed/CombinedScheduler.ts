import { PostWaiter } from './PostWaiter';
import { ShouldFetchScheduler } from './ShouldFetchScheduler';
import { WindowMergedAdvisor } from './WindowMergedAdvisor';

/**
 * CombinedScheduler: Interface that merges the functionalities of PostWaiter,
 * ShouldFetchScheduler, and WindowMergedAdvisor.
 *
 * This interface combines the ability to wait for new posts, decide when to
 * fetch more posts based on current content, and advise an external component
 * about the pace of post consumption.
 */
export interface CombinedScheduler
  extends PostWaiter,
    ShouldFetchScheduler,
    WindowMergedAdvisor {}