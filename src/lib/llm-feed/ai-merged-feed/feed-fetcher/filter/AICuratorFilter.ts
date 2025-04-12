import { AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api';

import { FeedCurator } from 'lib/llm-feed/feed-curator.ts';
import { PostFilter } from './PostFilter';

/**
 * AICuratorFilter: Filters posts using AI so it matches interest guessed by personality, preferred languages and followings.
 *
 * Once AICuratorFilter instance is built, the personality arguments changes won't be picked up.
 */
export class AICuratorFilter implements PostFilter {
  private curator: FeedCurator;
  private subscriptions: {user_handle: string, user_bio: string}[];
  private personality: string;
  private languages: string | undefined;

  /**
   * Constructor: Sets the curator and "personality" related arguments to refine the AI filter.
   */
  constructor(
    curator: FeedCurator,
    subscriptions: {user_handle: string, user_bio: string}[],
    personality: string,
    languages?: string
  ) {
    this.curator = curator;
    this.subscriptions = subscriptions;
    this.personality = personality;
    this.languages = languages;
  }

  /**
   * filter(): call AI service to filter posts and return that list
   *
   * @param {AppBskyFeedDefs.FeedViewPost[]} postList - the list of posts that should be filtered.
   */
  async filter(postList: AppBskyFeedDefs.FeedViewPost[]): Promise<AppBskyFeedDefs.FeedViewPost[]> {
    const postTextList: string[] = new Array(postList.length);
    const filteredPostList: AppBskyFeedDefs.FeedViewPost[] = [];

    for (let i: number = 0; i < postList.length; i++) {
      const post = postList[i];
      const record = post.post.record as AppBskyFeedPost.Record | undefined; // Explicitly cast

      let text: string | null = null;

      // LLMs we use are too basic to parse media. To not exclude all media only posts, we add a fake text "Post from author" and AI will judge, likely based on followings.
      if (record != null) {
        const recordText = record.text;

        // Posts with media has generally an empty string.
        // But as it's typecast, better double check for null/undefined.
        if (recordText != null && recordText != "") {
          text = recordText;
        }
      }

      if (text == null) {
        text = `Post from ${post.post.author.handle}`;
      }

      // Ensure indices in postList matches postTextList
      postTextList[i] = text as string; // We are sure it's not null.
    }

    // We need to give to the curator a list of post contents as strings and it gives back a list of indices
    const filteredIndicesList: number[] = await this.curator.curateFeed(
      this.subscriptions,
      postTextList,
      this.personality,
      this.languages
    );

    for (const i of filteredIndicesList) {
      filteredPostList.push(postList[i]);
    }

    return filteredPostList;
  }
}