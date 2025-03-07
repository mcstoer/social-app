import { AppBskyFeedPost } from '@atproto/api';
import { FeedCurator } from './feed_getter';
import * as fs from 'fs';
import * as path from 'path';
import { writeFile } from 'fs/promises';

// Types for test organization
interface UserProfile {
    name: string;
    subscriptions: Array<{user_handle: string, user_bio: string}>;
    personality: string;
    languages?: string;
}

// Helper function to ensure output directory exists
function ensureOutputDir(baseDir: string, subDir?: string): string {
    const outputPath = subDir ? path.join(baseDir, subDir) : baseDir;
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    return outputPath;
}

// Helper function to write feed to file
async function writeFeedToFile(feed: string[] | undefined, baseDir: string, subDir: string, filename: string) {
    const outputDir = ensureOutputDir(baseDir, subDir);
    const filepath = path.join(outputDir, filename);
    const timestamp = new Date().toISOString();
    const content = `Feed generated at: ${timestamp}\n\n` + 
        (feed?.map((post, index) => 
            `Post ${index + 1}:\n${post}\n${'='.repeat(50)}\n`
        ).join('\n') || 'Empty feed');

    await fs.promises.writeFile(filepath, content);
    console.log(`Wrote feed to ${filepath}`);
}

// Helper function to write stats
async function writeStats(stats: any, baseDir: string, subDir: string) {
    const outputDir = ensureOutputDir(baseDir, subDir);
    const statsPath = path.join(outputDir, 'feed_stats.json');
    await fs.promises.writeFile(
        statsPath,
        JSON.stringify({ ...stats, timestamp: new Date().toISOString() }, null, 2)
    );
}

// Main test function for a single user profile
async function testUserProfile(curator: FeedCurator, profile: UserProfile, baseDir: string) {
    console.log(`\n=== Testing feeds for ${profile.name} ===`);
    const subDir = profile.name.toLowerCase().replace(/\s+/g, '_');

    // Basic Feed Test
    console.log('\nTesting Basic Feed Creation');
    const rawPosts = await curator.getRawMaterials(profile.subscriptions, profile.personality);
    const posts = rawPosts.map(post => (post.post.record as AppBskyFeedPost.Record).text);
    const basicFeed = await curator.curateFeed(profile.subscriptions, posts, profile.personality, profile.languages);
    await writeFeedToFile(basicFeed, baseDir, subDir, 'basic_feed.txt');

    // Distilled Feed Test
    console.log('\nTesting Feed Distillation');
    const distilledFeed = await curator.getDistilledFeed(profile.subscriptions, profile.personality, profile.languages);
    for (let i = 0; i < distilledFeed.allDistillations.length; i++) {
        await writeFeedToFile(
            distilledFeed.allDistillations[i],
            baseDir,
            subDir,
            `distilled_feed_step_${i + 1}.txt`
        );
    }
    await writeFeedToFile(distilledFeed.finalFeed, baseDir, subDir, 'distilled_feed_final.txt');

    // Concatenated Feed Test
    console.log('\nTesting Sub-feed Generation and Concatenation');
    const concatenatedResult = await curator.getConcatenatedFeeds(
        profile.subscriptions,
        profile.personality,
        100,
        6
    );

    for (let i = 0; i < concatenatedResult.subFeeds.length; i++) {
        await writeFeedToFile(
            concatenatedResult.subFeeds[i],
            baseDir,
            subDir,
            `concatenated_subfeed_${i + 1}.txt`
        );
    }
    await writeFeedToFile(concatenatedResult.finalFeed, baseDir, subDir, 'concatenated_feed_final.txt');

    // Group Distilled Feed Test
    console.log('\nTesting Group Distilled Feed Generation');
    const groupDistilledResult = await curator.getGroupDistilledFeed(
        profile.subscriptions,
        profile.personality,
        200,  // total posts to take
        20,   // posts per group
        50    // target total posts
    );

    await writeFeedToFile(
        groupDistilledResult.finalFeed,
        baseDir,
        subDir,
        'group_distilled_feed.txt'
    );

    // Write stats
    const stats = {
        profileName: profile.name,
        basicFeedLength: basicFeed.length,
        distillationSteps: distilledFeed.allDistillations.length,
        finalDistilledLength: distilledFeed.finalFeed.length,
        concatenatedStats: concatenatedResult.stats,
        groupDistilledStats: groupDistilledResult.stats
    };
    await writeStats(stats, baseDir, subDir);
} // NOTE TO SELF got to improve the distillation process across historical posts, even 8b is questionable at times?
// I can improve this for sure. 1) by investigating why it often cuts things in half. 2. probably through better instructions to the model. 3) the few-shot examples are leaking, I see japanese art, it probably should not be there, consider not using fewshots (this will improve perf greatly.)

