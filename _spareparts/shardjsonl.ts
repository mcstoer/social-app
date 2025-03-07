import * as fs from 'fs';
import * as readline from 'readline';
import path from 'path';

async function shardJsonl(
    inputPath: string, 
    outputDir: string, 
    numShards: number
): Promise<void> {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create write streams for all shards
    const writeStreams = Array.from({ length: numShards }, (_, i) => {
        const outputPath = path.join(outputDir, `shard_${String(i).padStart(5, '0')}.jsonl`);
        return fs.createWriteStream(outputPath);
    });

    // Create line reader interface
    const fileStream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;

    // Process file line by line
    for await (const line of rl) {
        if (line.trim()) {  // Skip empty lines
            const shardIndex = lineCount % numShards;
            writeStreams[shardIndex].write(line + '\n');
            lineCount++;
        }
    }

    // Close all write streams
    await Promise.all(writeStreams.map(stream => 
        new Promise<void>((resolve, reject) => {
            stream.end((err: any) => {
                if (err) reject(err);
                else resolve();
            });
        })
    ));

    console.log(`Processed ${lineCount} lines into ${numShards} shards`);
}

// Example usage
const inputFile = 'posts_dir_2/shard_00000.jsonl';
const outputDirectory = 'posts_dir_3_verysmallinspectionshards';
const numberOfShards = 100;

shardJsonl(inputFile, outputDirectory, numberOfShards)
    .catch(error => console.error('Error:', error));