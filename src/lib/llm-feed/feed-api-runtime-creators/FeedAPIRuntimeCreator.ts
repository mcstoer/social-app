/**
 * @fileoverview Defines the interface and types for runtime FeedAPI creators.
 *
 * This module provides the foundation for extending and customizing the FeedAPI.
 * FeedAPIRuntimeCreators allow developers to define custom logic for creating FeedAPIs,
 * enabling the creation of new feed types without modifying core Bluesky code.
 */

import { BskyAgent } from '@atproto/api';

import { FeedAPI } from '#/lib/api/feed/types';
import type { FeedTunerFn } from '#/lib/api/feed-manip';
import type { FeedDescriptor, FeedParams } from '#/state/queries/post-feed';

/**
 * Defines the contract for a runtime FeedAPI creator.
 *
 * FeedAPIRuntimeCreators are responsible for creating FeedAPIs based on provided arguments.
 * They have the flexibility to handle specific feed types and customization logic.
 */
export interface FeedAPIRuntimeCreator {
  /**
   * Attempts to create a FeedAPI based on the provided arguments.
   *
   * @param args - The arguments for creating the FeedAPI.
   * @returns A FeedAPI instance if creation is successful, or null if the creator does not handle the request.
   */
  maybeCreateAPI(args: FeedAPICreationArgs): FeedAPI | null;
}

/**
 * Defines the arguments required to create a FeedAPI.
 */
export interface FeedAPICreationArgs {
  /**
   * Describes the feed to be created.
   */
  feedDesc: FeedDescriptor;

  /**
   * Parameters for the feed.
   */
  feedParams: FeedParams;

  /**
   * Array of feed tuner functions to customize the feed.
   */
  feedTuners: FeedTunerFn[];

  /**
   * Optional user interests for personalized feeds.
   */
  userInterests?: string;

  /**
   * The Bluesky agent for API interaction.
   */
  agent: BskyAgent;
}