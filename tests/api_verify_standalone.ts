
import express from 'express';
import { RPCServer } from '../src/node/RPCServer';
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { MessagePool } from '../src/node/MessagePool';
import { WalletService } from '../src/wallet/WalletService';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { InnerTransaction, TransactionType } from '../src/blockchain/models/Transaction';
import http from 'http';

// Mock Blockchain and dependencies
class MockBlockchain extends Blockchain {
    constructor() {
        super('SYSTEM', new ValidatorPool());
    }
    getAllAccounts() { return []; } // Always empty for now
}

async function runTest() {
    console.log('--- Starting API Verification ---');

    // Setup dependencies
    const validatorPool = new ValidatorPool();
    const blockchain = new MockBlockchain();
    const mempool = new Mempool();
    const messagePool = new MessagePool();
    const walletService = new WalletService('test-key');

    const port = 3001; // Test port
    const rpcServer = new RPCServer(
        blockchain,
        mempool,
        messagePool,
        walletService,
        validatorPool,
        port
    );

    const app = rpcServer['app']; // Access app
    const server = http.createServer(app);

    server.listen(port, async () => {
        console.log(`Test server running on port ${port}`);

        try {
            // TEST 1: Submit Message to Pool
            console.log('\n[Test 1] POST /api/messaging/pool');
            const keyPair = KeyManager.generateKeyPair();
            const innerTx: InnerTransaction = {
                type: TransactionType.PRIVATE_MESSAGE,
                from_wallet: keyPair.publicKey,
                to_wallet: 'recipient_wallet',
                amount: 1,
                payload: { content: 'hello' },
                timestamp: Date.now(),
                nonce: 1,
                signature: ''
            };

            const signableData = JSON.stringify({
                type: innerTx.type,
                from_wallet: innerTx.from_wallet,
                to_wallet: innerTx.to_wallet,
                amount: innerTx.amount,
                payload: innerTx.payload,
                timestamp: innerTx.timestamp,
                nonce: innerTx.nonce,
                max_wait_time: innerTx.max_wait_time
            });
            innerTx.signature = KeyManager.sign(signableData, keyPair.privateKey);

            const fetch = (await import('node-fetch')).default;

            const postRes = await fetch(`http://localhost:${port}/api/messaging/pool`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(innerTx)
            });

            const postData = await postRes.json();
            console.log('Response:', postData);

            if (postRes.status === 200 && postData.success === true) {
                console.log('✅ Passed: Message submitted successfully');
            } else {
                console.error('❌ Failed: Message submission failed');
                process.exit(1);
            }

            // TEST 2: Fetch Messages (Validator)
            console.log('\n[Test 2] GET /api/validator/messages');
            const getRes = await fetch(`http://localhost:${port}/api/validator/messages?limit=10`);
            const getData = await getRes.json();
            console.log('Response:', getData);

            if (getRes.status === 200 && getData.count > 0 && getData.messages[0].payload.content === 'hello') {
                console.log('✅ Passed: Message fetched successfully');
            } else {
                console.error('❌ Failed: Message fetch failed');
                process.exit(1);
            }

        } catch (err) {
            console.error('Test Error:', err);
        } finally {
            server.close();
        }
    });
}

runTest();
