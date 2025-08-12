import {type AppBskyActorDefs, type BskyAgent} from '@atproto/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import OpenAI from 'openai'
import {type ChatCompletionMessageParam} from 'openai/resources/chat/completions'

import {logger} from '#/logger'

// Global status tracking instance - imported from feed-curator
let globalStatusUpdate: {
  markInProgress: () => void
  markWorking: () => void
  markFailing: () => void
} | null = null

export function setPersonalityUpdaterStatusUpdater(updater: {
  markInProgress: () => void
  markWorking: () => void
  markFailing: () => void
}) {
  globalStatusUpdate = updater
}

// --- Constants ---
const ASYNC_STORAGE_KEY = 'llm_personality_preference'
const AUTOUPDATE_ENABLED_KEY = 'llm_personality_autoupdate_enabled'
const LLM_MODEL_NAME_STORAGE_KEY = 'llm_model_name'
const DEFAULT_PERSONALITY =
  'Interested in a variety of topics including technology, science, art, and culture.'
const DEFAULT_LLM_MODEL_NAME = 'mistralai/Mistral-Small-24B-Instruct-2501' // Or your preferred model

// --- Types (Adapted from PersonalityOverseer) ---
interface FollowedFeed {
  did: string
  generator: string
  displayName: string
}

interface FollowInfo {
  handle: string
  bio: string | undefined
}

// --- Prompts (Copied from _hacky_feed_gen_code/prompts.ts) ---
const PERSONALITY_UPDATE_PROMPT: ChatCompletionMessageParam[] = [
  {
    role: 'system',
    content: `You are an expert social media AI. Update the personality of the described user based on some information about them, their posts, their follows, etc.

A "personality" is an internal description of a user, not visible to others (only visible to them and the post recommender system) which efficiently and concisely summarizes a user's interests, personality, and quirks (as they change over time) so that posts more suited to the user's preferences may be put forward. The user has the ability to edit their own personality, so the information you see may have been written by an earlier AI, but it could also have been manually adapted by the person themselves.

The goal is to use the given information to describe the user's preferences, tastes, kinds of content they like to consume, types of people they like to listen to, etc.

The information you are given will vary from user to user. Make the most of what you have, and draw good inferences from the information (without reading too far into simpler things). Focus on modification rather than replacement -- you only see RECENT information, so add but try not to overwrite too much unless it's obvious from multiple datapoints that the user's tastes have changed.

A good way to represent this is to produce or update a BULLETED LIST that describes the kinds of content and people that the user might engage with.

Enclose your new personality in <Personality></Personality> XML tags; put any reasoning or comments you have outside of these tags.

If the personality has been updated by an AI at least once, it will be a bulleted list -- if that is the case (if it is a bulleted list) you should focus on adding things and rarely remove or change details.

However, if the personality is not a bulleted list, it is likely an undetailed personality left by a human writer, and you should format the information into a bulleted list yourself.`,
  },
  {
    role: 'user',
    content: `Current User ID: tanosh11_@
Recent Follows:
"""
Followed Handle: akanebestgirl_33@
Followed Bio: unhealthily obsessed neet i cant stop buying figurines i need to pay rent help meeeeeeeeee

Followed Handle: gaijinusmaximus@
Followed Bio: Man of culture.

Followed Handle: BasedMemes1337@
Followed Bio: The based-est memes they don't want you to see.

Followed Handle: Mira@
Followed Bio: 🍎 Future world ruler. I will conquer the world and make all of you my pets.

Followed Handle: PhilSpencer@
Followed Bio: Web3 and programmer, Verus is pretty cool. Also I like military history.

Followed Handle: Lost@
Followed Bio: Developer @ VerusCoin

Followed Handle: Isabell@
Followed Bio: Building manager in Houston Texas.

Followed Handle: greggg@
Followed Bio: Creator - RUBYCorp. Cybersec+Crypto. Was a NEET but now I'm a founder somehow. Send me pics of anime girls smoking.

Followed Handle: キレイ@
Followed Bio: 画家・イラストレーター。夢見る少女の世界を描きます。個展開催中！📅 お仕事依頼→yumeart☆gmail.com (☆→@) 🎨✨ #ファンタジー (AI学習不可)

Followed Handle: JoeJohnson@
Followed Bio: Proud Canadian running for PM as the leader of the Rhino Party 2027! 🇨🇦🦏 https://voterhino.ca
"""

Clickthroughs:
"""
Clicked Post Author: キレイ@
Clicked Post Content: コミッション受付中です！イラストのご依頼はKo-fiから承ります✨
Now accepting art commissions! Please check my Ko-fi page for details and pricing https://ko-fi.com/kirei/commissions

Clicked Post Author: gaijinusmaximus@
Clicked Post Content: Ruby best girl. Nuff said.

Clicked Post Author: MichaelR@
Clicked Post Content: This is like watching mathematical poetry.
#Verus is a technological marvel. 
Watching the protocol level basket and bridge currencies arbitrage against each other and the outside markets without ever touching an exchange, with more liquidity than most centralized exchanges have, is absolutely mind blowing 🤯 💥
Just know that every single low function, isolated, blockchain has been made obsolete by the Verus Internet Protocol
"""

Current User personality:
"""
I like anime and stuff
"""
----

Your goal is to write a new personality based on this information about the user, tanosh11_. Only write @the new personality.`,
  },
  {
    role: 'assistant',
    content: `This user seems to follow a number of (self-proclaimed) NEETs, general anime-related accounts, and also some Web3 people, along with some outliers. They seem to have a strong preference for anime and NEET culture (supported by their current personality), which should be reflected in their new personality, alongside their interest in Crypto. This crypto interest seems to be focused on developers and other creators in that space.
    
Some outliers include following a building manager in Houston, a Japanese illustrator, a "future world ruler", and the leader of the Rhino party in Canada. The building manager and Rhino party leader do not seem to be related to the user's primary interests, but the illustrator is related to Japanese culture and could be a creator of anime-style art, so this follow is very relevant. This is especially true given that the user has clicked on the illustrator's posts related to art commissions -- the user may be interested in art, artistic posts, and commissioning art from artists. The "future world ruler" seems to be some sort of joke account. Between this account and the based memes account, this user seems to like humorous content as well.

I will expand this user's personality with further information about their taste for anime, such as their specific engagement with NEET culture. Their interest in Web3 and humorous content should also be noted.
<Personality>
* Has a strong preference for anime and anime-related content.
* Particularly engaged with NEET culture.
* Has a Web3 interest, especially in the builders, developers, and creators in that space.
* Engages with humorous content from meme and humor-focused accounts.
* May be interested in art and artistic posts
* May be interested in commissioning art from artists
</Personality>`,
  },
  {
    role: 'user',
    content: `Current User ID: AmyBernstein@

Recent Posts:
"""
Timestamp: 2024-03-16T12:30:00Z
Content: What are you #reading this #weekend?
Language: en

Timestamp: 2024-03-16T12:45:00Z
Content: "Since it is so likely that children will meet cruel enemies, let them at least have heard of brave knights and heroic courage."
Media: cslewis.jpg
Language: en

Timestamp: 2024-03-16T13:00:00Z
Content: Love this one: "Your self-worth is determined by you. You don't have to depend on someone telling you who you are."
Language: en

Timestamp: 2024-03-16T13:15:00Z
Content: "Attitude is a little thing that makes a big difference." Good ol' winnie church
Language: en
"""


Current User personality: 
"""
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
"""`,
  },
  {
    role: 'assistant',
    content: `<Personality>
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
* Interested, specifically, in the Yemen crisis (and news about it shared by humanitarian organizations)
* Shares and enjoys inspirational quotes, specifically.
</Personality>`,
  },
  // --- Example User/Assistant messages from original prompts can be added here for few-shot learning if needed ---
]

