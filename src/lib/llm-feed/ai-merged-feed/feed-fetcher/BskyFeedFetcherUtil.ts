import { AppBskyFeedDefs } from '@atproto/api';
import { Response } from '@atproto/api/src/client/types/app/bsky/feed/getTimeline';

import { FeedAPIResponse } from '#/lib/api/feed/types';

/**
 * BskyFeedFetcherUtil: Provides utility functions for handling Bluesky feed responses.
 *
 * This class offers static methods to process and normalize responses from
 * Bluesky feed API calls, ensuring consistency and handling edge cases like
 * pagination limit enforcement.
 */
export class BskyFeedFetcherUtil {
  /**
   * processApiResponse(): Processes and normalizes the API response from a Bluesky feed request.
   *
   * @param {Response} apiResponse - The API response object.
   * @param {number} limit - The requested limit for the number of posts.
   * @param {string | undefined} cursor - The cursor used in the API request.
   * @returns {FeedAPIResponse} The processed and normalized feed response.
   */
  static processApiResponse(
    apiResponse: Response,
    limit: number,
    cursor: string | undefined = undefined,
  ): FeedAPIResponse {
    if (apiResponse.success) {
      const data = apiResponse.data;
      const feed: AppBskyFeedDefs.FeedViewPost[] = data.feed;

      // NOTE: Some custom feeds fail to enforce the pagination limit,
      // so we manually truncate here.
      if (feed.length > limit) {
        feed.length = limit;
      }

      let newCursor: string | undefined;
      if (feed.length > 0) {
        newCursor = data.cursor;
      } else {
        newCursor = undefined;
      }

      return {
        cursor: newCursor,
        feed: feed,
      };
    } else {
      // Return empty feed + cursor argument so it can retry.
      return {
        cursor: cursor,
        feed: [],
      };
    }
  }
}