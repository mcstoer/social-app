import { BskyAgent } from '@atproto/api';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import OpenAI from 'openai';
import { FEED_PROMPTS } from './prompts';
import { AppBskyFeedPost } from '@atproto/api'
import { FEED_LIST } from './feed_list';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { Table } from 'apache-arrow';
import { HistoricalPost } from './types';
import fs from 'fs';
// At the top of the file, add an interface for auth credentials
interface BskyAuthCredentials {
    identifier: string;    // email or handle
    password: string;
}

interface TimelineFeed {
    uri: string;
}

interface BskyFeedPreference {
    feeds: { uri: string }[];  // Add this property as an array
}

export class FeedCurator {
    private agent: BskyAgent;
    private readonly openai: OpenAI;
    private readonly defaultMaxPosts = 50;
    private readonly feedSourcesDivisor = 2;
    private readonly feedURLs: string[] = [
        'whats-hot', 
        // Additional feed URLs will be added here to provide more diverse content sources
    ];
    private readonly numDistillations = 3;
    private readonly feedSourceSelectionRuns = 3;
    private readonly MAX_CONCURRENT_DISTILLATIONS = 30;  // Add this class property

    constructor(
        apiKey: string, 
        baseURL: string,
        bskyAuth?: BskyAuthCredentials
    ) {
        // Initialize the agent with the appropriate service URL
        this.agent = new BskyAgent({
            service: bskyAuth ? 'https://bsky.social' : 'https://public.api.bsky.app'
        });

        // If auth credentials are provided, attempt login
        if (bskyAuth) {
            // Login needs to be handled asynchronously
            this.agent.login({
                identifier: bskyAuth.identifier,
                password: bskyAuth.password
            }).catch(error => {
                console.error('Failed to login to Bluesky:', error);
                // We'll need to create a new agent instance for public API
                this.agent = new BskyAgent({
                    service: 'https://public.api.bsky.app'
                });
            });
        }

        this.openai = new OpenAI({
            apiKey,
            baseURL
        });
    }

    public shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    private constructFeedUrl(feedSource: [string, string, string]): string {
        const [did, generator] = feedSource;
        return `at://${did}/app.bsky.feed.generator/${generator}`;
    }
    
    // next thing is doing this for personalities, and querying some of that information.

    private async ensureAgentReady(): Promise<void> {
        // If we have a session but it's expired, try to resume it
        if (this.agent.session) {
            try {
                await this.agent.resumeSession({
                    did: this.agent.session.did,
                    handle: this.agent.session.handle,
                    email: this.agent.session.email,
                    accessJwt: this.agent.session.accessJwt,
                    refreshJwt: this.agent.session.refreshJwt,
                    active: true
                });
            } catch (error) {
                console.warn('Failed to resume Bluesky session:', error);
                // Create new agent instance for public API if session resume fails
                this.agent = new BskyAgent({
                    service: 'https://public.api.bsky.app'
                });
            }
        }
    }

    // NOTE Bsky probably shuffles the urls, whats-hot seems to have stopped working, need to have the code query it and establish my process for finding out waht the did is for it.
    // NOTE next steps are to test, on cloud and locally, the 1b and 3b. And if they suck, to train a 1b or 3b model on data made from a really good model's distillations (8b?).
    // For that it will take data saving. This should be fine. I'll get AI to write the saving of the outputs themselves, and generate random numbers of profiles to make feeds for.


    public async getRawMaterials(
        subscriptions: { user_handle: string; user_bio: string }[], 
        personality: string
    ): Promise<FeedViewPost[]> {
        await this.ensureAgentReady();
        const selectedFeeds = await this.curateFeedSources(subscriptions, personality);
        const allPosts: FeedViewPost[] = [];
        
        for (const feedSource of selectedFeeds) {
            const postsPerFeed = Math.ceil(this.defaultMaxPosts / selectedFeeds.length);
            const posts = await this.fetchFeedWithRetry(feedSource, postsPerFeed);
            
            if (posts) {
                allPosts.push(...posts);
                if (allPosts.length >= this.defaultMaxPosts) {
                    break;
                }
            }
        }
        
        const finalPosts = this.shuffleArray(allPosts)
            .slice(0, this.defaultMaxPosts);
        
        if (finalPosts.length === 0) {
            throw new Error('Failed to fetch posts from any feed source');
        }

        console.log(`Successfully fetched ${finalPosts.length} posts from ${selectedFeeds.length} feeds`);

        
        // console.log('Selected feeds:', selectedFeeds);
        
        return finalPosts;
    }


