import { BskyAgent } from '@atproto/api';

async function getFeed() {
  // Initialize the agent with the public API endpoint
  const agent = new BskyAgent({ service: 'https://public.api.bsky.app' });

  // Fetch the feed without authentication
  const { data } = await agent.app.bsky.feed.getFeed(
    {
      feed: 'at://did:plc:3awqkacz33aitph7ojbzv24l/app.bsky.feed.generator/aaacg5mlmmibi',
      limit: 100,
    },
    {
      headers: {
        'Accept-Language': 'en',
      },
    }
  );

  const { feed: postsArray, cursor: nextPage } = data;
  console.log(postsArray);
  const numPosts = Math.min(postsArray.length, 10);
  for (let i = 0; i < numPosts; i++) {
    console.log(`Post ${i + 1}:`, postsArray[i].post.record.text);
  }
}

getFeed();