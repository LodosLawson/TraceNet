import axios from 'axios';
import { KeyManager } from './src/blockchain/crypto/KeyManager';

const BASE_URL = 'http://localhost:3000';

async function testAuthFlow() {
    console.log('=== Testing Auth Flow ===\n');

    try {
        // Test 1: Generate Keys
        console.log('1. Testing /api/auth/generate-keys...');
        const generateResponse = await axios.post(`${BASE_URL}/api/auth/generate-keys`);
        console.log('✓ Generated keys successfully');
        console.log('Public Key:', generateResponse.data.public_key);
        console.log('Private Key:', generateResponse.data.private_key.substring(0, 20) + '...\n');

        const { public_key, private_key } = generateResponse.data;

        // Test 2: Login with Signature
        console.log('2. Testing /api/auth/login...');
        const timestamp = Date.now();
        const signature = KeyManager.sign(timestamp.toString(), private_key);

        const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
            public_key,
            signature,
            timestamp
        });

        console.log('✓ Login successful');
        console.log('User ID:', loginResponse.data.user_id);
        console.log('Message:', loginResponse.data.message, '\n');

        // Test 3: Test Transaction with sender fields
        console.log('3. Checking Transaction model with sender fields...');
        const { TransactionModel, TransactionType } = await import('./src/blockchain/models/Transaction');

        const tx = TransactionModel.create(
            'wallet1',
            'wallet2',
            TransactionType.TRANSFER,
            100,
            1,
            {},
            public_key,
            signature
        );

        console.log('✓ Transaction created with sender public key and signature');
        console.log('TX ID:', tx.tx_id);
        console.log('Sender Public Key:', tx.sender_public_key?.substring(0, 20) + '...');
        console.log('Sender Signature:', tx.sender_signature?.substring(0, 20) + '...\n');

        console.log('=== All Tests Passed! ===');
    } catch (error: any) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Run tests if server is running
testAuthFlow().catch(console.error);
