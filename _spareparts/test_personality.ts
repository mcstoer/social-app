import { PersonalityOverseer } from './personality_overseer';
import * as fs from 'fs';
import * as path from 'path';

// Types for test organization
interface TestUser {
    name: string;
    existing_personality: string;
    user_handle: string;
    input_data: {
        recent_follows?: Array<{
            followed_bio: string;
            followed_handle: string;
            followed_recent_posts?: Array<{
                post_text: string;
                post_url: string;
            }>;
        }>;
        likes?: Array<{
            liked_post_text: string;
            liked_post_author_handle: string;
        }>;
        clickthroughs?: Array<{
            clicked_post_text: string;
            clicked_post_url: string;
            clicked_post_author_handle: string;
        }>;
        recent_posts?: Array<{
            content: string;
            media_attachments: string[];
            timestamp: string;
            language: string;
        }>;
        replies?: Array<{
            content: string;
            media_attachments: string[];
            timestamp: string;
            language: string;
            replied_to_handle: string;
            replied_to_text: string;
        }>;
        blocks?: Array<{
            block_timestamp: string;
            blocked_handle: string;
            blocked_bio: string;
            blocked_recent_posts: Array<{
                content: string;
                media_attachments: string[];
                timestamp: string;
                language: string;
            }>;
        }>;
    };
}

// Helper function to ensure output directory exists
function ensureOutputDir(baseDir: string, subDir?: string): string {
    const outputPath = subDir ? path.join(baseDir, subDir) : baseDir;
    if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
    }
    return outputPath;
}

// TODO consider adding specific bullets for 

// Helper function to write personality to file
async function writePersonalityToFile(
    personality: string,
    baseDir: string,
    subDir: string,
    filename: string
) {
    const outputDir = ensureOutputDir(baseDir, subDir);
    const filepath = path.join(outputDir, filename);
    const timestamp = new Date().toISOString();
    const content = `Personality generated at: ${timestamp}\n\n${personality}`;

    await fs.promises.writeFile(filepath, content);
    console.log(`Wrote personality to ${filepath}`);
}

// Helper function to write input data for reference
async function writeInputData(
    inputData: TestUser['input_data'],
    baseDir: string,
    subDir: string
) {
    const outputDir = ensureOutputDir(baseDir, subDir);
    const filepath = path.join(outputDir, 'input_data.json');
    await fs.promises.writeFile(
        filepath,
        JSON.stringify(inputData, null, 2)
    );
}

// Test function for a single user
async function testUserPersonality(
    overseer: PersonalityOverseer,
    user: TestUser,
    baseDir: string
) {
    console.log(`\n=== Testing personality generation for ${user.name} ===`);
    const subDir = user.name.toLowerCase().replace(/\s+/g, '_');

    // Write initial personality
    await writePersonalityToFile(
        user.existing_personality,
        baseDir,
        subDir,
        'initial_personality.txt'
    );

    // Write input data for reference
    await writeInputData(user.input_data, baseDir, subDir);

    // Generate updated personality
    console.log('\nGenerating updated personality...');
    try {
        const updatedPersonality = await overseer.updatePersonalityWithLLM({
            ...user.input_data,
            existing_personality: user.existing_personality,
            user_handle: user.user_handle
        });

        // Write updated personality
        await writePersonalityToFile(
            updatedPersonality,
            baseDir,
            subDir,
            'updated_personality.txt'
        );

        return updatedPersonality;
    } catch (error) {
        console.error(`Error generating personality for ${user.name}:`, error);
        throw error;
    }
}

async function testAuthenticatedPersonality() {
    console.log('\n=== Testing Authenticated Personality Generation ===');
    
    const overseer = new PersonalityOverseer(
        'YaYRpfI7BiIX0yTac43qMjt0h2XugirD', 
        'https://api.deepinfra.com/v1/openai',
        'meta-llama/Llama-3.2-1B-Instruct',
        {
            identifier: 'e-p-armstrong.bsky.social',
            password: 'pHnvqcBQitYPS98'
        },
        true,  // use LLM for summarizing
        true,  // query information
        ["followedFeeds"]  // what to query
    );

    try {
        // Wait for authentication to complete
        console.log('Waiting for authentication...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Ensure we're authenticated
        const isReady = await overseer['ensureAgentReady']();
        if (!isReady) {
            console.log('Failed to authenticate with Bluesky');
            return null;
        }
        console.log('Successfully authenticated with Bluesky');

        // First test followed feeds specifically
        console.log('\nTesting followed feeds query...');
        const followedFeeds = await overseer['queryFollowedFeeds']();
        if (followedFeeds) {
            console.log(`Found ${followedFeeds.length} followed feeds:`);
            followedFeeds.forEach(feed => {
                console.log(`- ${feed.displayName} (${feed.generator})`);
            });
        } else {
            console.log('No followed feeds found');
        }

        const stringifiedFeeds = overseer['stringifyFollowedFeeds'](followedFeeds);
        console.log('\nStringified feeds format:');
        console.log(stringifiedFeeds);

        // Test with minimal subscriptions to focus on authenticated data
        const testSubscriptions = [
            { 
                user_handle: '@e-p-armstrong.bsky.social',
                user_bio: 'Test user for authenticated personality generation'
            }
        ];

        console.log('\nGenerating personality with authenticated user data...');
        const personality = await overseer.updatePersonalityWithLLM(testSubscriptions);
        
        // Save the results
        const outputDir = path.join(__dirname, 'outputs', 'personality_tests');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, 'authenticated_personality.txt');
        const output = `Authenticated Personality Test Results
Generated at: ${new Date().toISOString()}

Followed Feeds:
${stringifiedFeeds}

Generated Personality:
${personality}`;

        await fs.promises.writeFile(outputPath, output);
        console.log(`Authenticated personality test results written to ${outputPath}`);
        
        return personality;
    } catch (error) {
        console.error('Error in authenticated personality test:', error);
        throw error;
    }
}