// Define test profiles
const testProfiles: UserProfile[] = [
    {
        name: "Tech Developer",
        subscriptions: [
            { user_handle: '@tsenart.bsky.social', user_bio: 'Performance engineer. Creator of vegeta HTTP load testing tool.' },
            { user_handle: '@davidfowl.bsky.social', user_bio: '.NET architect, ASP.NET core contributor' },
            { user_handle: '@cassidoo.bsky.social', user_bio: 'Principal Developer Experience Engineer' }
        ],
        personality: `* Interested in systems programming and performance optimization
* Passionate about open source development
* Enjoys learning new programming languages and paradigms
* Follows tech industry news and emerging technologies`,
        languages: 'English'
    },
    {
        name: "Crypto Enthusiast",
        subscriptions: [
            { user_handle: '@vitalik.eth', user_bio: 'Ethereum co-founder. Interested in crypto, mechanism design, and social technology.' },
            { user_handle: '@cryptoking', user_bio: 'DeFi researcher and yield farming expert. Always looking for the next big protocol.' },
            { user_handle: '@web3builder', user_bio: 'Building the decentralized future. Smart contract developer and blockchain architect.' }
        ],
        personality: `* Deep interest in cryptocurrency markets and DeFi protocols
* Follows blockchain technology developments closely
* Participates in DAOs and governance discussions
* Interested in tokenomics and mechanism design
* Values decentralization and financial innovation`,
        languages: 'English'
    },
    {
        name: "Writer Community",
        subscriptions: [
            { user_handle: '@novelist_jane', user_bio: 'NYT Bestselling author of fantasy novels. Writing coach and mentor.' },
            { user_handle: '@writeright', user_bio: 'Literary agent specializing in YA and Science Fiction. Always looking for fresh voices.' },
            { user_handle: '@bookworm_daily', user_bio: 'Book reviewer and writing community organizer. #amwriting #writingcommunity' }
        ],
        personality: `* Aspiring novelist working on first manuscript
* Passionate about creative writing and storytelling
* Active in writing workshops and critique groups
* Interested in publishing industry news
* Enjoys both reading and writing fantasy
* Dislikes technology and writes with a typewriter`,
        languages: 'English and French'
    },
    {
        name: "Hybrid User",
        subscriptions: [
            { user_handle: '@tech_anime_dev', user_bio: 'Full-stack developer by day, anime artist by night. Building Web3 tools for creators.' },
            { user_handle: '@crypto_writer', user_bio: 'Technical writer specializing in blockchain. Published author of "DeFi Revolution".' },
            { user_handle: '@animefan_coder', user_bio: 'Software engineer and manga enthusiast. Creating open-source tools for the anime community.' }
        ],
        personality: `* Passionate about both technology and creative arts
* Actively involved in Web3 development and anime community
* Writes technical documentation and creative fiction
* Interested in intersection of tech and creative industries
* Follows cryptocurrency markets and anime releases
* Contributes to open-source projects`,
        languages: 'English and Japanese'
    }
];

async function testAuthenticatedFeedGetter() {
    console.log('\n=== Testing Authenticated Feed Getter ===');
    
    // Create an authenticated curator
    const authenticatedCurator = new FeedCurator(
        'YaYRpfI7BiIX0yTac43qMjt0h2XugirD', 
        'https://api.deepinfra.com/v1/openai',
        {
            identifier: 'e-p-armstrong.bsky.social',
            password: 'pHnvqcBQitYPS98'
        }
    );

    // Test basic functionality with the authenticated curator
    try {
        // Wait a moment for authentication to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're authenticated before proceeding
        await authenticatedCurator['ensureAgentReady']();

        const testProfile = {
            name: "Auth Test User",
            subscriptions: [
                { user_handle: '@e-p-armstrong.bsky.social', user_bio: 'Test user for authenticated feed getting' }
            ],
            personality: "Testing authenticated feed getting capabilities"
        };

        // First test feed source selection specifically
        console.log('\nTesting authenticated feed source selection...');
        const selectedFeeds = await authenticatedCurator.curateFeedSources(
            testProfile.subscriptions,
            testProfile.personality
        );

        if (!selectedFeeds || selectedFeeds.length === 0) {
            console.log('Warning: No feeds were selected from authentication');
        } else {
            console.log(`Selected ${selectedFeeds.length} feeds from user's preferences`);
            
            // Log the selected feeds for inspection
            selectedFeeds.forEach((feed, index) => {
                console.log(`Feed ${index + 1}: ${feed[2]} (${feed[1]} from ${feed[0]})`);
            });
        }

        // Then test the full feed creation process
        console.log('\nTesting authenticated feed creation...');
        const rawPosts = await authenticatedCurator.getRawMaterials(
            testProfile.subscriptions,
            testProfile.personality
        );
        
        console.log(`Successfully fetched ${rawPosts.length} posts with authenticated curator`);
        
        // Write results to a special auth test directory
        const baseDir = path.join(__dirname, 'outputs');
        const authTestDir = 'auth_test';
        const posts = rawPosts.map(post => (post.post.record as AppBskyFeedPost.Record).text);
        
        // Write both the feed sources and the posts
        if (selectedFeeds) {
            await writeFeedToFile(
                selectedFeeds.map(feed => `${feed[2]} (${feed[1]} from ${feed[0]})`),
                baseDir,
                authTestDir,
                'authenticated_feed_sources.txt'
            );
        }
        
        await writeFeedToFile(posts, baseDir, authTestDir, 'authenticated_raw_feed.txt');
        
        console.log('Authentication test completed successfully');
    } catch (error) {
        console.error('Error in authentication test:', error);
        throw error; // Re-throw to handle in main
    }
}

