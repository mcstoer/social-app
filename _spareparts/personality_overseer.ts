import { BskyAgent } from '@atproto/api';
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs';
import OpenAI from 'openai';
import { AppBskyFeedPost } from '@atproto/api'
import { PERSONALITY_PROMPTS } from './prompts';
import type { ChatCompletionMessageParam } from 'openai/src/resources/chat/completions'


interface Post {
    content: string;
    media_attachments: string[];
    timestamp: string;
    language: string;
}

interface RevisitedPost extends Post {
    revisit_timestamps: string[];
}

interface Reply extends Post {
    replied_to_handle: string;
    replied_to_text: string;
}

interface Share extends Post {
    share_timestamp: string;
}

interface Block {
    block_timestamp: string;
    blocked_handle: string;
    blocked_bio: string;
    blocked_recent_posts: Post[];
}

interface BskyAuthCredentials {
    identifier: string;
    password: string;
}

interface FollowedFeed {
    did: string;
    generator: string;
    displayName: string;
}

export class PersonalityOverseer {
    private agent: BskyAgent;
    private readonly openai: OpenAI;
    private readonly model: string;
    private use_llm_for_sumarizing_inputs: boolean;
    private queryInformation: boolean;
    private queryList: [string];

    // here's how it's going to work. I am going to have a flag passed into the constructor that if on will mean that we query information, and another optional one which is a list of strings which is what to query. Then for what we can query there will be query functions right along the stringify ones which just go in there (like for posts, followed Feeds, etc. We query the information and return it in the proper format.). And for what is queriable, in the update personality thing, for each field, we 1) check if querying on in the class and then 2) if so we call the query thing first to get information then we pass that onto stringification which does its thing and gives us raw materials. In this way we complete the function of the thing.