// Define test users
const testUsers: TestUser[] = [
    {
        name: "Well Defined Tech User",
        user_handle: "@techie.bsky.social",
        existing_personality: `* Passionate about software development and system architecture
* Regularly contributes to open source projects
* Interested in AI and machine learning
* Values clean code and good documentation
* Enjoys mentoring junior developers
* Active in tech community discussions`,
        input_data: {
            recent_follows: [
                {
                    followed_handle: "@ai_researcher",
                    followed_bio: "AI/ML researcher at DeepMind. Working on LLMs.",
                    followed_recent_posts: [
                        {
                            post_text: "Just published our latest paper on transformer architecture improvements",
                            post_url: "example.com/post1"
                        }
                    ]
                }
            ],
            likes: [
                {
                    liked_post_text: "Here's my guide to implementing CUDA kernels efficiently",
                    liked_post_author_handle: "@gpu_expert"
                }
            ],
            recent_posts: [
                {
                    content: "Just contributed a major performance improvement to tensorflow!",
                    media_attachments: ["graph.png"],
                    timestamp: "2024-03-20T10:00:00Z",
                    language: "en"
                }
            ]
        }
    },
    {
        name: "Minimal User",
        user_handle: "@newuser.bsky.social",
        existing_personality: "",
        input_data: {
            recent_follows: [
                {
                    followed_handle: "@news_daily",
                    followed_bio: "Breaking news and updates",
                    followed_recent_posts: []
                }
            ]
        }
    },
    {
        name: "Multi Interest User",
        user_handle: "@diverse.bsky.social",
        existing_personality: `* Photography enthusiast focusing on street photography
* Amateur chef specializing in Asian fusion
* Tech-savvy cryptocurrency investor
* Enjoys indie game development as a hobby
* Regular participant in local art exhibitions`,
        input_data: {
            recent_follows: [
                {
                    followed_handle: "@photo_tips",
                    followed_bio: "Professional photographer sharing daily tips",
                    followed_recent_posts: [
                        {
                            post_text: "Understanding composition: Rule of thirds explained",
                            post_url: "example.com/photo-tips"
                        }
                    ]
                }
            ],
            likes: [
                {
                    liked_post_text: "New crypto trading platform launched with zero fees!",
                    liked_post_author_handle: "@crypto_news"
                },
                {
                    liked_post_text: "Recipe: Fusion sushi rolls with a Korean twist",
                    liked_post_author_handle: "@chef_kim"
                }
            ],
            replies: [
                {
                    content: "Love the lighting in this shot! What camera settings did you use?",
                    media_attachments: [],
                    timestamp: "2024-03-20T15:30:00Z",
                    language: "en",
                    replied_to_handle: "@photo_master",
                    replied_to_text: "Golden hour street photography #PhotoOfTheDay"
                }
            ]
        }
    }
];

async function main() {
    console.log('Starting personality generation tests at:', new Date().toISOString());
    
    try {
        // First run the authenticated test
        const authPersonality = await testAuthenticatedPersonality();
        console.log('\nAuthenticated Personality Result:', authPersonality);

        // Then run the existing tests with a non-authenticated overseer
        const overseer = new PersonalityOverseer(
            'YaYRpfI7BiIX0yTac43qMjt0h2XugirD',
            'https://api.deepinfra.com/v1/openai',
            'meta-llama/Llama-3.2-1B-Instruct'  // No auth credentials = public API
        );
        
        const baseDir = path.join(__dirname, 'personality_outputs');
        
        // Test each user
        for (const user of testUsers) {
            try {
                await testUserPersonality(overseer, user, baseDir);
            } catch (error) {
                console.error(`Error testing user ${user.name}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
});


// synthetic engagement information and other stuff, for the backtesting.

// for backtesting, assume that they are subscribed t ocertain feeds to get raw materials
// OR distil over the millions of posts in the dataset to get the raw materials