// --- PersonalityUpdater Class ---
export class PersonalityUpdater {
  private openai: OpenAI
  private agent: BskyAgent
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string, baseURL: string, agent: BskyAgent) {
    this.apiKey = apiKey
    this.baseURL = baseURL
    this.agent = agent
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      dangerouslyAllowBrowser: true, // Necessary for client-side usage
    })
    logger.debug('PersonalityUpdater initialized')
  }

  // --- Data Fetching Methods ---

  private async queryFollowedFeeds(): Promise<FollowedFeed[] | null> {
    if (!this.agent.session) {
      logger.warn(
        'PersonalityUpdater: Not querying followed feeds - no active session',
      )
      return null
    }

    try {
      logger.debug(
        'PersonalityUpdater: Fetching user preferences for saved feeds...',
      )
      const {data} = await this.agent.app.bsky.actor.getPreferences({})

      const savedFeedsPref = data.preferences.find(
        (pref: any) => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2', // Check if this type is still correct
      )

      if (savedFeedsPref?.$type !== 'app.bsky.actor.defs#savedFeedsPrefV2') {
        logger.debug(
          'PersonalityUpdater: No valid saved feeds V2 preference found.',
        )
        return null
      }

      const validSavedFeedsPref =
        savedFeedsPref as AppBskyActorDefs.SavedFeedsPrefV2

      if (
        !validSavedFeedsPref.items ||
        validSavedFeedsPref.items.length === 0
      ) {
        logger.debug(
          'PersonalityUpdater: Saved feeds V2 preference found, but no items.',
        )
        return null
      }

      const feedItems = validSavedFeedsPref.items.filter(
        (item: {type: string; value: string}) => item.type === 'feed',
      )
      const feedUris = feedItems.map(
        (item: {type: string; value: string}) => item.value,
      )

      logger.debug(
        `PersonalityUpdater: Found ${feedUris.length} saved feed URIs.`,
      )
      const followedFeeds: FollowedFeed[] = []

      for (const uri of feedUris) {
        const matches = uri.match(
          /at:\/\/(did:[^\/]+)\/app\.bsky\.feed\.generator\/([^\/]+)/,
        )
        if (matches) {
          const [_, did, generator] = matches
          try {
            const {data: feedView} =
              await this.agent.app.bsky.feed.getFeedGenerator({feed: uri})
            followedFeeds.push({
              did,
              generator,
              displayName: feedView.view.displayName || generator, // Adjusted path based on likely API structure
            })
            logger.debug(
              `PersonalityUpdater: Successfully processed feed: ${
                feedView.view.displayName || generator
              }`,
            )
          } catch (error: any) {
            logger.warn(
              `PersonalityUpdater: Could not get feed info for ${generator}, using generator name. Error: ${error?.message}`,
            )
            followedFeeds.push({did, generator, displayName: generator})
          }
        } else {
          logger.warn(`PersonalityUpdater: Could not parse feed URI: ${uri}`)
        }
      }

      return followedFeeds
    } catch (error: any) {
      logger.error('PersonalityUpdater: Failed to fetch followed feeds', {
        message: error?.message,
        stack: error?.stack,
      })
      return null
    }
  }

  private async queryRecentFollows(limit = 10): Promise<FollowInfo[] | null> {
    if (!this.agent.session) {
      logger.warn(
        'PersonalityUpdater: Not querying recent follows - no active session',
      )
      return null
    }
    try {
      logger.debug(
        `PersonalityUpdater: Fetching recent follows (limit ${limit})...`,
      )
      const {data} = await this.agent.getFollows({
        actor: this.agent.session.did,
        limit,
      })
      if (!data || !data.follows) {
        logger.debug('PersonalityUpdater: No recent follows found.')
        return null
      }
      const follows = data.follows.map(f => ({
        handle: f.handle,
        bio: f.description,
      }))
      logger.debug(
        `PersonalityUpdater: Found ${follows.length} recent follows.`,
      )
      return follows
    } catch (error: any) {
      logger.error('PersonalityUpdater: Failed to fetch recent follows', {
        message: error?.message,
        stack: error?.stack,
      })
      return null
    }
  }

  private async getCurrentProfileInfo(): Promise<FollowInfo | null> {
    if (!this.agent.session) {
      logger.warn(
        'PersonalityUpdater: Not querying profile info - no active session',
      )
      return null
    }
    try {
      logger.debug(`PersonalityUpdater: Fetching current profile...`)
      const {data: profile} = await this.agent.getProfile({
        actor: this.agent.session.did,
      })
      if (!profile) {
        logger.warn('PersonalityUpdater: Could not fetch current profile.')
        return null
      }
      logger.debug(`PersonalityUpdater: Found profile for ${profile.handle}.`)
      return {handle: profile.handle, bio: profile.description}
    } catch (error: any) {
      logger.error('PersonalityUpdater: Failed to fetch profile', {
        message: error?.message,
        stack: error?.stack,
      })
      return null
    }
  }

  // --- Stringification Methods ---

  private stringifyFollowedFeeds(followedFeeds: FollowedFeed[] | null): string {
    if (!followedFeeds || followedFeeds.length === 0) {
      return 'Followed Feeds:\n"""\nNo followed feeds found.\n"""\n'
    }
    let stringified = 'Followed Feeds:\n"""\n'
    // Limit output length if needed
    const feedsToShow = followedFeeds.slice(0, 15)
    for (const feed of feedsToShow) {
      stringified += `Feed: ${feed.displayName}\n`
      // stringified += `Type: ${feed.generator}\n`; // Optional: generator might be too technical
      stringified += '---\n'
    }
    stringified += '"""\n'
    return stringified
  }

  private stringifyRecentFollows(follows: FollowInfo[] | null): string {
    if (!follows || follows.length === 0) {
      return 'Recent Follows:\n"""\nNo recent follows.\n"""\n'
    }
    let stringified = 'Recent Follows:\n"""\n'
    // Limit output length if needed
    const followsToShow = follows.slice(0, 10)
    for (const follow of followsToShow) {
      stringified += `Followed Handle: ${follow.handle}\n`
      stringified += `Followed Bio: ${follow.bio || 'No bio available.'}\n`
      stringified += '---\n'
    }
    stringified += '"""\n'
    return stringified
  }

  // --- Core Update Logic ---

  public async updatePersonality(): Promise<void> {
    try {
      const autoUpdateEnabled = await AsyncStorage.getItem(
        AUTOUPDATE_ENABLED_KEY,
      )
      if (autoUpdateEnabled === 'false') {
        logger.info(
          'PersonalityUpdater: Automatic updates disabled by user setting. Aborting update.',
        )
        return
      }
    } catch (e) {
      logger.error(
        'PersonalityUpdater: Failed to read auto-update setting, proceeding with update.',
        {message: e},
      )
    }

    logger.info('PersonalityUpdater: Starting personality update process...')

    if (!this.agent.session) {
      logger.warn(
        'PersonalityUpdater: Cannot update personality, user not logged in.',
      )
      return
    }

    try {
      // 1. Fetch current personality
      let currentPersonality = await AsyncStorage.getItem(ASYNC_STORAGE_KEY)
      if (!currentPersonality) {
        logger.debug(
          'PersonalityUpdater: No existing personality found, using default.',
        )
        // Optionally fetch profile description as fallback here if desired
        const profileInfo = await this.getCurrentProfileInfo()
        currentPersonality = profileInfo?.bio || DEFAULT_PERSONALITY
      } else {
        logger.debug(
          'PersonalityUpdater: Found existing personality in storage.',
        )
      }

      // 2. Fetch interaction data
      const followedFeeds = await this.queryFollowedFeeds()
      const recentFollows = await this.queryRecentFollows()
      const profileInfo = await this.getCurrentProfileInfo() // Fetch handle for the prompt

      // 3. Stringify data
      const stringifiedFollowedFeeds =
        this.stringifyFollowedFeeds(followedFeeds)
      const stringifiedRecentFollows =
        this.stringifyRecentFollows(recentFollows)
      const userHandle = profileInfo?.handle || 'unknown_user'

      // 4. Construct LLM prompt
      const promptInput = `Current User ID: ${userHandle}\n${stringifiedFollowedFeeds}\n${stringifiedRecentFollows}\nCurrent User personality:\n"""\n${currentPersonality}\n"""`

      const messages = [
        ...PERSONALITY_UPDATE_PROMPT,
        {role: 'user', content: promptInput} as ChatCompletionMessageParam,
      ]

      logger.debug('PersonalityUpdater: Sending request to LLM...')
      // // console.log("PROMPT MESSAGES:", JSON.stringify(messages, null, 2)); // DEBUG: Log full prompt

      // Mark as in progress when starting OpenAI request
      globalStatusUpdate?.markInProgress()

      // 5. Call LLM
      // Load model name from AsyncStorage
      let modelName = DEFAULT_LLM_MODEL_NAME
      try {
        const storedModelName = await AsyncStorage.getItem(
          LLM_MODEL_NAME_STORAGE_KEY,
        )
        if (storedModelName) {
          modelName = storedModelName
        }
      } catch (e) {
        logger.warn(
          'PersonalityUpdater: Could not load model name from storage, using default.',
          {message: e},
        )
      }

      const chatCompletion = await this.openai.chat.completions.create({
        model: modelName,
        messages: messages,
        // max_tokens: 500, // Adjust as needed
      })

      const content = chatCompletion.choices[0].message.content
      if (!content) {
        logger.error('PersonalityUpdater: No content returned from LLM.')
        throw new Error('No content returned from chat completion')
      }

      // Mark as working after successful OpenAI request
      globalStatusUpdate?.markWorking()

      logger.debug('PersonalityUpdater: Received response from LLM.')
      // // console.log("LLM RAW RESPONSE:", content); // DEBUG: Log raw response

      // 6. Parse response
      const match = content.match(/<Personality>([\s\S]*?)<\/Personality>/)
      if (!match || !match[1]) {
        logger.error(
          'PersonalityUpdater: Could not parse <Personality> tags from LLM response.',
          {response: content},
        )
        throw new Error('No personality tags found in chat completion response')
      }
      const newPersonality = match[1].trim()
      logger.info(
        'PersonalityUpdater: Successfully extracted new personality from LLM response.',
      )

      // 7. Save updated personality (only if changed and not empty)
      if (newPersonality && newPersonality !== currentPersonality) {
        await AsyncStorage.setItem(ASYNC_STORAGE_KEY, newPersonality)
        logger.info(
          'PersonalityUpdater: Updated personality saved to AsyncStorage.',
        )
        // // console.log("NEW PERSONALITY:", newPersonality); // DEBUG: Log new personality
      } else if (!newPersonality) {
        logger.warn(
          'PersonalityUpdater: Extracted personality was empty, not saving.',
        )
      } else {
        logger.info(
          'PersonalityUpdater: Personality unchanged, no update needed.',
        )
      }
    } catch (error: any) {
      // Mark as failing when OpenAI request errors
      globalStatusUpdate?.markFailing()

      logger.error('PersonalityUpdater: Failed during personality update', {
        message: error?.message,
        stack: error?.stack,
      })
    }
  }
}
