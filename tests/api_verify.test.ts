import express from 'express';
import request from 'supertest';
import { RPCServer } from '../src/node/RPCServer';
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { MessagePool } from '../src/node/MessagePool';
import { WalletService } from '../src/wallet/WalletService';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { InnerTransaction, TransactionType } from '../src/blockchain/models/Transaction';

// Mock dependencies
jest.mock('../src/blockchain/core/Blockchain');
jest.mock('../src/node/Mempool');
jest.mock('../src/wallet/WalletService');
jest.mock('../src/consensus/ValidatorPool');

describe('Message Pool API', () => {
    let app: express.Application;
    let rpcServer: RPCServer;
    let blockchain: Blockchain;
    let mempool: Mempool;
    let messagePool: MessagePool;
    let walletService: WalletService;
    let validatorPool: ValidatorPool;

    beforeAll(() => {
        blockchain = new Blockchain('SYSTEM', new ValidatorPool());
        mempool = new Mempool();
        messagePool = new MessagePool();
        walletService = new WalletService('test-key');
        validatorPool = new ValidatorPool();

        // Mock getAllAccounts for nonce check
        (blockchain.getAllAccounts as jest.Mock).mockReturnValue([]);

        rpcServer = new RPCServer(
            blockchain,
            mempool,
            messagePool,
            walletService,
            validatorPool,
            3000
        );
        app = rpcServer['app']; // Access private app for testing
    });

    test('POST /api/messaging/pool - Submit valid message', async () => {
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

        // Sign the message
        const signableData = JSON.stringify({
            type: innerTx.type,
            from_wallet: innerTx.from_wallet,
            to_wallet: innerTx.to_wallet,
            amount: innerTx.amount,
            payload: innerTx.payload,
            timestamp: innerTx.timestamp,
            nonce: innerTx.nonce,
            max_wait_time: undefined
        });
        innerTx.signature = KeyManager.sign(signableData, keyPair.privateKey);

        const response = await request(app)
            .post('/api/messaging/pool')
            .send(innerTx);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.pool_id).toBe(`${keyPair.publicKey}:1`);
    });

    test('GET /api/validator/messages - Fetch messages', async () => {
        // Assume previous test added a message
        const response = await request(app)
            .get('/api/validator/messages')
            .query({ limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.count).toBeGreaterThan(0);
        expect(response.body.messages[0].payload.content).toBe('hello');
    });
});
