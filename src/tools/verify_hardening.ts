
import { KeyStore } from '../blockchain/utils/KeyStore';
import { NETWORK_CONFIG as NET_CONFIG } from '../blockchain/config/NetworkConfig';
import path from 'path';
import fs from 'fs';

async function verifyHardening() {
    console.log('🛡️  Starting TraceNet Security & Hardening Verification...\n');

    // 1. Verify KeyStore
    console.log('1️⃣  Testing Encrypted KeyStore...');
    const keystore = new KeyStore('secrets/test_keystore.json');
    const testKey = 'test_private_key_12345';
    const password = 'strong-password';
    const alias = 'test_wallet';

    try {
        keystore.saveKey(alias, testKey, password);
        const loaded = keystore.loadKey(alias, password);
        const loadedWrongPass = keystore.loadKey(alias, 'wrong-password');

        if (loaded === testKey && loadedWrongPass === null) {
            console.log('✅ KeyStore works correctly: Encrypts and Decrypts with password.');
        } else {
            console.error('❌ KeyStore failed validation!');
            console.error(`Original: ${testKey}, Loaded: ${loaded}`);
        }

        // Cleanup
        if (fs.existsSync('secrets/test_keystore.json')) {
            fs.unlinkSync('secrets/test_keystore.json');
        }
    } catch (err) {
        console.error('❌ KeyStore threw error:', err);
    }

    // 2. Verify Config Settings
    console.log('\n2️⃣  Checking Network Configuration...');
    // We strictly check the file content or imports

    if (NET_CONFIG.MIN_PEERS === 3) {
        console.log('✅ MIN_PEERS is set to 3.');
    } else {
        console.error(`❌ MIN_PEERS is incorrect: ${NET_CONFIG.MIN_PEERS}`);
    }

    if (NET_CONFIG.GENESIS_VALIDATOR_PUBLIC_KEY) {
        console.log(`✅ Genesis Validator Public Key is present in config.`);
    }

    // 3. Verify Rate Limiter existence
    console.log('\n3️⃣  Checking Rate Limiter...');
    if (fs.existsSync(path.join(__dirname, '../src/middleware/RateLimiter.ts'))) {
        console.log('✅ RateLimiter.ts exists.');
    } else {
        console.error('❌ RateLimiter.ts missing!');
    }

    console.log('\n✅ Verification Complete.');
}

verifyHardening();