    private async fetchFeedWithRetry(
        feedSource: [string, string, string], 
        limit: number
    ): Promise<FeedViewPost[] | null> {
        await this.ensureAgentReady();
        const maxRetries = 2;
        const batchSize = 99; // BSKY API limit
        let allPosts: FeedViewPost[] = [];
        let cursor: string | undefined;
        
        // Calculate number of batches needed
        const numBatches = Math.ceil(limit / batchSize);
        console.log(`Number of batches: ${numBatches}`);
        
        for (let batch = 0; batch < numBatches; batch++) {
            // Calculate remaining posts needed
            const remainingLimit = Math.min(batchSize, limit - allPosts.length);
            if (remainingLimit <= 0) break;
            console.log(`Remaining limit: ${remainingLimit}`);
            // Try to fetch this batch
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                console.log(`Attempt: ${attempt}`);
                try {
                    const { data } = await this.agent.app.bsky.feed.getFeed(
                        {
                            feed: this.constructFeedUrl(feedSource),
                            limit: remainingLimit,
                            cursor
                        },
                        {
                            headers: {
                                'Accept-Language': 'en'
                            }
                        }
                    );
                    console.log(`Fetched ${data.feed.length} posts`);
                    
                    // Add schema inspection for first post of first batch
                    // if (batch === 0 && data.feed.length > 0) {
                    //     console.log('Sample post schema:');
                    //     console.log(JSON.stringify(data.feed[0], null, 2));
                    // }
                    
                    // Update cursor for next batch
                    cursor = data.cursor;
                    
                    // Add new posts and deduplicate
                    const newPosts = data.feed;
                    allPosts = this.deduplicatePosts([...allPosts, ...newPosts]);
                    
                    // Break retry loop on success
                    break;
                } catch (error) {
                    if (attempt < maxRetries) {
                        console.error(
                            `Error fetching feed ${feedSource[2]}, batch ${batch + 1}/${numBatches}, attempt ${attempt + 1}/${maxRetries + 1}:`, 
                            error
                        );
                        console.log(`This was the searched-for feed: ${this.constructFeedUrl(feedSource)}`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else {
                        console.error(
                            `Failed to fetch feed ${feedSource[2]}, batch ${batch + 1}/${numBatches} after ${maxRetries + 1} attempts:`,
                            error
                        );
                        // Return what we have so far rather than null
                        if (allPosts.length > 0) {
                            return allPosts;
                        }
                        return null;
                    }
                }
            }
            
            // If no cursor and not first batch, we've reached the end
            if (!cursor && batch > 0) break;
            
            // Add small delay between batches to be nice to the API
            if (batch < numBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        return allPosts.length > 0 ? allPosts : null;
    }

    private deduplicatePosts(posts: FeedViewPost[]): FeedViewPost[] {
        const seen = new Set<string>();
        return posts.filter(post => {
            // Create a unique key from author and content
            const record = post.post.record as AppBskyFeedPost.Record;
            const key = `${post.post.author.did}:${record.text}`;
            
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private stringifySubscriptions(subscriptions: {user_handle: string, user_bio: string}[]) {
        let stringified_subscriptions = ""
        for (const sub of subscriptions) {
            stringified_subscriptions += `Subscribed personality handle: ${sub.user_handle}\nSubscribed personality bio: ${sub.user_bio}\n\n`
        }
        return stringified_subscriptions;
    }

    private stringifyPosts(posts: string[]) {
        let stringified_posts = ""
        for (let idx = 0; idx < posts.length; idx++) {
            stringified_posts += `POST INDEX: ${idx + 1}\nPost content:\n${posts[idx]}\n--end content--\n\n`
        }
        return stringified_posts;
    }

    private stringifyFeedSources(feed_sources: [string, string, string][]) {
        let stringified_feed_sources = ""
        for (let i = 0; i < feed_sources.length; i++) {
            stringified_feed_sources += `Feed source index: ${i + 1}\nFeed source name: ${feed_sources[i][2]}\n\n`
        }
        return stringified_feed_sources;
    }

    public async curateFeed(subscriptions: {user_handle: string, user_bio: string}[], posts: string[], personality: string, languages?: string) {
        // first, stringify subscriptions
        let output = null;
        try {
            let stringified_subscriptions = this.stringifySubscriptions(subscriptions)

            let stringified_posts = this.stringifyPosts(posts)

            const promptMessages = [...FEED_PROMPTS.POST_CURATION,
                {
                    role: 'user',
                    content: `User personality: 
"""
${personality}
"""

User subscriptions list:
"""
${stringified_subscriptions}
"""

----

Some raw materials (recent posts from the subscribers) to make a feed from:
"""
${stringified_posts}
"""

Preferred languages:
"""
${languages}
"""

Note that user subscriptions are shown to give you additional hints about their interests. The user's subscriptions may not show up in the raw materials you see, and in fact you do not know who has written each individual post.

Only select posts that are in the preferred languages.

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`
                }
            ]

            // console.log(promptMessages);

            const chatCompletion = await this.openai.chat.completions.create({
                messages: promptMessages as any,
                model: 'meta-llama/Meta-Llama-3-70B-Instruct',
                max_completion_tokens: 500
            })

            // Process the completion output
            output = chatCompletion.choices[0].message.content;
        } catch (error) {
            console.error('Error processing feed:', error);
            // throw new Error('Failed to fetch feed');
            return []
        }
        
        // console.log("!!!CURATED FEED LLM OUTPUT");
        // console.log(output);
        
        // Extract numbers from the output
        if (!output) {
            // throw new Error('No output from the LLM');
            return []
        }
        
        // Extract and deduplicate indices while preserving order
        const selectedIndices = [...new Set(
            output
                .split('\n')
                .map(line => parseInt(line.trim()))
                .filter(num => !isNaN(num))  // Only keep valid numbers
                .map(num => num - 1)  // Convert to 0-based indices
                .filter(idx => idx >= 0 && idx < posts.length)  // Ensure index is valid
        )];
        
        // Limit the number of selected posts
        const maxPosts = Math.floor(this.defaultMaxPosts / this.feedSourcesDivisor);
        const limitedIndices = selectedIndices.slice(0, maxPosts);
        
        // Return selected posts in the order specified by the deduplicated indices
        return limitedIndices.map(idx => posts[idx]);
    }

    private async getAuthenticatedUserFeeds(): Promise<[string, string, string][] | null> {
        if (!this.agent.session) {
            console.log('Not using authenticated feeds - no active session');
            return null; // Not authenticated
        }

        try {
            // Ensure we're properly authenticated before proceeding
            await this.ensureAgentReady();

            // Get the user's preferences
            console.log('Fetching user preferences...');
            const { data } = await this.agent.api.app.bsky.actor.getPreferences();
            
            console.log('Raw preferences data:', JSON.stringify(data, null, 2));
            
            // Look for saved feeds preferences specifically
            const savedFeedsPref = data.preferences.find(
                (pref: any) => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2'
            );
            
            if (!savedFeedsPref?.items) {
                console.log('No saved feeds found in user data');
                return null;
            }

            console.log('Found saved feeds preferences:', JSON.stringify(savedFeedsPref, null, 2));

            // Extract feed URIs from preferences, filtering for type "feed"
            const feedItems = (savedFeedsPref.items as any[]).filter((item) => item.type === 'feed');
            const feedUris = feedItems.map((item) => item.value);
            
            console.log(`Found ${feedUris.length} feed URIs in user preferences:`, feedUris);
            
            // Convert URIs to our tuple format
            const feedTuples: [string, string, string][] = [];
            
            for (const uri of feedUris) {
                console.log(`Processing feed URI: ${uri}`);
                // URI format: at://did:plc:xxx/app.bsky.feed.generator/yyy
                const matches = uri.match(/at:\/\/(did:[^\/]+)\/app\.bsky\.feed\.generator\/([^\/]+)/);
                if (matches) {
                    const [_, did, generator] = matches;
                    // For now, use generator as name - we could fetch actual feed info if needed
                    feedTuples.push([did, generator, generator]);
                    console.log(`Successfully parsed feed: ${generator} from ${did}`);
                } else {
                    console.log(`Failed to parse feed URI: ${uri}`);
                }
            }

            if (feedTuples.length === 0) {
                console.log('No valid feeds found in user preferences, falling back to default behavior');
                return null;
            }

            console.log('Final feed tuples:', feedTuples);
            return feedTuples;
        } catch (error) {
            console.error('Failed to fetch authenticated user feeds:', error);
            if (error instanceof Error) {
                console.error('Error details:', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
            }
            return null;
        }
    }

    public async curateFeedSources(
        subscriptions: {user_handle: string, user_bio: string}[], 
        personality: string
    ): Promise<[string, string, string][]> {
        // First try to get authenticated feeds
        const authenticatedFeeds = await this.getAuthenticatedUserFeeds();
        
        if (authenticatedFeeds) {
            console.log(`Using ${authenticatedFeeds.length} authenticated user feeds`);
            return authenticatedFeeds;
        }

        console.log('Falling back to LLM-based feed source selection');
        // If not authenticated or failed to get feeds, fall back to existing behavior
        const stringified_subscriptions = this.stringifySubscriptions(subscriptions);
        const stringified_feed_sources = this.stringifyFeedSources(FEED_LIST as [string, string, string][]);

        // Store results from each run
        const allRuns: number[][] = [];
        
        // Run the selection multiple times
        for (let run = 0; run < this.feedSourceSelectionRuns; run++) {
            const promptMessages = [...FEED_PROMPTS.FEED_SELECTION,
                {
                    role: 'user',
                    content: `User personality: 
"""
${personality}
"""

User subscriptions list:
"""
${stringified_subscriptions}
"""

List of feed sources:
"""
${stringified_feed_sources}
"""

Note that user subscriptions are shown to give you additional hints about their interests.`
                }
            ];

            const chatCompletion = await this.openai.chat.completions.create({
                messages: promptMessages as any,
                model: 'meta-llama/Meta-Llama-3-70B-Instruct',
                max_completion_tokens: 500,
                temperature: 0.3,
                top_p: 0.8
            });
            // console.log("!!!CURATED FEED SOURCES LLM OUTPUT");
            // console.log(chatCompletion);

            // Process the completion output
            const output = chatCompletion.choices[0].message.content;
            if (!output) {
                throw new Error('No output from the LLM');
            }
            // console.log("!!!CURATED FEED SOURCES LLM OUTPUT CONTENT");
            // console.log(output);

            // Extract indices for this run
            const selectedIndices = [...new Set(
                output
                    .split('\n')
                    .map(line => parseInt(line.trim()))
                    .filter(num => !isNaN(num))
                    .map(num => num - 1)
                    .filter(idx => idx >= 0 && idx < FEED_LIST.length)
            )];

            allRuns.push(selectedIndices);
        }

        // Find indices that appear in all runs
        const consistentIndices = allRuns[0].filter(index => 
            allRuns.every(run => run.includes(index))
        );

        // If no consistent indices, fall back to first run's results
        const finalIndices = consistentIndices.length > 0 ? consistentIndices : allRuns[0];

        console.log(`Selected ${finalIndices.length} consistent feed sources across ${this.feedSourceSelectionRuns} runs`);
        
        // Return selected feed sources
        return finalIndices.map(idx => FEED_LIST[idx]);
    }

    public async getDistilledFeed(subscriptions: {user_handle: string, user_bio: string}[], personality: string, languages?: string) {
        // Get initial raw materials
        let currentPosts = await this.getRawMaterials(subscriptions, personality);
        
        // Convert posts to strings for processing
        let currentPostTexts = currentPosts.map(post => (post.post.record as AppBskyFeedPost.Record).text);
        
        // Track all iterations
        const allDistillations = [currentPostTexts];
        
        // Perform distillations
        for (let i = 0; i < this.numDistillations - 1; i++) {
            // Break if we don't have enough posts to meaningfully continue
            if (currentPostTexts.length < 3) {
                console.log(`Stopping at distillation ${i + 1} due to insufficient posts (${currentPostTexts.length} remaining)`);
                break;
            }
            
            // Get next distillation using current posts as raw material
            const nextDistillation = await this.curateFeed(subscriptions, currentPostTexts, personality, languages);
            
            // Break if we got no results
            if (!nextDistillation.length) {
                console.log(`Stopping at distillation ${i + 1} due to empty results`);
                break;
            }
            
            // Update current posts for next iteration
            currentPostTexts = nextDistillation;
            allDistillations.push(currentPostTexts);
        }
        
        // Return all distillations and the final result
        return {
            allDistillations,
            finalFeed: currentPostTexts
        };
    }

    // Add this method to get raw materials with custom max posts
    private async getRawMaterialsWithLimit(
        subscriptions: {user_handle: string, user_bio: string}[], 
        personality: string,
        maxPosts: number
    ): Promise<FeedViewPost[]> {
        const selectedFeeds = await this.curateFeedSources(subscriptions, personality);
        let allPosts: FeedViewPost[] = [];
        console.log("!!!SELECTED FEEDS");
        console.log(selectedFeeds);
        for (const feedSource of selectedFeeds) {
            console.log(`Fetching feed ${feedSource[2]}`);
            console.log(this.constructFeedUrl(feedSource));
            try {
                const { data } = await this.agent.app.bsky.feed.getFeed(
                    {
                        feed: this.constructFeedUrl(feedSource),
                        limit: Math.ceil(maxPosts / selectedFeeds.length),
                    },
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );
                
                allPosts = [...allPosts, ...data.feed];
                
                if (allPosts.length >= maxPosts) {
                    break;
                }
            } catch (error) {
                console.error(`Error fetching feed ${feedSource[2]}: ${error}`);
                continue;
            }
        }
        
        const shuffledPosts = this.shuffleArray(allPosts);
        const finalPosts = shuffledPosts.slice(0, maxPosts);
        
        if (finalPosts.length === 0) {
            throw new Error('No posts could be fetched from any feed');
        }

        return finalPosts;
    }

    // Add this method to get raw materials with custom max posts
    public async getRawMaterialsFromLiveData(
        subscriptions: {user_handle: string, user_bio: string}[], 
        personality: string,
        maxPosts: number, 
        languages?: string
    ): Promise<HistoricalPost[]> {
        const selectedFeeds = await this.curateFeedSources(subscriptions, personality);
        let allPosts: FeedViewPost[] = [];
        console.log("!!!SELECTED FEEDS");
        console.log(selectedFeeds);
        for (const feedSource of selectedFeeds) {
            // use fetchFeedWithRetry
            console.log(`Fetching feed ${feedSource[2]} with batches`);
            const posts = await this.fetchFeedWithRetry(feedSource, Math.ceil(maxPosts / selectedFeeds.length));
            if (posts) {
                allPosts = [...allPosts, ...posts];
            }
            // console.log(`Fetching feed ${feedSource[2]}`);
            // console.log(this.constructFeedUrl(feedSource));
            // try {
            //     const { data } = await this.agent.app.bsky.feed.getFeed(
            //         {
            //             feed: this.constructFeedUrl(feedSource),
            //             limit: Math.ceil(maxPosts / selectedFeeds.length),
            //         },
            //         {
            //             headers: { // TODO do langauges better, we can specify priorities and such with'Accept-Language': 'en,es,fr;q=0.9,de;q=0.8'  // Example: English, Spanish, French (90% priority), German (80% priority)
            //                 // it is ISO 639-1
            //                 'Accept-Language': 'en'
            //             }
            //         }
            //     );
                
            //     allPosts = [...allPosts, ...data.feed];
                
            //     if (allPosts.length >= maxPosts) {
            //         break;
            //     }
            // } catch (error) {
            //     console.error(`Error fetching feed ${feedSource[2]}: ${error}`);
            //     continue;
            // }
        }
        
        const shuffledPosts = this.shuffleArray(allPosts);
        const finalPosts = shuffledPosts.slice(0, maxPosts);

        // map the fields of the posts to the historical post fields
        const historicalPosts = finalPosts.map(post => {
            const postRecord = post.post.record as AppBskyFeedPost.Record;
            return {
                text: postRecord.text as string,
                created_id: postRecord.created_id as string,
                author: postRecord.author as string,
                uri: postRecord.uri as string,
                has_entity: postRecord.has_entity as boolean,
                reply: postRecord.reply ? postRecord.reply.parent.uri as string : null
            };
        });
        
        if (historicalPosts.length === 0) {
            throw new Error('No posts could be fetched from any feed');
        }

        return historicalPosts;
    }

    // confirmed -- the AI is curating feed sources every time we get raw materials
    // is this desired? Or do we want to do it only occasionally?
    // so far it makes sense for this to be desired, user info changes.

    // Add the new concatenating method
    public async getConcatenatedFeeds(
        subscriptions: {user_handle: string, user_bio: string}[],
        personality: string,
        totalPosts: number,
        numFeeds: number
    ) {
        // Calculate posts per sub-feed (add some overlap for deduplication)
        const postsPerFeed = Math.ceil((totalPosts / numFeeds) * 1.5);
        
        // Store all sub-feeds
        const subFeeds: string[][] = [];
        
        // Generate each sub-feed
        for (let i = 0; i < numFeeds; i++) {
            console.log(`Generating sub-feed ${i + 1} of ${numFeeds}`);
            
            // Get raw materials for this sub-feed
            const rawMaterials = await this.getRawMaterialsWithLimit(
                subscriptions,
                personality,
                postsPerFeed
            );
            
            // Convert posts to strings
            const postTexts = rawMaterials.map(
                post => (post.post.record as AppBskyFeedPost.Record).text
            );
            
            // Curate this sub-feed
            const curatedFeed = await this.curateFeed(
                subscriptions,
                postTexts,
                personality
            );
            
            subFeeds.push(curatedFeed);
        }
        
        // Combine and deduplicate all feeds
        const allPosts = subFeeds.flat();
        const uniquePosts = [...new Set(allPosts)];
        
        // Curate the final combined feed if it's still too large
        let finalFeed: string[];
        if (uniquePosts.length > totalPosts) {
            finalFeed = await this.curateFeed(
                subscriptions,
                uniquePosts,
                personality
            );
            // Ensure we don't exceed requested total
            finalFeed = finalFeed.slice(0, totalPosts);
        } else {
            finalFeed = uniquePosts.slice(0, totalPosts);
        }
        
        return {
            subFeeds,    // All individual feeds
            finalFeed,   // Combined and deduplicated feed
            stats: {
                totalUniquePosts: uniquePosts.length,
                subFeedSizes: subFeeds.map(feed => feed.length),
                finalFeedSize: finalFeed.length
            }
        };
    }

    // New method to get a feed, will also likely perhaps require new raw mateirals method specifically for it:
    // takes three inputs: number of posts in total to take, number of posts per group, number of target posts in final feed
    // first we select relevant feed sources as we do in the other methods. We sample an equal number of posts from all those that add up to the total number of posts to take, then shuffle.
    // Then, we split the total taken posts into groups of size numPostsPerGroup
    // Then we distill each group (iterate over the list and distill) until we have less than or equal to numTargetPosts in final feed
    // Then we concatenate all the feeds together, deduplicate, and return the final feed
    
    public async getGroupDistilledFeed(
        subscriptions: {user_handle: string, user_bio: string}[],
        personality: string,
        totalPostsToTake: number,
        postsPerGroup: number,
        targetTotalPosts: number, 
        languages?: string
    ) {
        // Get initial raw materials
        const rawPosts = await this.getRawMaterialsWithLimit(
            subscriptions,
            personality,
            totalPostsToTake
        );

        // Convert posts to strings and shuffle them
        const shuffledPosts = this.shuffleArray(
            rawPosts.map(post => (post.post.record as AppBskyFeedPost.Record).text)
        );

        // Split posts into groups
        let groups: string[][] = [];
        for (let i = 0; i < shuffledPosts.length; i += postsPerGroup) {
            groups.push(shuffledPosts.slice(i, i + postsPerGroup));
        }

        console.log(`Split ${shuffledPosts.length} posts into ${groups.length} groups`);

        // Track distillation rounds
        const distillationHistory: number[] = [shuffledPosts.length];
        
        // Keep distilling all groups until we reach target or can't reduce further
        while (true) {
            // Count total posts across all groups
            const totalPosts = groups.reduce((sum, group) => sum + group.length, 0);
            
            // Break if we've reached target
            if (totalPosts <= targetTotalPosts) {
                console.log(`Reached target: ${totalPosts} posts <= ${targetTotalPosts} target`);
                break;
            }

            // Process each group once
            const newPosts: string[] = [];
            let canReduce = false;

            for (const group of groups) {
                // Skip empty groups
                if (group.length === 0) continue;

                // Attempt to distill this group
                const distilledGroup = await this.curateFeed(
                    subscriptions,
                    group,
                    personality,
                    languages
                );

                // Check if distillation actually reduced the group
                if (distilledGroup.length < group.length) {
                    canReduce = true;
                }
                
                newPosts.push(...distilledGroup);
            }

            // Break if we can't reduce any groups further
            if (!canReduce) {
                console.log('Cannot reduce groups further');
                break;
            }

            // Shuffle all posts and split into new groups
            const shuffledNewPosts = this.shuffleArray(newPosts);
            groups = [];
            for (let i = 0; i < shuffledNewPosts.length; i += postsPerGroup) {
                groups.push(shuffledNewPosts.slice(i, i + postsPerGroup));
            }
            
            // Track progress
            const newTotal = shuffledNewPosts.length;
            distillationHistory.push(newTotal);
            console.log(`Round complete: ${newTotal} posts remaining in ${groups.length} groups`);
        }

        // Combine all processed groups
        const allProcessedPosts = groups.flat();
        
        // Deduplicate posts
        const uniquePosts = [...new Set(allProcessedPosts)];
        
        // If we still have more posts than target, do final distillation
        let finalFeed: string[];
        if (uniquePosts.length > targetTotalPosts) {
            finalFeed = await this.curateFeed(
                subscriptions,
                uniquePosts,
                personality
            );
            finalFeed = finalFeed.slice(0, targetTotalPosts);
        } else {
            finalFeed = uniquePosts;
        }

        return {
            finalFeed,
            stats: {
                initialPostCount: shuffledPosts.length,
                groupCount: groups.length,
                distillationRounds: distillationHistory.length - 1,
                postsPerRound: distillationHistory,
                finalGroupSizes: groups.map(g => g.length),
                uniquePostCount: uniquePosts.length,
                finalPostCount: finalFeed.length
            }
        };
    }

    private getRandomPostsFromDataset(
        dataset: Table<any>,
        numPosts: number
    ): HistoricalPost[] {
        // Generate random indices
        const indices = new Set<number>();
        while (indices.size < numPosts) {
            indices.add(Math.floor(Math.random() * dataset.numRows));
        }

        // Convert indices to array and sort them
        const indicesArray = Array.from(indices).sort();

        // Map the indices to posts
        return indicesArray.map(idx => ({
            text: dataset.get(idx)?.text as string,
            created_id: dataset.get(idx)?.created_id as string,
            author: dataset.get(idx)?.author as string,
            uri: dataset.get(idx)?.uri as string,
            has_entity: dataset.get(idx)?.has_entity as boolean,
            reply: dataset.get(idx)?.reply as string | null
        }));
    }

    public async getRawMaterialsFromHistoricalData(
        dataset: Table<any>,
        maxPosts: number
    ): Promise<HistoricalPost[]> {
        try {
            const posts = await this.getRandomPostsFromDataset(dataset, maxPosts);
            
            if (posts.length === 0) {
                throw new Error('No posts could be sampled from historical data files');
            }

            console.log(`Successfully sampled ${posts.length} posts from historical data`);
            return posts.slice(0, maxPosts);
        } catch (error) {
            console.error('Error sampling from historical data:', error);
            throw error;
        }
    }

    private async saveDistillationData(
        roundNumber: number,
        groupIndex: number,
        promptMessages: any[],
        llmOutput: string,
        tempDir: string
    ): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseFilename = `round${roundNumber}_group${groupIndex}_${timestamp}`;

            const fullPromptMessages = [...promptMessages, {
                role: 'assistant',
                content: llmOutput
            }]

            const trainingPromptMessages = {
                "conversations": [
                    promptMessages[0], // system message
                    promptMessages[promptMessages.length - 1], // input message
                    {
                        role: 'assistant',
                        content: llmOutput
                    }
                ]
            }
            
            // Save prompt messages
            await writeFile(
                join(tempDir, `${baseFilename}_prompt.json`),
                JSON.stringify(fullPromptMessages, null, 2)
            );

            // save training prompt messages to a json
            await writeFile(
                join(tempDir, `${baseFilename}_training_prompt.json`),
                JSON.stringify(trainingPromptMessages, null, 2)
            );
            
            // Save LLM output
            await writeFile(
                join(tempDir, `${baseFilename}_output.txt`),
                llmOutput
            );
        } catch (error) {
            console.error('Error saving distillation data:', error);
        }
    }

    private async distillGroupsInParallel(
        groups: string[][],
        subscriptions: {user_handle: string, user_bio: string}[],
        personality: string,
        roundNumber: number,
        languages?: string
    ): Promise<{
        newPosts: string[],
        canReduce: boolean,
        distillationStats: {
            groupSize: number,
            resultSize: number,
            timeMs: number
        }[]
    }> {
        console.log(`Starting parallel distillation of ${groups.length} groups...`);
        const stats: {groupSize: number, resultSize: number, timeMs: number}[] = [];
        let canReduce = false;
        const newPosts: string[] = [];

        // Create temp directory for this round
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempDir = join('intermediate_outputs', `round${roundNumber}_${timestamp}`);
        await mkdir(tempDir, { recursive: true });

        // Create a semaphore to limit concurrent operations
        let runningTasks = 0;
        const semaphore = {
            acquire: async () => {
                while (runningTasks >= this.MAX_CONCURRENT_DISTILLATIONS) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                runningTasks++;
            },
            release: () => {
                runningTasks--;
            }
        };

        // Process all groups with semaphore control
        await Promise.all(groups.map(async (group, index) => {
            if (group.length === 0) {
                console.log(`Skipping empty group at index ${index}`);
                return;
            }

            await semaphore.acquire();
            try {
                const startTime = Date.now();
                console.log(`Starting distillation of group ${index + 1}/${groups.length} with ${group.length} posts...`);
                
                // Create prompt messages
                const stringified_subscriptions = this.stringifySubscriptions(subscriptions);
                const stringified_posts = this.stringifyPosts(group);
                
                const promptMessages = [...FEED_PROMPTS.POST_CURATION,
                    {
                        role: 'user',
                        content: `User personality: 
"""
${personality}
"""

User subscriptions list:
"""
${stringified_subscriptions}
"""

----

Some raw materials (recent posts from the subscribers) to make a feed from:
"""
${stringified_posts}
"""

Preferred languages:
"""
${languages}
"""

Note that user subscriptions are shown to give you additional hints about their interests. The user's subscriptions may not show up in the raw materials you see, and in fact you do not know who has written each individual post.

Only select posts that are in the preferred languages.

Focus narrowly on the user's interests: avoid selecting a variety of posts to "keep the feed interesting" and instead try to select posts that mostly align with the user's personality and interests.

NO USER THAT YOU SELECT SOURCES FOR IS RELATED TO ANY OTHER USER. EVERY INPUT/OUTPUT PAIR IS SEPARATE.
Prioritize putting more important posts first. But ensure variety.`
                    }
                ];

                const chatCompletion = await this.openai.chat.completions.create({
                    messages: promptMessages as any,
                    model: 'meta-llama/Meta-Llama-3-70B-Instruct',
                    max_completion_tokens: 500
                });

                const llmOutput = chatCompletion.choices[0].message.content;
                
                // Save prompt and output
                await this.saveDistillationData(
                    roundNumber,
                    index,
                    promptMessages,
                    llmOutput || '',
                    tempDir
                );

                if (!llmOutput) {
                    throw new Error('No output from the LLM');
                }

                // Process the output to get selected posts
                const selectedIndices = [...new Set(
                    llmOutput
                        .split('\n')
                        .map(line => parseInt(line.trim()))
                        .filter(num => !isNaN(num))
                        .map(num => num - 1)
                        .filter(idx => idx >= 0 && idx < group.length)
                )];

                const distilledGroup = selectedIndices.map(idx => group[idx]);

                const timeMs = Date.now() - startTime;
                console.log(`Group ${index + 1} distillation completed in ${timeMs}ms: ${group.length} -> ${distilledGroup.length} posts`);
                
                // Synchronize access to shared state
                if (distilledGroup.length < group.length) {
                    canReduce = true;
                }
                newPosts.push(...distilledGroup);
                stats.push({
                    groupSize: group.length,
                    resultSize: distilledGroup.length,
                    timeMs
                });
            } finally {
                semaphore.release();
            }
        }));

        // Log summary statistics
        const totalTimeMs = stats.reduce((sum, s) => sum + s.timeMs, 0);
        const avgTimeMs = Math.round(totalTimeMs / stats.length);
        console.log(`\nDistillation round summary:`);
        console.log(`Total processing time: ${totalTimeMs}ms`);
        console.log(`Average group processing time: ${avgTimeMs}ms`);
        console.log(`Total posts reduced from ${stats.reduce((sum, s) => sum + s.groupSize, 0)} to ${newPosts.length}`);
        
        return { newPosts, canReduce, distillationStats: stats };
    }

    public async getGroupDistilledFeedFromHistorical(
        subscriptions: {user_handle: string, user_bio: string}[],
        personality: string,
        rawMaterials: string[],
        postsPerGroup: number,
        targetTotalPosts: number,
        languages?: string
    ) {
        // input loading and processing moved outside of function to datagen.ts

        // Split posts into groups
        let groups: string[][] = [];
        for (let i = 0; i < rawMaterials.length; i += postsPerGroup) {
            groups.push(rawMaterials.slice(i, i + postsPerGroup));
        }

        console.log(`\nInitial setup:`);
        console.log(`Split ${rawMaterials.length} posts into ${groups.length} groups`);
        console.log(`Average group size: ${Math.round(rawMaterials.length / groups.length)}`);

        // Track distillation rounds
        const distillationHistory: number[] = [rawMaterials.length];
        let roundNumber = 1;
        
        // Keep distilling all groups until we reach target or can't reduce further
        while (true) {
            const totalPosts = groups.reduce((sum, group) => sum + group.length, 0);
            console.log(`\nStarting round ${roundNumber}:`);
            console.log(`Current total: ${totalPosts} posts in ${groups.length} groups`);
            
            if (totalPosts <= targetTotalPosts) {
                console.log(`✓ Reached target: ${totalPosts} posts <= ${targetTotalPosts} target`);
                break;
            }

            // Process groups in parallel
            const { newPosts, canReduce, distillationStats } = await this.distillGroupsInParallel(
                groups,
                subscriptions,
                personality,
                roundNumber,
                languages
            );

            if (!canReduce) {
                console.log(`✗ Cannot reduce groups further`);
                break;
            }

            // Shuffle and regroup
            const shuffledNewPosts = this.shuffleArray(newPosts);
            groups = [];
            for (let i = 0; i < shuffledNewPosts.length; i += postsPerGroup) {
                groups.push(shuffledNewPosts.slice(i, i + postsPerGroup));
            }
            
            // Track progress
            distillationHistory.push(shuffledNewPosts.length);
            console.log(`\nRound ${roundNumber} complete:`);
            console.log(`Posts: ${shuffledNewPosts.length} in ${groups.length} new groups`);
            console.log(`Reduction: ${Math.round((1 - shuffledNewPosts.length/totalPosts) * 100)}%`);
            
            roundNumber++;
        }

        // Combine all processed groups
        const allProcessedPosts = groups.flat();
        
        // Deduplicate posts
        const uniquePosts = [...new Set(allProcessedPosts)];
        
        // If we still have more posts than target, do final distillation
        let finalFeed: string[];
        if (uniquePosts.length > targetTotalPosts) {
            finalFeed = await this.curateFeed(
                subscriptions,
                uniquePosts,
                personality
            );
            finalFeed = finalFeed.slice(0, targetTotalPosts);
        } else {
            finalFeed = uniquePosts;
        }

        return {
            finalFeed,
            stats: {
                initialPostCount: rawMaterials.length,
                groupCount: groups.length,
                distillationRounds: distillationHistory.length - 1,
                postsPerRound: distillationHistory,
                finalGroupSizes: groups.map(g => g.length),
                uniquePostCount: uniquePosts.length,
                finalPostCount: finalFeed.length
            }
        };
    }


    public async getGroupDistilledFeedFromHistoricalForDatagen(
        subscriptions: {user_handle: string, user_bio: string}[],
        personality: string,
        postsPerGroup: number,
        targetTotalPosts: number,
        rawMaterials: {
            text: string,
            created_id: string,
            author: string,
            uri: string,
            has_entity: boolean,
            reply: string|null,
        }[],
        languages?: string,
    ) {
        // Convert posts to strings and shuffle them
        const shuffledPosts = this.shuffleArray(
            rawMaterials.map(post => post.text)
        );

        // Split posts into groups
        let groups: string[][] = [];
        for (let i = 0; i < shuffledPosts.length; i += postsPerGroup) {
            groups.push(shuffledPosts.slice(i, i + postsPerGroup));
        }

        console.log(`\nInitial setup:`);
        console.log(`Split ${shuffledPosts.length} posts into ${groups.length} groups`);
        console.log(`Average group size: ${Math.round(shuffledPosts.length / groups.length)}`);

        // Track distillation rounds
        const distillationHistory: number[] = [shuffledPosts.length];
        let roundNumber = 1;
        
        // Keep distilling all groups until we reach target or can't reduce further
        while (true) {
            const totalPosts = groups.reduce((sum, group) => sum + group.length, 0);
            console.log(`\nStarting round ${roundNumber}:`);
            console.log(`Current total: ${totalPosts} posts in ${groups.length} groups`);
            
            if (totalPosts <= targetTotalPosts) {
                console.log(`✓ Reached target: ${totalPosts} posts <= ${targetTotalPosts} target`);
                break;
            }

            // Process groups in parallel
            const { newPosts, canReduce, distillationStats } = await this.distillGroupsInParallel(
                groups,
                subscriptions,
                personality,
                roundNumber,
                languages
            );

            if (!canReduce) {
                console.log(`✗ Cannot reduce groups further`);
                break;
            }

            // Shuffle and regroup
            const shuffledNewPosts = this.shuffleArray(newPosts);
            groups = [];
            for (let i = 0; i < shuffledNewPosts.length; i += postsPerGroup) {
                groups.push(shuffledNewPosts.slice(i, i + postsPerGroup));
            }
            
            // Track progress
            distillationHistory.push(shuffledNewPosts.length);
            console.log(`\nRound ${roundNumber} complete:`);
            console.log(`Posts: ${shuffledNewPosts.length} in ${groups.length} new groups`);
            console.log(`Reduction: ${Math.round((1 - shuffledNewPosts.length/totalPosts) * 100)}%`);
            
            roundNumber++;
        }

        // Combine all processed groups
        const allProcessedPosts = groups.flat();
        
        // Deduplicate posts
        const uniquePosts = [...new Set(allProcessedPosts)];
        
        // If we still have more posts than target, do final distillation
        let finalFeed: string[];
        if (uniquePosts.length > targetTotalPosts) {
            finalFeed = await this.curateFeed(
                subscriptions,
                uniquePosts,
                personality
            );
            finalFeed = finalFeed.slice(0, targetTotalPosts);
        } else {
            finalFeed = uniquePosts;
        }

        return {
            finalFeed,
            stats: {
                initialPostCount: shuffledPosts.length,
                groupCount: groups.length,
                distillationRounds: distillationHistory.length - 1,
                postsPerRound: distillationHistory,
                finalGroupSizes: groups.map(g => g.length),
                uniquePostCount: uniquePosts.length,
                finalPostCount: finalFeed.length
            }
        };
    }

    public async fetchAndSavePosts(
        numPosts: number,
        feedSource: [string, string, string] = ['did:plc:4jb3re5tvklsvhuc3lkerj5q', 'aaak6p5s2f3cu', 'Academic Sky'],
        outputPath: string = 'posts_sample.jsonl'
    ): Promise<void> {
        await this.ensureAgentReady();
        const batchSize = 99; // BSKY API limit
        const seenUris = new Set<string>();
        let allPosts: FeedViewPost[] = [];
        let cursor: string | undefined;
        let consecutiveEmptyBatches = 0;
        const maxEmptyBatches = 5;
        
        console.log(`Starting to fetch ${numPosts} unique posts from ${feedSource[2]}...`);
        console.log(`Feed URL: ${this.constructFeedUrl(feedSource)}`);
        
        const writeStream = fs.createWriteStream(outputPath, { flags: 'a' });
        
        while (seenUris.size < numPosts) {
            const remainingPosts = numPosts - seenUris.size;
            const currentBatchSize = Math.min(batchSize, remainingPosts);
            
            console.log(`\nFetching batch with size ${currentBatchSize}, cursor: ${cursor || 'initial'}`);
            console.log(`Current unique posts: ${seenUris.size}, Remaining: ${remainingPosts}`);
            
            try {
                const { data } = await this.agent.app.bsky.feed.getFeed(
                    {
                        feed: this.constructFeedUrl(feedSource),
                        limit: currentBatchSize,
                        cursor
                    },
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );
                
                console.log(`Received ${data.feed.length} posts in response`);
                
                // Update cursor for next batch
                const previousCursor = cursor;
                cursor = data.cursor;
                console.log(`Previous cursor: ${previousCursor || 'initial'}`);
                console.log(`New cursor: ${cursor || 'none'}`);
                
                if (data.feed.length === 0) {
                    consecutiveEmptyBatches++;
                    console.log(`Warning: Received empty batch (${consecutiveEmptyBatches}/${maxEmptyBatches})`);
                    if (consecutiveEmptyBatches >= maxEmptyBatches) {
                        console.log('Max empty batches reached, stopping');
                        break;
                    }
                } else {
                    consecutiveEmptyBatches = 0;
                    
                    // Process and save each unique post
                    for (const post of data.feed) {
                        const uri = post.post.uri;
                        if (!seenUris.has(uri)) {
                            seenUris.add(uri);
                            
                            // Save the complete post data
                            const fullPostData = {
                                post: post.post,
                                reply: post.reply,
                                reason: post.reason,
                                record: post.post.record
                            };
                            
                            writeStream.write(JSON.stringify(fullPostData) + '\n');
                            allPosts.push(post);
                        }
                    }
                }
                
                console.log(`Batch complete. Total unique posts: ${seenUris.size}/${numPosts}`);
                
                // If no cursor, we've reached the end of the feed
                if (!cursor) {
                    console.log('No cursor returned, reached end of feed');
                    break;
                }
                
                // Add small delay between batches
                const delayMs = 100;
                console.log(`Waiting ${delayMs}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
            } catch (error) {
                console.error('Error fetching posts:', error);
                if (error instanceof Error) {
                    console.error('Error details:', {
                        message: error.message,
                        name: error.name,
                        stack: error.stack
                    });
                }
                const retryDelayMs = 1000;
                console.log(`Waiting ${retryDelayMs}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
        
        writeStream.end();
        console.log(`\nFetch complete:`);
        console.log(`- Total unique posts fetched: ${seenUris.size}`);
        console.log(`- Target was: ${numPosts}`);
        console.log(`- Output saved to: ${outputPath}`);
    }

}

