import {FeedCurator} from './feed-curator'
import {UserProfile} from './types'
import {AppBskyFeedDefs} from '@atproto/api'

// Define message types for worker communication
export type WorkerRequest = {
  type: 'CURATE_FEED'
  rawPosts: string[]
  profile: UserProfile
  apiKey: string
  baseURL: string
}

export type WorkerResponse = {
  type: 'FEED_CURATED'
  curatedFeed: string[]
  feedId: string
} | {
  type: 'ERROR'
  error: string
}

// Create a web worker context
const ctx: Worker = self as any

// Helper function to log from worker (will show up in main thread console)
function workerLog(...args: any[]) {
  // Use console.log but prefix with WORKER for clarity
  console.log('WORKER:', ...args);
}

// Process messages from the main thread
ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  workerLog('===== FEED WORKER: MESSAGE RECEIVED =====');
  const {type, rawPosts, profile, apiKey, baseURL} = event.data
  
  workerLog('Received message type:', type);
  workerLog('Post count:', rawPosts?.length || 0);
  workerLog('Profile:', JSON.stringify(profile, null, 2));
  workerLog('Has API key:', !!apiKey);
  
  if (type === 'CURATE_FEED') {
    workerLog('Starting feed curation process in worker...');
    
    try {
      // Create feed curator instance
      workerLog('Creating FeedCurator instance');
      const feedCurator = new FeedCurator(apiKey, baseURL)
      
      // Log sample of posts to be curated
      workerLog('Raw posts sample (first 3):');
      rawPosts.slice(0, 3).forEach((post, idx) => {
        workerLog(`Post ${idx+1}:\n${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
      });
      
      // Process the raw posts to create a curated feed
      workerLog('Calling feedCurator.curateFeed with', rawPosts.length, 'posts');
      const startTime = Date.now();
      
      const result = await feedCurator.curateFeed(
        profile.subscriptions,
        rawPosts,
        profile.personality,
        profile.languages
      )
      
      const duration = Date.now() - startTime;
      workerLog('Feed curation complete in', duration, 'ms');
      workerLog('Curated feed has', result.length, 'posts');
      
      // Log sample of curated posts
      if (result.length > 0) {
        workerLog('Curated posts sample (first 3):');
        result.slice(0, 3).forEach((post, idx) => {
          workerLog(`Curated post ${idx+1}:\n${post.substring(0, 100)}${post.length > 100 ? '...' : ''}`);
        });
      } else {
        workerLog('WARNING: Curated feed has 0 posts!');
      }
      
      // Generate a unique feed ID
      const feedId = `llm-worker-${Date.now()}`
      workerLog('Generated feed ID:', feedId);
      
      // Send the curated feed back to the main thread
      workerLog('Sending curated feed back to main thread');
      ctx.postMessage({
        type: 'FEED_CURATED',
        curatedFeed: result,
        feedId
      })
      
      workerLog('===== FEED WORKER: CURATION COMPLETED SUCCESSFULLY =====');
    } catch (error) {
      // Handle any errors
      workerLog('===== FEED WORKER: ERROR =====');
      workerLog('Error during feed curation:', error);
      workerLog('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      ctx.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : String(error)
      })
      
      workerLog('Error message sent back to main thread');
    }
  } else {
    workerLog('Unknown message type:', type);
  }
})

export default {} as typeof Worker & { new(): Worker }