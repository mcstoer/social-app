import { BskyAgent } from '@atproto/api';
import OpenAI from 'openai';
import { AppBskyFeedPost } from '@atproto/api';
import { FeedCurator } from './feed_getter';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { promises as fsPromises } from 'fs';
import { HistoricalPost, UserProfile } from './types';
import { readFileSync } from 'fs';
import { Table, tableFromIPC } from 'apache-arrow';
import { createReadStream } from 'fs';
import { RecordBatchStreamReader } from 'apache-arrow';


const baseDir = path.join(__dirname, 'outputs');
const NUM_USERS_TO_MAKE_FEEDS_FOR = 100;
const NUM_POSTS_PER_FEED_RAW_MATERIALS = 2000;
const TARGET_NUM_POSTS_PER_FEED = 100;
const POSTS_PER_GROUP = 50;
const TOTAL_DATASET_SAMPLE_SIZE = 1000


// // Types for test organization
// interface UserProfile {
//     name: string;
//     subscriptions: Array<{user_handle: string, user_bio: string}>;
//     personality: string;
//     languages?: string;
// }

// interface HistoricalPost {
//     text: string;
//     created_at: string;
//     author: string;  // did:plc:format
//     uri: string;
//     has_images: boolean;
//     reply_to?: string|null;
//     // ... any other fields
// }

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

async function getProfileForPost(post: HistoricalPost, bskyAgent: BskyAgent) {
    try {
        const profile = await bskyAgent.getProfile({actor: post.author});
        const {handle, displayName, description} = profile.data;
        return {handle, displayName, description};
    } catch (error) {
        console.error(`Error getting profile for post ${post.author}:`, error);
        return null;
    }
}

// NOTE subscriptions will not be shown during feed generation/distillation, they will impplicitly be part of the signal due to the personality in real use cases, but during datagen we can't get real follows that match the fake personality, so we ignore follows during training, and therefore we ignore them during inference too because the model won't be able to use them.

