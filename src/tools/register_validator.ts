import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { KeyStore } from '../blockchain/utils/KeyStore';
import readline from 'readline';

// Load environment variables
dotenv.config();

const RL = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => RL.question(query, resolve));
};

async function main() {
    console.log("🚀 TraceNet Validator Registration Tool");
    console.log("=======================================");

    // 1. Get Mainnet URL
    let mainnetUrl = process.env.BOOTSTRAP_NODES?.split(',')[0] || '';
    if (!mainnetUrl) {
        mainnetUrl = await askQuestion("Enter Mainnet URL (e.g., https://your-cloud-run-url.app): ");
    } else {
        console.log(`Using configured Bootstrap Node: ${mainnetUrl}`);
        const confirm = await askQuestion("Is this correct? (Y/n): ");
        if (confirm.toLowerCase() === 'n') {
            mainnetUrl = await askQuestion("Enter Mainnet URL: ");
        }
    }

    // Clean URL
    mainnetUrl = mainnetUrl.trim().replace(/\/$/, ''); // Remove trailing slash if any

    // 2. Load Local Identity (Public Key)
    let publicKey = '';
    let validatorId = '';
    let userId = ''; // Ideally derived or same as address

    console.log("\n🔑 Loading Local Identity...");

    // Try KeyStore first
    const keyStorePath = path.join(process.cwd(), 'secrets', 'keystore.json');
    if (fs.existsSync(keyStorePath)) {
        try {
            const password = process.env.KEYSTORE_PASSWORD || await askQuestion("Enter KeyStore Password: ");
            const keys = await KeyStore.load(password);

            // Prefer Validator Key if available, else Node Wallet
            if (keys.validatorKey) {
                console.log("✅ Found Validator Key in KeyStore.");
                publicKey = keys.validatorKey.publicKey;
                // Derive ID from public key (simplified)
                validatorId = `node_${publicKey.substring(0, 10)}`;
            } else if (keys.nodeWallet) {
                console.log("⚠️ No specific Validator Key found, using Node Wallet.");
                publicKey = keys.nodeWallet.publicKey;
                validatorId = `node_${publicKey.substring(0, 10)}`;
            }
        } catch (error) {
            console.error("❌ Failed to load KeyStore:", error);
        }
    }

    // Fallback to Env
    if (!publicKey && process.env.VALIDATOR_PUBLIC_KEY) {
        console.log("✅ Found VALIDATOR_PUBLIC_KEY in .env");
        publicKey = process.env.VALIDATOR_PUBLIC_KEY;
        validatorId = `node_${publicKey.substring(0, 10)}`;
    }

    if (!publicKey) {
        console.error("❌ Could not find a Public Key (Identity). Please ensure your node is set up.");
        process.exit(1);
    }

    // User ID is often the wallet address derived from public key, 
    // but for registration purposes, we can use the validator ID or ask.
    // For simplicity in this tool, we'll use a derived string.
    userId = validatorId;

    console.log(`\n📋 Registration Details:`);
    console.log(`   Target:       ${mainnetUrl}`);
    console.log(`   Validator ID: ${validatorId}`);
    console.log(`   Public Key:   ${publicKey.substring(0, 20)}...`);

    const proceed = await askQuestion("\nProceed with registration? (Y/n): ");
    if (proceed.toLowerCase() === 'n') process.exit(0);

    // 3. Register
    try {
        console.log("\n☁️  Sending Registration Request...");
        const registerRes = await axios.post(`${mainnetUrl}/api/validator/register`, {
            validator_id: validatorId,
            user_id: userId,
            public_key: publicKey
        });

        if (registerRes.data.success) {
            console.log("✅ Registration Successful!");
        } else {
            console.error("❌ Registration Failed:", registerRes.data);
            process.exit(1);
        }

        // 4. Heartbeat
        console.log("\n💓 Sending Initial Heartbeat...");
        const heartbeatRes = await axios.post(`${mainnetUrl}/api/validator/heartbeat`, {
            validator_id: validatorId
        });

        if (heartbeatRes.data.success) {
            console.log("✅ Heartbeat Accepted! You are now ONLINE.");
        } else {
            console.warn("⚠️ Heartbeat failed:", heartbeatRes.data);
        }

        console.log("\n🎉 DONE! Your node is now a recognized validator on the network.");
        console.log("Keep your local node running to produce blocks when it's your turn.");

    } catch (error: any) {
        console.error("\n❌ Error connecting to Mainnet:");
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`   ${error.message}`);
        }
    }

    RL.close();
}

main();
