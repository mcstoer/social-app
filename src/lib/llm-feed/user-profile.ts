import {BskyAgent} from '@atproto/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {UserProfile} from './types'

// Default personality description if none is provided
const DEFAULT_PERSONALITY = 'Interested in a variety of topics including technology, science, art, and culture.'
const ASYNC_STORAGE_KEY = 'llm_personality_preference'

/**
 * Extract user information from Bluesky to create a UserProfile for LLM feed generation
 */
export async function getCurrentUserProfile(agent: BskyAgent): Promise<UserProfile | null> {
  if (!agent.session) {
    return null
  }
  
  try {
    // Get current user profile
    const {data: profile} = await agent.getProfile({
      actor: agent.session.did,
    })
    
    // Get user's subscriptions (follows) for better feed curation
    const {data: follows} = await agent.getFollows({
      actor: agent.session.did,
      limit: 50,
    })
    
    // Format the subscriptions in the format expected by the feed curator
    const subscriptions = follows.follows.map(follow => ({
      user_handle: follow.handle,
      user_bio: follow.description || '',
    }))
    
    // Get user's preferred languages from their profile display settings
    let languages = 'en'
    try {
      const {data: preferences} = await agent.app.bsky.actor.getPreferences({})
      
      // Look for language preferences - use a type assertion since the property 
      // may not be directly accessible in the TypeScript type
      const feedViewPref = preferences.preferences.find(
        pref => pref.$type === 'app.bsky.actor.defs#feedViewPref'
      )
      
      // Access userLocale safely with a type assertion
      const feedViewPrefAny = feedViewPref as any
      if (feedViewPrefAny && typeof feedViewPrefAny.userLocale === 'string') {
        languages = feedViewPrefAny.userLocale
      }
    } catch (error) {
      console.warn('Could not get user language preferences:', error)
    }
    
    // Get custom personality from AsyncStorage, fallback to profile description, then default
    let personality = DEFAULT_PERSONALITY
    try {
      const storedPersonality = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)
      if (storedPersonality) {
        personality = storedPersonality
      } else if (profile.description) {
        personality = profile.description
      }
    } catch (e) {
      console.warn('Could not read personality preference from storage:', e)
      // If storage fails, fallback to profile description if available
      if (profile.description) {
        personality = profile.description
      }
    }

    // console.log("USER PERSONALITY:")
    // console.log(personality)

    return {
      name: profile.handle,
      subscriptions,
      personality,
      languages,
    }
  } catch (error) {
    console.error('Failed to get user profile for LLM feed curation:', error)
    return null
  }
}