    constructor(
        apiKey: string,
        baseURL: string,
        model: string,
        bskyAuth?: BskyAuthCredentials,
        use_llm_for_sumarizing_inputs: boolean = false,
        queryInformation: boolean = true,
        queryList: [string] = ["followedFeeds"]
    ) {
        this.agent = new BskyAgent({
            service: bskyAuth ? 'https://bsky.social' : 'https://public.api.bsky.app'
        });

        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey,
            baseURL
        });

        // Store configuration options
        this.model = model;
        this.use_llm_for_sumarizing_inputs = use_llm_for_sumarizing_inputs;
        this.queryInformation = queryInformation;
        this.queryList = queryList;

        // If auth credentials are provided, set up login
        if (bskyAuth) {
            this.initializeAuth(bskyAuth).catch(error => {
                console.error('Failed to initialize auth:', error);
            });
        }
    }

    private async initializeAuth(bskyAuth: BskyAuthCredentials): Promise<void> {
        try {
            await this.agent.login({
                identifier: bskyAuth.identifier,
                password: bskyAuth.password
            });
            console.log('Successfully logged in to Bluesky');
        } catch (error) {
            console.error('Failed to login to Bluesky:', error);
            this.agent = new BskyAgent({
                service: 'https://public.api.bsky.app'
            });
        }
    }

    private async ensureAgentReady(): Promise<boolean> {
        if (!this.agent.session) {
            console.log('No active session - authentication may not have completed');
            return false;
        }

        try {
            await this.agent.resumeSession({
                did: this.agent.session.did,
                handle: this.agent.session.handle,
                email: this.agent.session.email,
                accessJwt: this.agent.session.accessJwt,
                refreshJwt: this.agent.session.refreshJwt,
                active: true
            });
            return true;
        } catch (error) {
            console.warn('Failed to resume Bluesky session:', error);
            return false;
        }
    }

    // We want to have "stringification" functions for each potential input field. Some will involve LLMs (for summarization), some will not (the data will be structured so we can maybe use statistics etc. to summarize some things).

    private async queryFollowedFeeds(): Promise<FollowedFeed[] | null> {
        if (!this.agent.session) {
            console.log('Not querying followed feeds - no active session');
            return null;
        }

        try {
            await this.ensureAgentReady();

            console.log('Fetching user preferences...');
            const { data } = await this.agent.api.app.bsky.actor.getPreferences();
            
            // Look for saved feeds preferences specifically
            const savedFeedsPref = data.preferences.find(
                (pref: any) => pref.$type === 'app.bsky.actor.defs#savedFeedsPrefV2'
            );
            
            if (!savedFeedsPref?.items) {
                console.log('No saved feeds found in user data');
                return null;
            }

            // Extract feed URIs from preferences, filtering for type "feed"
            const feedItems = (savedFeedsPref.items as any[]).filter((item) => item.type === 'feed');
            const feedUris = feedItems.map((item) => item.value);
            
            console.log(`Found ${feedUris.length} feed URIs in user preferences`);
            
            // Convert URIs to our FollowedFeed format
            const followedFeeds: FollowedFeed[] = [];
            
            for (const uri of feedUris) {
                // URI format: at://did:plc:xxx/app.bsky.feed.generator/yyy
                const matches = uri.match(/at:\/\/(did:[^\/]+)\/app\.bsky\.feed\.generator\/([^\/]+)/);
                if (matches) {
                    const [_, did, generator] = matches;
                    try {
                        // Try to get the feed's display name
                        const { data: feedView } = await this.agent.api.app.bsky.feed.getFeedGenerator({ 
                            feed: uri 
                        });
                        followedFeeds.push({
                            did,
                            generator,
                            displayName: feedView.displayName || generator
                        });
                        console.log(`Successfully processed feed: ${feedView.displayName || generator}`);
                    } catch (error) {
                        console.log(`Could not get feed info for ${generator}, using generator name`);
                        followedFeeds.push({ did, generator, displayName: generator });
                    }
                }
            }

            return followedFeeds;
        } catch (error) {
            console.error('Failed to fetch followed feeds:', error);
            return null;
        }
    }

    private stringifyFollowedFeeds(followedFeeds: FollowedFeed[] | null): string {
        if (!followedFeeds || followedFeeds.length === 0) {
            return 'No followed feeds found.';
        }

        let stringified = 'Followed Feeds:\n"""\n';
        for (const feed of followedFeeds) {
            stringified += `Feed: ${feed.displayName}\n`;
            stringified += `Type: ${feed.generator}\n`;
            stringified += '---\n';
        }
        stringified += '"""\n';

        return stringified;
    }

    // NOTE: will change depending on the API we feed this info in with. But the core will be the same.
    private stringifyRecentFollows(recent_follows: { followed_bio: string, followed_handle: string, followed_recent_posts?: { post_text: string, post_url: string }[] }[]) {
        let stringified_recent_follows: string = 'Recent follows:\n"""\n';
        if (recent_follows.length > 5) { // truncate if too long
            recent_follows = recent_follows.slice(0, 5);
        }
        for (const follow of recent_follows) {
            stringified_recent_follows += `Followed Handle: ${follow.followed_handle}\n`;
            stringified_recent_follows += `Followed Bio: ${follow.followed_bio}\n`;
            if (follow.followed_recent_posts) {
                stringified_recent_follows += `Recent posts:\n`;
                for (const post of follow.followed_recent_posts) {
                    stringified_recent_follows += `Post: ${post.post_text}\n`;
                }
            }
            stringified_recent_follows += '"""\n'; // Add extra newline between each follow
        }
        return stringified_recent_follows;
    }

    private stringifyLikes(likes: { liked_post_text: string, liked_post_author_handle: string }[]) {
        let stringified_likes: string = 'Liked Posts:\n\n';
        if (likes.length > 15) { // truncate if too long
            likes = likes.slice(0, 15);
        }
        for (const like of likes) {
            stringified_likes += `Liked Post Author: ${like.liked_post_author_handle}\n`;
            stringified_likes += `Liked Post Content: ${like.liked_post_text}\n`;
            stringified_likes += '\n'; // Add extra newline between each like
        }
        return stringified_likes;
    }

    private async stringifyClickthroughs(clickthroughs: { clicked_post_text: string, clicked_post_url: string, clicked_post_author_handle: string }[]) { // this one uses an LLM to summarize the clickthroughs
        let stringified_clickthroughs: string = 'Clickthroughs:\n"""\n';
        if (clickthroughs.length > 20) { // truncate if too long
            clickthroughs = clickthroughs.slice(0, 20);
        }
        for (const clickthrough of clickthroughs) {
            stringified_clickthroughs += `Clicked Post Author: ${clickthrough.clicked_post_author_handle}\n`;
            stringified_clickthroughs += `Clicked Post Content: ${clickthrough.clicked_post_text}\n`;
            stringified_clickthroughs += '\n'; // Add extra newline between each clickthrough
        }
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({ // this will stop complaining ONCE we modify the prompt to be correct
                model: this.model,
                messages: [...PERSONALITY_PROMPTS.clickthroughs_prompt, { role: 'user', content: stringified_clickthroughs }]
            });
            stringified_clickthroughs = chatCompletion.choices[0].message.content as string;
        }
        return stringified_clickthroughs;
    }

    // LLM-capable stringification function for  posts
    

    // I remember that we were talking about what is private information vs public, both between the personality and the input data. I'd rather have one method to change -- already this method just updates and returns the new personality based on current personality + whatever input fields are available, perhaps the distinction between public and private is handled by what inputs we give it? And what we do with the returned personality.
    public async updatePersonalityWithLLM(input_data: any) { // input_data will be a dict with potential keys: 'recent_follows', 'likes', 'clickthroughs', 'recent_posts', 'top_revisited_posts', 'replies' (and the posts these were in reply to), 'shares', 'blocks' (recent people whom they blocked), 'writing_style_analysis' (a string, maybe not as an input but something we generate if one of or more of posts and replies are available -- attempt to glean insight on their recent thoughts by doing a deep analysis of their writing style. Are they mad? Depressed? Elated? This is an LLM summary); potentially more. Note that each of these inputs will at least be a dict, maybe a list of dicts -- for instance a dict for a single "block" might be the user profile of the person they blocked, and optionally some recent posts of theirs.
        let stringified_recent_follows: string = '';
        let stringified_likes: string = '';
        let stringified_clickthroughs: string = '';
        let stringified_recent_posts: string = '';
        let stringified_top_revisited_posts: string = '';
        let stringified_replies: string = '';
        let stringified_shares: string = '';
        let stringified_blocks: string = '';
        let stringified_writing_style_analysis: string = '';
        let stringified_followed_feeds: string = '';

        if ('followedFeeds' in input_data) {
            stringified_followed_feeds = await this.stringifyFollowedFeeds(input_data['followedFeeds']);
        } else if (this.queryInformation && this.queryList.includes('followedFeeds')) {
            const followedFeeds = await this.queryFollowedFeeds();
            if (followedFeeds) {
                stringified_followed_feeds = await this.stringifyFollowedFeeds(followedFeeds);
            }
        }

        if ('recent_follows' in input_data) {
            // we want to get the profiles of the people they followed recently
            stringified_recent_follows = await this.stringifyRecentFollows(input_data['recent_follows']);
        }

        if ('likes' in input_data) {
            stringified_likes = await this.stringifyLikes(input_data['likes']);
        }

        if ('clickthroughs' in input_data) {
            stringified_clickthroughs = await this.stringifyClickthroughs(input_data['clickthroughs']);
        }

        if ('recent_posts' in input_data) {
            stringified_recent_posts = await this.stringifyRecentPosts(input_data['recent_posts']);
        }

        if ('top_revisited_posts' in input_data) {
            stringified_top_revisited_posts = await this.stringifyTopRevisitedPosts(input_data['top_revisited_posts']);
        }

        if ('replies' in input_data) {
            stringified_replies = await this.stringifyReplies(input_data['replies']);
        }

        if ('shares' in input_data) {
            stringified_shares = await this.stringifyShares(input_data['shares']);
        }

        if ('blocks' in input_data) {
            stringified_blocks = await this.stringifyBlocks(input_data['blocks']);
        }

        // think about: make without previous personality, then compare
        //
    

        // TODO add posts, blocks, mutes for queries; and then a sort-of backtesting script using the post dataset.
        // How will the post dataset look?
        // Well we have a bunch of posts. EAch post has its author, created at, and an optional reply to.
        // Hey if the intent is to test it on a variety of users, might we not want to make something which is "supply an account and we use public information to make feeds for them?" Seems more generally applicable than something which crawls through json, aggregating and aggregating?


        // private personality might be split into 6 -- early mid late, weekday weekend
        // public profile is a set of unique traits drawn from all, initial suggestion given by LLM
        // sections of "early" "mid" "late" might vary by user

        // TODO Add time and metadata as an input, timestamps for each thing above

        // TODO add mutes

        // if ('recent_posts' in input_data && 'replies' in input_data) {
        //     stringified_writing_style_analysis = await this.stringifyWritingStyleAnalysis(input_data['recent_posts'], input_data['replies']);
        // }
        let existing_personality = input_data['existing_personality'] || "No personality written yet.";
        if (existing_personality !== "") {
            existing_personality = "Current User personality:\n\n" + existing_personality;
        } else {
            existing_personality = "User has not specified a personality yet.";
        }

        // TODO IF authenticated, query the user's handle
        let user_handle = '';
        if (this.agent.session) {
            user_handle = this.agent.session.handle;
        } else {
            user_handle = input_data['user_handle'];
        }

        // Create unified string of all input data
        const stringified_input_data = `Current User ID: ${user_handle}\n${stringified_followed_feeds}\n${stringified_recent_follows}\n${stringified_likes}\n${stringified_clickthroughs}\n${stringified_recent_posts}\n${stringified_top_revisited_posts}\n${stringified_replies}\n${stringified_shares}\n${stringified_blocks}\n${existing_personality}`;
        
        const messages = [...PERSONALITY_PROMPTS.personality_update_prompt, { role: 'user', content: stringified_input_data } as ChatCompletionMessageParam]; // existing personality last to ensure that it is close at hand/remembered more by the LLM

        const chatCompletion = await this.openai.chat.completions.create({
            model: this.model,
            messages: messages
        });

        const content = chatCompletion.choices[0].message.content;
        if (!content) {
            throw new Error("No content returned from chat completion");
        }

        const match = content.match(/<Personality>([\s\S]*?)<\/Personality>/);
        if (!match) {
            // print the flawed output
            console.log(messages);  
            console.log("---------------------")
            console.log(stringified_input_data);
            console.log("!!!FALLEN PERSONALITY OUTPUT");
            console.log(content);
            throw new Error("No personality tags found in chat completion response");
        }

        return match[1].trim(); // TODO now that we are using personal agents, add queries for some of this
    }

    private async stringifyRecentPosts(posts: Post[]) {
        let stringified_posts: string = 'Recent Posts:\n"""\n';
        if (posts.length > 10) { // truncate if too long
            posts = posts.slice(0, 10);
        }
        for (const post of posts) {
            stringified_posts += `Timestamp: ${post.timestamp}\n`;
            stringified_posts += `Content: ${post.content}\n`;
            if (post.media_attachments.length > 0) {
                stringified_posts += `Media: ${post.media_attachments.join(', ')}\n`;
            }
            stringified_posts += `Language: ${post.language}\n`;
            stringified_posts += '\n';
        }
        
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [...PERSONALITY_PROMPTS.posts_prompt, { role: 'user', content: stringified_posts }]
            });
            stringified_posts = chatCompletion.choices[0].message.content as string;
        } else {
            stringified_posts += '"""\n';
        }
        return stringified_posts;
    }

    private async stringifyTopRevisitedPosts(posts: RevisitedPost[]) {
        let stringified_posts: string = 'Top Revisited Posts:\n\n';
        if (posts.length > 5) { // truncate if too long
            posts = posts.slice(0, 5);
        }
        for (const post of posts) {
            stringified_posts += `Timestamp: ${post.timestamp}\n`;
            stringified_posts += `Content: ${post.content}\n`;
            if (post.media_attachments.length > 0) {
                stringified_posts += `Media: ${post.media_attachments.join(', ')}\n`;
            }
            stringified_posts += `Language: ${post.language}\n`;
            stringified_posts += `Revisit timestamps: ${post.revisit_timestamps.join(', ')}\n`;
            stringified_posts += `Total revisits: ${post.revisit_timestamps.length}\n`;
            stringified_posts += '\n';
        }
        
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    ...PERSONALITY_PROMPTS.revisited_posts_prompt,
                    { role: 'user', content: stringified_posts }
                ]
            });
            stringified_posts = chatCompletion.choices[0].message.content as string;
        }
        return stringified_posts;
    }

    private async stringifyReplies(replies: Reply[]) {
        let stringified_replies: string = 'Replies:\n\n';
        if (replies.length > 10) { // truncate if too long
            replies = replies.slice(0, 10);
        }
        for (const reply of replies) {
            stringified_replies += `Timestamp: ${reply.timestamp}\n`;
            stringified_replies += `Replying to: ${reply.replied_to_handle}\n`;
            stringified_replies += `Original post: ${reply.replied_to_text}\n`;
            stringified_replies += `Reply content: ${reply.content}\n`;
            if (reply.media_attachments.length > 0) {
                stringified_replies += `Media: ${reply.media_attachments.join(', ')}\n`;
            }
            stringified_replies += `Language: ${reply.language}\n`;
            stringified_replies += '\n';
        }
        
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    ...PERSONALITY_PROMPTS.replies_prompt,
                    { role: 'user', content: stringified_replies }
                ]
            });
            stringified_replies = chatCompletion.choices[0].message.content as string;
        }
        return stringified_replies;
    }

    private async stringifyShares(shares: Share[]) {
        let stringified_shares: string = 'Shares:\n\n';
        if (shares.length > 5) { // truncate if too long
            shares = shares.slice(0, 5);
        }
        for (const share of shares) {
            stringified_shares += `Original post timestamp: ${share.timestamp}\n`;
            stringified_shares += `Shared at: ${share.share_timestamp}\n`;
            stringified_shares += `Content: ${share.content}\n`;
            if (share.media_attachments.length > 0) {
                stringified_shares += `Media: ${share.media_attachments.join(', ')}\n`;
            }
            stringified_shares += `Language: ${share.language}\n`;
            stringified_shares += '\n';
        }
        
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    ...PERSONALITY_PROMPTS.shares_prompt,
                    { role: 'user', content: stringified_shares }
                ]
            });
            stringified_shares = chatCompletion.choices[0].message.content as string;
        }
        return stringified_shares;
    }

    private async stringifyBlocks(blocks: Block[]) {
        let stringified_blocks: string = 'Blocks:\n\n';
        if (blocks.length > 5) { // truncate if too long
            blocks = blocks.slice(0, 5);
        }
        for (const block of blocks) {
            stringified_blocks += `Block timestamp: ${block.block_timestamp}\n`;
            stringified_blocks += `Blocked user: ${block.blocked_handle}\n`;
            stringified_blocks += `Blocked user bio: ${block.blocked_bio}\n`;
            if (block.blocked_recent_posts.length > 0) {
                stringified_blocks += `Recent posts from blocked user:\n`;
                for (const post of block.blocked_recent_posts) {
                    stringified_blocks += `  - Posted at ${post.timestamp}: ${post.content}\n`;
                    if (post.media_attachments.length > 0) {
                        stringified_blocks += `    Media: ${post.media_attachments.join(', ')}\n`;
                    }
                }
            }
            stringified_blocks += '\n';
        }
        
        if (this.use_llm_for_sumarizing_inputs) {
            const chatCompletion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    ...PERSONALITY_PROMPTS.blocks_prompt,
                    { role: 'user', content: stringified_blocks }
                ]
            });
            stringified_blocks = chatCompletion.choices[0].message.content as string;
        }
        return stringified_blocks;
    }
}