async function createUserForDatagen(openai: OpenAI, subjects: string[], 
//     rawMaterials: {
//     text: string,
//     created_id: string,
//     author: string,
//     uri: string,
//     has_entity: boolean,
//     reply?: string|null,
// }[],
    totalDataset: Table<any>,
    bskyAgent: BskyAgent
) {
    // Randomly pick 1-5 subjects from the subjects list
    // from any place in the list, not just the first 5
    
    const selectedSubjects = subjects
        .sort(() => Math.random() - 0.5) // Shuffle array
        .slice(0, Math.floor(Math.random() * 4) + 1); // Take 1-5 random subjects


    // Use AI to generate a personality based on these subjects

    // 2/3 chance to use a few-shot prompt
    // 1/3 chance to use a 0-shot prompt + higher temperature

    const subjectPrompt = `Subjects: ${selectedSubjects.join(', ')}`;
    const systemPrompt = `You are an expert personality creator. You are given a list of subjects. You are to create a personality for a fictitious user based on these subjects and raw materials. The personality should be a short description of the user's interests and preferences. The personality should be a list that describes a variety of interests that the user has, some broad, and some specific. This will eventually be used to train an LLM to suggest good, relevant feeds for real users, so try to do a good job

The interests that are not in the subjects list (your input) may be considered to be outside the user's interests, or even the subject of active dislike, which can be mentioned in the personality (but does not have to be).

Write your personality in <personality>...</personality> tags so it can be extracted by code, separate from any reasoning or comments you add.`;

    let personalityString = undefined;
    if (Math.random() < 2/3) {
        personalityString = await openai.chat.completions.create({
            model: 'meta-llama/Meta-Llama-3-70B-Instruct',
            // baseURL: 'https://api.deepinfra.com/v1/openai', // THis is part of the openai object, not the request
            messages: [{
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: `Young adult novels, writing, Yemen crisis`
            },
            {
                role: 'assistant',
                content: `<personality>
* Is an established writer of young adult novels, currently working on three books and has published 7 others.
* Favors fantasy, action, and romance.
* Favorite book series is Harry Potter; engages with accounts related to or also interested in the series.
* Engages with other writers and the writing community a lot.
* Follows other authors from a variety of genres.
* Frequently shares striking quotes from people or books.
* Interested in international organizations humanitarian causes
* Interested, specifically, in the Yemen crisis (and news about it shared by humanitarian organizations)
* Shares and enjoys inspirational quotes, specifically.</personality>`
            },
            {
                role: 'user',
                content: `Deep tech`
            },
            {
                role: 'assistant',
                content: `<personality>
* Is a founder of a deeptech AI startup.
* Only interested in heavy technical stuff.
* Hates current events and politics.</personality>`
            },
            {
                role: 'user',
                content: subjectPrompt // NOTE in the future I may want to add follows (derived from the raw materials) here. However for now the subject selection is about what the user is interacting with, so I don't think it's necessary, strictly speaking. I follow people I don't interact with. The model has to be able to know that.
            }],
            max_tokens: 2000,
            temperature: 0.4,
            top_p: 0.9
        });
    } else {
        personalityString = await openai.chat.completions.create({
            model: 'meta-llama/Meta-Llama-3-70B-Instruct',
            // baseURL: 'https://api.deepinfra.com/v1/openai',
            messages: [{role: 'system', content: systemPrompt}, {role: 'user', content: subjectPrompt}],
            max_tokens: 2000,
            temperature: 0.9,
            top_p: 0.9
        });
    }
    personalityString = personalityString.choices[0].message.content;

    // Write the personality prompt + output to a file
    const personalityOutputDir = path.join(baseDir, 'personalities');
    if (!fs.existsSync(personalityOutputDir)) {
        fs.mkdirSync(personalityOutputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const firstFewChars = (personalityString as string).slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    const personalityOutputPath = path.join(personalityOutputDir, `personality_${firstFewChars}_${timestamp}.txt`);
    await fsPromises.writeFile(personalityOutputPath, personalityString as string);
    console.log(`Wrote personality to ${personalityOutputPath}`);
    
    // Try to extract actual output from XML tags: <personality>...</personality>
    const personalityRegex = /<personality>(.*?)<\/personality>/s;
    const personalityMatch = personalityString?.match(personalityRegex);
    if (personalityMatch) {
        personalityString = personalityMatch[1].trim();
    }
    // follow selection TODO probably remove this follows will be implicitly part of the personality
    
    // 1/3 chance to get follows from raw materials
    // 1/2 chance to get random follows from the total dataset
    // 1/6 chance to get no follows

    // if follows are being gotten, we choose between 1 and 10
    const diceroll = Math.random();
    // let follows = [];
    // let followsPosts: HistoricalPost[] = [];
    // if (diceroll < 1/3) {
    //     followsPosts = rawMaterials.slice(0, Math.floor(Math.random() * 10) + 1);
    // } 
    // if (diceroll < 5/6 && diceroll > 1/3) {
    //     // Get random number of follows between 1 and 10
    //     const numFollows = Math.floor(Math.random() * 10) + 1;
    //     // Generate random indices
    //     const indices = new Set<number>();
    //     while (indices.size < numFollows) {
    //         indices.add(Math.floor(Math.random() * totalDataset.numRows));
    //     }
    //     // Convert indices to array and sort them
    //     const indicesArray = Array.from(indices).sort();
    //     // Get the rows at those indices
    //     followsPosts = indicesArray.map(idx => ({
    //         text: totalDataset.get(idx)?.text as string,
    //         created_id: totalDataset.get(idx)?.created_id as string,
    //         author: totalDataset.get(idx)?.author as string,
    //         uri: totalDataset.get(idx)?.uri as string,
    //         has_entity: totalDataset.get(idx)?.has_entity as boolean,
    //         reply: totalDataset.get(idx)?.reply as string | null
    //     }));
    // }
    
    // for (const post of followsPosts) {
    //     const follow = await getProfileForPost(post, bskyAgent);
    //     if (follow) {
    //         follows.push(follow);
    //     }
    // }

    // Deduplicate follows
    // follows = [...new Set(follows)];

    // Randomly pick languages.
    // While not halted
    // 8/10 chance to pick english and halt
    // 1/10 to pick another language from the list of languages that has not been picked yet, and halt
    // 1/10 to pick another language from the list of languages that has not been picked yet, and continue
    // max 5 languages

    const languages = [ // [language name, language code] code in ISO 639-1
        ['English', 'en'], ['Spanish', 'es'], ['French', 'fr'], ['German', 'de'], ['Italian', 'it'], ['Portuguese', 'pt'], ['Russian', 'ru'], ['Chinese', 'zh'], ['Japanese', 'ja'], ['Korean', 'ko'],
        ['Arabic', 'ar'], ['Hindi', 'hi'], ['Turkish', 'tr'], ['Indonesian', 'id'], ['Thai', 'th'], ['Vietnamese', 'vi'], ['Polish', 'pl'], ['Dutch', 'nl'], ['Swedish', 'sv'], ['Hebrew', 'he']
    ];
    let languagesChosen = [];
    while (languagesChosen.length < 5) {
        const diceroll = Math.random();
        if (diceroll < 8/10) {
            languagesChosen.push('English');
            break;
        } else if (diceroll < 9/10) {
            languagesChosen.push(languages[Math.floor(Math.random() * languages.length)]);
            break;
        } else {
            languagesChosen.push(languages[Math.floor(Math.random() * languages.length)]);
        }
    }
    // randomly use either comma separated or space separated or newline separated or comma + 'and' separated
    let languagesChosenString = '';
    if (Math.random() < 1/4) {
        languagesChosenString = languagesChosen.join(', ');
    } else if (Math.random() < 1/2) {
        languagesChosenString = languagesChosen.join(' ');
    } else if (Math.random() < 3/4) {
        languagesChosenString = languagesChosen.join('\n');
    } else {
        // same as first item except the last item is 'and' + the last item
        languagesChosenString = languagesChosen.slice(0, -1).join(', ') + ', and ' + languagesChosen[languagesChosen.length - 1];
    }

    // To get the user name, pick a random post from the total dataset and use the author's handle that IS NOT one of the follows
    // const followHandles = new Set(follows.map(sub => sub.handle));
    let userName = '';
    let attempts = 0;
    // const maxAttempts = 10;
    // while (attempts < maxAttempts) {
    //     const row = totalDataset.get(Math.floor(Math.random() * totalDataset.numRows));
    //     if (!row) continue;
    //     const userDID = row.author;
    //     const userProfile = await bskyAgent.getProfile({actor: userDID});
    //     if (!followHandles.has(userProfile.data.handle)) {
    //         userName = userProfile.data.handle;
    //         break;
    //     } else if (attempts === maxAttempts - 1) {
    //         // remove the follow which is the same as the current userName and use the userprofile handle
    //         userName = userProfile.data.handle;
    //         follows = follows.filter(follow => follow.handle !== userName);
    //         break;
    //     }
    //     attempts++;
    // }
    const row = totalDataset.get(Math.floor(Math.random() * totalDataset.numRows));
    if (!row) {
        throw new Error('No row found');
    }
    const userProfile = await bskyAgent.getProfile({actor: row.author});
    userName = userProfile.data.handle; // username = random post author handle

    // Return the user profile
    return {
        name: userName,
        subscriptions: [],
        // follows.map(follow => ({
        //     user_handle: follow.handle,
        //     user_bio: follow.description || ''
        // })),
        personality: personalityString as string,
        languages: languagesChosenString,
        langaugeCodes: languagesChosen.map(lang => lang[1])
    };
}

// NOTE will NOT want to overfit here, we're doing a task finetune, not factual finetune. 

// subjects.jsonl is a list of subjects, one per line, in the format: {"subject": "subject"}
async function loadSubjectsFromJsonl(filepath: string) {
    const fileStream = fs.createReadStream(filepath, 'utf8');
    const rl = readline.createInterface({input: fileStream, crlfDelay: Infinity});
    const subjects = [];
    for await (const line of rl) {
        subjects.push(JSON.parse(line).subject);
    }
    return subjects;
}

async function readArrowDataset(filepath: string) {
    const stream = createReadStream(filepath);
    const reader = await RecordBatchStreamReader.from(stream);
    
    // Read all batches into a single table
    const batches = [];
    for await (const batch of reader) {
        batches.push(batch);
    }
    
    // Create table from batches
    if (batches.length === 0) {
        stream.destroy();
        return new Table([]);  // Empty table with no columns
    }

    const table = new Table(batches[0].schema, batches);
    
    // Cleanup
    stream.destroy();
    return table;
}


// Modify the main function to use the new dataset class
async function main() {
    console.log('Starting feed generation process at:', new Date().toISOString());
    
    console.log('Creating curator with public API for existing test cases');
    // Create the regular curator with public API for existing test cases
    const curator = new FeedCurator(
        'YaYRpfI7BiIX0yTac43qMjt0h2XugirD', 
        'https://api.deepinfra.com/v1/openai'
        // No auth credentials = uses public API
    );
    

    // load subjects from the jsonl file
    console.log('Loading subjects from jsonl file');
    const subjects = await loadSubjectsFromJsonl(path.join(__dirname, 'subjects.jsonl'));
    console.log('Loaded subjects');
    const openai = new OpenAI({
        baseURL: 'https://api.deepinfra.com/v1/openai',
        apiKey: 'YaYRpfI7BiIX0yTac43qMjt0h2XugirD'
    });
    console.log("Reading arrow dataset")
    console.log("creating dataset")
    const dataset = await readArrowDataset(path.join(__dirname, 'data', 'posts.arrow'));
    console.log("dataset created with", dataset.numRows, "rows")

    console.log("creating bsky agent")
    const bskyAgent = new BskyAgent({
        service: 'https://public.api.bsky.app'
    });
    console.log("bsky agent created")
    for (let i = 0; i < NUM_USERS_TO_MAKE_FEEDS_FOR; i++) {
        try {
            // Modify the raw materials fetching to use streaming


            // NOTE selecting from specific feed sources based on user personality happens IN A DIFFERENT RAW MATERIALS FUNCTION
            // so do it inside createuserfordatagen

            // get the raw materials

            console.log("getting sample posts")
            // Get a random sample for the user creation
            // const samplePosts = await dataset.getRandomSamples(TOTAL_DATASET_SAMPLE_SIZE); // Adjust sample size as needed
            console.log("sample posts fetched")
            console.log("creating user")
            const user = await createUserForDatagen(
                openai, 
                subjects, 
                // rawMaterials, 
                dataset,  // Replace totalDataset with sample
                bskyAgent
            );
            console.log("user created")
            // TODO maybe save the user to a unique file for record keeping
            const timestamp = new Date().toISOString();
            await writeUserToFile(user, baseDir, 'users', `${user.name}_${timestamp}.txt`);
            console.log(`Wrote user ${user.name} to file ${user.name}_${timestamp}.txt`);
            
            let usingLiveData = false;
            // 1/3 chance to use live data queried from bsky which will be separated by feed source and therefore way more relevant to the user's interests
            if (Math.random() < 1/3) {
                usingLiveData = true;
            }


            if (!usingLiveData) {
                console.log("getting raw materials")
                const rawMaterialsStartTime = Date.now();
                const rawMaterials = await curator.getRawMaterialsFromHistoricalData(
                    dataset,  // You'll need to modify FeedCurator to accept ArrowDataset
                    NUM_POSTS_PER_FEED_RAW_MATERIALS
                );
                console.log(`raw materials fetched in ${Date.now() - rawMaterialsStartTime}ms`)

                // Use the user as an input to distil feeds
                const distilledFeed = await curator.getGroupDistilledFeedFromHistoricalForDatagen(
                    user.subscriptions,
                    user.personality,
                    POSTS_PER_GROUP,
                    TARGET_NUM_POSTS_PER_FEED,
                    rawMaterials.map(post => ({ // totaldataset
                        text: post.text,
                        created_id: post.created_id,
                        author: post.author,
                        uri: post.uri,
                        has_entity: post.has_entity,
                        reply: post.reply || null
                    })),
                    user.languages
                );
                } else {
                        // First, query the feed sources
                        console.log("USING LIVE DATA")
                        console.log("getting raw materials from live data")
                        const rawMaterialsStartTime = Date.now();
                        const rawMaterials = await curator.getRawMaterialsFromLiveData(
                            // user.subscriptions,
                            [],
                            user.personality,
                            NUM_POSTS_PER_FEED_RAW_MATERIALS
                        );
                        console.log(`raw materials fetched in ${Date.now() - rawMaterialsStartTime}ms`)
                        const distilledFeed = await curator.getGroupDistilledFeedFromHistoricalForDatagen(
                            user.subscriptions,
                            user.personality,
                            POSTS_PER_GROUP,
                            TARGET_NUM_POSTS_PER_FEED,
                            rawMaterials.map(post => ({ // totaldataset
                                text: post.text,
                                created_id: post.created_id,
                                author: post.author,
                                uri: post.uri,
                                has_entity: post.has_entity,
                                reply: post.reply || null
                            })),
                            user.languages
                        );
            }
        } catch (error) {
            console.error(`Error distilling feed for user`, error);
        }
    }

    try {
        console.log('\n=== All Tests Complete ===');
        console.log('Process completed at:', new Date().toISOString());
    } catch (error) {
        console.error('Error in main process:', error);
        throw error;
    }
}

async function writeUserToFile(user: UserProfile, baseDir: string, subDir: string, filename: string) {
    const outputDir = ensureOutputDir(baseDir, subDir);
    const filepath = path.join(outputDir, filename);
    const timestamp = new Date().toISOString();
    const content = `User generated at: ${timestamp}\n\n` + 
        `Name: ${user.name}\n` +
        `Personality: ${user.personality}\n` +
        `Languages: ${user.languages || 'None specified'}\n\n` +
        `Subscriptions:\n${user.subscriptions.map(sub => 
            `- ${sub.user_handle}: ${sub.user_bio}`
        ).join('\n')}`;

    await fs.promises.writeFile(filepath, content);
    console.log(`Wrote user to ${filepath}`);
}

main().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
}); 

// NOTE method of improvement: since we have reduction % percentage, after a distillation round, we can multiply the number of posts left by the reduction percentage to estimate the number of posts left after the next round. If this is less than the target number of posts, we can stop right now, since we'll probably undershoot the target by a lot otherwise.