/**
 * @fileoverview Provides a service for creating FeedAPIs using a provided FeedAPIRuntimeCreator.
 *
 * This module simplifies the process of creating FeedAPIs by taking the runtime creator
 * as an argument, allowing for flexible usage within React components.
 */
import  { type FeedAPI } from '#/lib/api/feed/types';
import  { type FeedAPICreationArgs,type FeedAPIRuntimeCreator } from './FeedAPIRuntimeCreator';

/**
 * Service class for creating FeedAPIs using a provided runtime creator.
 */
export class FeedAPIRuntimeCreatorService {
  /**
   * Attempts to create a FeedAPI using the provided runtime creator.
   *
   * @param runtimeCreator - The FeedAPIRuntimeCreator instance to use for API creation.
   * @param args - The arguments for creating the FeedAPI.
   * @returns A FeedAPI instance if creation is successful, or null if no creator is available.
   */
  static maybeCreateAPI(
    runtimeCreator: FeedAPIRuntimeCreator | undefined,
    args: FeedAPICreationArgs,
  ): FeedAPI | null {
    // If we don't have a creator, we can't make an API!
    if (!runtimeCreator) {
      return null; // No creator provided, skip.
    }

    // Alright, we've got a creator! Let's try to make that API magic happen!
    return runtimeCreator.maybeCreateAPI(args);
  }
}