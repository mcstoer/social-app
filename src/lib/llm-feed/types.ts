/**
 * User profile information for feed curation
 */
export interface UserProfile {
  name: string;
  subscriptions: Array<{user_handle: string, user_bio: string}>;
  personality: string;
  languages?: string;
}

/**
 * Feed options for customization
 */
export interface FeedOptions {
  maxPosts?: number;
  temperature?: number;
}

/**
 * Type for feed curation request
 */
export interface CurationRequest {
  posts: string[];
  profile: UserProfile;
  options?: FeedOptions;
}

/**
 * Type for feed curation response
 */
export interface CurationResponse {
  curatedPosts: string[];
  feedId: string;
}