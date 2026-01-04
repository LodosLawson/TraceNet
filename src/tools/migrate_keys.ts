
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { KeyStore } from '../blockchain/utils/KeyStore';

dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const KEYSTORE_PATH = path.join(process.cwd(), 'secrets', 'keystore.json');

async function migrate() {
    console.log('🔐 TraceNet Key Migration Utility');
    console.log('-----------------------------------');

    // Check if keystore already exists
    if (fs.existsSync(KEYSTORE_PATH)) {
        console.log('⚠️  Keystore already exists at:', KEYSTORE_PATH);
        const proceed = await ask('Do you want to append/overwrite? (y/N): ');
        if (proceed.toLowerCase() !== 'y') {
            console.log('Migration cancelled.');
            process.exit(0);
        }
    }

    // Get keys from env
    const validatorKey = process.env.VALIDATOR_PRIVATE_KEY;
    const walletKey = process.env.NODE_WALLET_PRIVATE_KEY;

    if (!validatorKey && !walletKey) {
        console.error('❌ No private keys found in .env (VALIDATOR_PRIVATE_KEY or NODE_WALLET_PRIVATE_KEY missing).');
        process.exit(1);
    }

    console.log(`\nFound keys to migrate:`);
    if (validatorKey) console.log(' - VALIDATOR_PRIVATE_KEY');
    if (walletKey) console.log(' - NODE_WALLET_PRIVATE_KEY');

    // Ask for password
    console.log('\nCreate a strong password for your new KeyStore.');
    const password = await ask('Enter KeyStore Password: ');

    if (password.length < 8) {
        console.error('❌ Password too short (min 8 chars).');
        process.exit(1);
    }

    try {
        // Create keystore logic
        // We need to initialize KeyStore, save keys, and write file.
        // Since KeyStore checks process.env.KEYSTORE_PASSWORD, we might need to set it or pass it if constructor allowed.
        // Current KeyStore implementation relies on env OR constructor? checking...
        // KeyStore constructor usually takes file path.

        // We will manually use the KeyStore class logic or just instantiate it if modified to accept password.
        // Let's check KeyStore implementation specifically. 
        // Assuming strict env usage in production, we can set env temporarily.
        process.env.KEYSTORE_PASSWORD = password;

        const keyStore = new KeyStore();

        // Save Keys
        if (validatorKey) {
            await keyStore.saveKey('validator_key', validatorKey, password);
            console.log('✅ Validator Key saved.');
        }

        if (walletKey) {
            await keyStore.saveKey('node_wallet_key', walletKey, password);
            console.log('✅ Node Wallet Key saved.');
        }

        console.log(`\n🎉 Migration Complete!`);
        console.log(`KeyStore saved to: ${KEYSTORE_PATH}`);
        console.log(`\n⚠️  ACTION REQUIRED:`);
        console.log(`1. Delete VALIDATOR_PRIVATE_KEY and NODE_WALLET_PRIVATE_KEY from your .env file.`);
        console.log(`2. Ensure KEYSTORE_PASSWORD is set in your environment (or entered at startup).`);

    } catch (err: any) {
        console.error('❌ Migration failed:', err.message);
    }

    process.exit(0);
}

function ask(question: string): Promise<string> {
    return new Promise(resolve => rl.question(question, resolve));
}

migrate();
