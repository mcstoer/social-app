export interface HistoricalPost {
    text: string;
    created_id: string;
    author: string;
    uri: string;
    has_entity: boolean;
    reply?: string | null;
}

export interface UserProfile {
    name: string;
    subscriptions: Array<{user_handle: string, user_bio: string}>;
    personality: string;
    languages?: string;
}

export interface FeedOptions {
  maxPosts?: number;
  temperature?: number;
}

export interface PostRecord {
  text: string;
  createdAt: string;
}

export interface PostEmbed {
  $type: string;
  images?: {
    alt: string;
    image: {
      ref: { $link: string };
    };
  }[];
  // Add other embed types as needed
}

export interface Post {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
  };
  record: PostRecord;
  embed?: {
    $type: string;
    images?: any;
  };
}

export interface Feed {
  posts: Post[];
} 