async function testPostSampling(feedSource: [string, string, string] = ['did:plc:4jb3re5tvklsvhuc3lkerj5q', 'aaak6p5s2f3cu', 'Academic Sky']) {
    console.log('\n=== Testing Post Sampling ===');
    
    const curator = new FeedCurator(
        'YaYRpfI7BiIX0yTac43qMjt0h2XugirD', 
        'https://api.deepinfra.com/v1/openai'
    );
    
    const feedSourceName = feedSource[2].replace(/\s+/g, '_').toLowerCase();
    const outputPath = path.join(__dirname, `posts_sample_${feedSourceName}.jsonl`);
    const targetPosts = 10000; // Adjust this number as needed
    
    try {
        await curator.fetchAndSavePosts(targetPosts, feedSource, outputPath);
        console.log('Successfully completed post sampling');
    } catch (error) {
        console.error('Error during post sampling:', error);
    }
}

// Modify the main function to include the auth test and sampling test
async function main() {
    console.log('Starting feed generation process at:', new Date().toISOString());
    
    // Add the sampling test at the beginning
    try {
        await testPostSampling(['did:plc:4jb3re5tvklsvhuc3lkerj5q', 'aaak6p5s2f3cu', 'Academic Sky']);
    } catch (error) {
        console.error('Post sampling test failed:', error);
    }

    try {
        await testPostSampling(['did:plc:abv47bjgzjgoh3yrygwoi36x', 'aaai4f7awwzkc', 'Writing Community']);
    } catch (error) {
        console.error('Post sampling test failed:', error);
    }

    try {
        await testPostSampling(['did:plc:3awqkacz33aitph7ojbzv24l', 'aaacg5mlmmibi', 'Crypto']);
    } catch (error) {
        console.error('Post sampling test failed:', error);
    }

    try {
        await testPostSampling(['did:plc:kkf4naxqmweop7dv4l2iqqf5', 'verified-news', 'Generic News']);
    } catch (error) {
        console.error('Post sampling test failed:', error);
    }

    try {
        await testPostSampling(['did:plc:cndfx4udwgvpjaakvxvh7wm5', 'flipboard-tech', 'Tech']);
    } catch (error) {
        console.error('Post sampling test failed:', error);
    }
    
    // First run the authentication test
    try {
        await testAuthenticatedFeedGetter();
    } catch (error) {
        console.error('Authentication test failed:', error);
        // Continue with other tests even if auth test fails
    }
    
    // Create the regular curator with public API for existing test cases
    const curator = new FeedCurator(
        'YaYRpfI7BiIX0yTac43qMjt0h2XugirD', 
        'https://api.deepinfra.com/v1/openai'
        // No auth credentials = uses public API
    );
    
    const baseDir = path.join(__dirname, 'outputs');
    
    // Test each profile with the public API curator
    for (const profile of testProfiles) {
        try {
            await testUserProfile(curator, profile, baseDir);
        } catch (error) {
            console.error(`Error testing profile ${profile.name}:`, error);
        }
    }

    // Test the hybrid user feed getting using historical data. There are post files postsX.jsonl where X is a number from 1–12.
    // const finalUser = testProfiles[2];
    // const postpaths = [path.join(__dirname, 'posts1.jsonl'), path.join(__dirname, 'posts2.jsonl'), path.join(__dirname, 'posts3.jsonl'), path.join(__dirname, 'posts4.jsonl'), path.join(__dirname, 'posts5.jsonl'), path.join(__dirname, 'posts6.jsonl'), path.join(__dirname, 'posts7.jsonl'), path.join(__dirname, 'posts8.jsonl'), path.join(__dirname, 'posts9.jsonl'), path.join(__dirname, 'posts10.jsonl'), path.join(__dirname, 'posts11.jsonl'), path.join(__dirname, 'posts12.jsonl')];
    // const groupDistilledFeed = await curator.getGroupDistilledFeedFromHistorical(
    //     finalUser.subscriptions,
    //     finalUser.personality,
    //     postpaths,
    //     1000,
    //     50,
    //     45,
    //     finalUser.languages
    // ); // DO EXPERIMENTS WITH 1b model to see if it adds value like the 8b. Also maybe finetuning to make it an expert.

    // console.log(groupDistilledFeed);
    // // write to file for inspection
    // await writeFeedToFile(groupDistilledFeed.finalFeed, baseDir, 'hybrid_user_feed_historical', 'hybrid_user_feed_historical.txt');

    console.log('\n=== All Tests Complete ===');
    console.log('Process completed at:', new Date().toISOString());
}

main().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
}); 