
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const DATA_DIR = path.join(process.cwd(), 'data');
const FILES_TO_REMOVE = [
    'chain.json',
    'peers.json',
    'mempool.json',
    'chain-db' // LevelDB Directory
];

const RL = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => RL.question(query, resolve));
};

async function main() {
    console.log("⚠️  DANGER ZONE: TRACENET DATA RESET ⚠️");
    console.log("This will delete your local blockchain history to force a fresh sync.");
    console.log("Your wallet keys in 'secrets/' will be PRESERVED and SAFE.");
    console.log(`Target Directory: ${DATA_DIR}`);

    const answer = await askQuestion("Are you sure you want to reset your local data? (yes/NO): ");

    if (answer.toLowerCase() !== 'yes') {
        console.log("Aborted.");
        process.exit(0);
    }

    console.log("\n🗑️  Cleaning up data...");

    if (!fs.existsSync(DATA_DIR)) {
        console.log("No 'data' directory found. Nothing to clean.");
    } else {
        for (const file of FILES_TO_REMOVE) {
            const targetPath = path.join(DATA_DIR, file);
            if (fs.existsSync(targetPath)) {
                try {
                    const stats = fs.statSync(targetPath);
                    if (stats.isDirectory()) {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                        console.log(`✅ Deleted directory: ${file}`);
                    } else {
                        fs.unlinkSync(targetPath);
                        console.log(`✅ Deleted file: ${file}`);
                    }
                } catch (error: any) {
                    console.error(`❌ Failed to delete ${file}: ${error.message}`);
                    console.warn(`   (If the Node is running, please STOP it first!)`);
                }
            } else {
                // console.log(`   (Skipped ${file}, not found)`);
            }
        }
    }

    console.log("\n✨ Data reset complete.");
    console.log("👉 Now restart your node: 'npm start'");
    console.log("   It will connect to the Mainnet and sync from block 0.");

    process.exit(0);
}

main();
