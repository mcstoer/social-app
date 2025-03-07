import { BskyAgent } from '@atproto/api'

async function getDiscoverableFeeds() {
  const agent = new BskyAgent({ service: 'https://bsky.social' })
  
  try {
    // Login first (replace with your credentials)
    await agent.login({
      identifier: 'e-p-armstrong.bsky.social',
      password: 'pHnvqcBQitYPS98'
    })
    
    const response = await agent.app.bsky.feed.getSuggestedFeeds()
    console.log(response.data.feeds)
  } catch (error) {
    console.error('Error fetching feed list:', error)
  }
}

getDiscoverableFeeds()