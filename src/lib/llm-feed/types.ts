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
 * aiModeFeedDescriptor: A constant string literal used to identify the AI mode feed.
 * This simple string serves as a unique key for a specific type of feed.
 */
export const aiModeFeedDescriptor = 'ai-mode-feed';

/**
 * llmCuratedFeedPrefix: A constant string used as a prefix for LLM-curated feed descriptors.
 * This prefix helps to categorize and identify feeds generated or influenced by Language Model Models.
 */
export const llmCuratedFeedPrefix = 'llm-curated|';

/**
 * AIFeedDescriptor: A TypeScript type defining the possible descriptors for AI-related feeds.
 * It can be the exact string 'ai-mode-feed' or a template literal indicating an LLM-curated feed.
 */
export type AIFeedDescriptor =
  | 'ai-mode-feed'
  | `llm-curated|${string}`;
