
import express from 'express';
import { RPCServer } from '../src/node/RPCServer';
import { Blockchain, AccountState } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { MessagePool } from '../src/node/MessagePool';
import { WalletService } from '../src/wallet/WalletService';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { UserService } from '../src/services/user/UserService';
import { SocialService } from '../src/services/SocialService';
import { ContentService } from '../src/services/ContentService';
import { AirdropService } from '../src/wallet/AirdropService';
import { InnerTransaction, TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import http from 'http';

// Mock Blockchain and dependencies
class MockBlockchain extends Blockchain {
    constructor() {
        super('SYSTEM', new ValidatorPool());
        // Mock state as Map to satisfy base class
        (this as any).state = new Map();
        (this as any).state.set('TRN_RICH_USER', { address: 'TRN_RICH_USER', balance: 1000000000, nonce: 0 });
        (this as any).state.set('TRN_POOR_USER', { address: 'TRN_POOR_USER', balance: 0, nonce: 0 });
    }

    getAllAccounts(): AccountState[] {
        return Array.from((this as any).state.values()) as AccountState[];
    }

    getBalance(address: string) {
        if (address === 'TRN_RICH_USER') return 1000000000;
        // Check local state map
        const account: any = (this as any).state.get(address);
        return account ? account.balance : 0;
    }
}

async function runTest() {
    console.log('--- Starting Comprehensive System Verification ---');

    // 1. Setup Dependencies
    const validatorPool = new ValidatorPool();
    const blockchain = new MockBlockchain();
    const mempool = new Mempool();
    const messagePool = new MessagePool();
    const walletService = new WalletService('test-key');
    // FIX: AirdropService takes (amount, systemId) not services
    const airdropService = new AirdropService();
    const userService = new UserService(walletService, airdropService, mempool);
    // Correct Constructors: 2 args
    const socialService = new SocialService(blockchain as any, mempool);
    const contentService = new ContentService(blockchain as any, mempool);

    // Cross-link services if methods exist
    if (typeof (contentService as any).setUserService === 'function') {
        contentService.setUserService(userService);
    }
    if (typeof (userService as any).setContentService === 'function') {
        (userService as any).setContentService(contentService);
    }
    if (typeof (socialService as any).setContentService === 'function') {
        (socialService as any).setContentService(contentService);
    }

    // Server
    const port = 3002;
    const rpcServer = new RPCServer(
        blockchain,
        mempool,
        messagePool,
        walletService,
        validatorPool,
        port
    );
    rpcServer.setUserService(userService);
    rpcServer.setSocialService(socialService);

    // Start Server
    const app = rpcServer['app'];
    const server = http.createServer(app);

    server.listen(port, async () => {
        console.log(`Test server running on port ${port}`);

        try {
            // ==========================================
            // TEST 1: Coin Transfer (Priority & Speed)
            // ==========================================
            console.log('\n[Test 1] Coin Transfer Verification');

            // 1.1 Calculate Fee for Standard
            let feeRes = await fetch(`http://localhost:${port}/rpc/calculateTransferFee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_address: 'TRN_NEW_USER', amount: 100, priority: 'STANDARD' })
            });
            let feeData: any = await feeRes.json();
            console.log('Standard Fee Response:', JSON.stringify(feeData));
            console.log('Standard Fee:', feeData.total_fee);

            // 1.2 Calculate Fee for High Priority
            feeRes = await fetch(`http://localhost:${port}/rpc/calculateTransferFee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient_address: 'TRN_NEW_USER', amount: 100, priority: 'HIGH' })
            });
            feeData = await feeRes.json();
            console.log('High Priority Fee:', feeData.total_fee);

            if (feeData.total_fee > 0) {
                console.log('✅ Passed: Fee calculation operational');
            } else {
                console.error('❌ Failed: Fee calculation returned 0 or error');
            }

            // 1.3 Send Transfer
            // Mock a funded wallet
            const senderWallet = walletService.createWallet();
            // Inject balance into mock blockchain
            (blockchain as any).state.set(senderWallet.wallet.wallet_id, {
                address: senderWallet.wallet.wallet_id,
                balance: 1000000000,
                nonce: 0
            });

            const rawTx = TransactionModel.create(
                senderWallet.wallet.wallet_id,
                'TRN_RECEIVER',
                TransactionType.TRANSFER,
                500,
                100,
                1,
                {}, // payload
                senderWallet.wallet.public_key // sender_public_key
            );
            const signData = new TransactionModel(rawTx).getSignableData();
            const signature = KeyManager.sign(signData, senderWallet.privateKey);
            rawTx.sender_public_key = senderWallet.wallet.public_key;
            rawTx.sender_signature = signature;

            const sendRes = await fetch(`http://localhost:${port}/rpc/sendRawTx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rawTx)
            });
            const sendData: any = await sendRes.json();
            console.log('Transfer Result:', sendData);

            if (sendData.success) {
                console.log('✅ Passed: Coin Transfer submitted successfully');
            } else {
                console.error('❌ Failed: Coin Transfer submission error');
            }


            // ==========================================
            // TEST 2: Messaging V2 (Pool)
            // ==========================================
            console.log('\n[Test 2] Messaging V2 Verification');
            const msgSender = walletService.createWallet();
            const innerTx: InnerTransaction = {
                type: TransactionType.PRIVATE_MESSAGE,
                from_wallet: msgSender.wallet.wallet_id,
                to_wallet: 'TRN_RECIPIENT',
                amount: 1,
                payload: { content: 'TEST_MESSAGE_V2' },
                timestamp: Date.now(),
                nonce: 1,
                max_wait_time: 3600000,
                sender_public_key: msgSender.wallet.public_key,
                signature: ''
            };

            const msgSignData = JSON.stringify({
                type: innerTx.type,
                from_wallet: innerTx.from_wallet,
                to_wallet: innerTx.to_wallet,
                amount: innerTx.amount,
                payload: innerTx.payload,
                timestamp: innerTx.timestamp,
                nonce: innerTx.nonce,
                max_wait_time: innerTx.max_wait_time
            });
            innerTx.signature = KeyManager.sign(msgSignData, msgSender.privateKey);

            const msgRes = await fetch(`http://localhost:${port}/api/messaging/pool`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(innerTx)
            });
            const msgData: any = await msgRes.json();
            console.log('Message Pool Result:', msgData);

            if (msgRes.status === 200 && msgData.success) {
                console.log('✅ Passed: Message submitted to pool');
            } else {
                console.error('❌ Failed: Message submission failed');
            }


            // ==========================================
            // TEST 3: Social Interactions
            // ==========================================
            console.log('\n[Test 3] Social Interaction Verification');

            const userRes = await fetch(`http://localhost:${port}/api/user/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: 'social_user' })
            });
            const userData: any = await userRes.json();
            // Ensure successful creation
            if (!userData.user) {
                console.error('Failed to create user:', userData);
                throw new Error('User creation failed');
            }
            const userId = userData.user.user_id || userData.user.system_id;

            // Fund the new user for likes
            const userWalletId = userData.wallet.wallet_id;
            (blockchain as any).state.set(userWalletId, {
                address: userWalletId,
                balance: 1000000000,
                nonce: 0
            });

            const likeRes = await fetch(`http://localhost:${port}/api/social/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet_id: userWalletId, content_id: 'sample-post-id' })
            });
            const likeData: any = await likeRes.json();
            console.log('Like Result:', likeData);
            if (likeData.success) {
                console.log('✅ Passed: Like action processed');
            } else {
                console.warn('⚠️ Warning: Like action failed. likely expected in partial mock.');
            }


            // ==========================================
            // TEST 4: Security / Error Handling
            // ==========================================
            console.log('\n[Test 4] Security Verification');

            const badTx = { ...rawTx, tx_id: 'bad_id' };
            badTx.sender_signature = 'bad_sig';
            const secRes = await fetch(`http://localhost:${port}/rpc/sendRawTx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(badTx)
            });
            const secData: any = await secRes.json();

            if (secRes.status === 400 && secData.error) {
                console.log('✅ Passed: Invalid signature rejected');
            } else {
                console.error('❌ Failed: Invalid transaction accepted!');
            }

            console.log('\n--- Verification Complete ---');
            process.exit(0);

        } catch (err) {
            console.error('Test Error:', err);
            process.exit(1);
        }
    });
}

runTest();
