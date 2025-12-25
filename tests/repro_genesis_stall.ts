
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { Mempool } from '../src/node/Mempool';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { AirdropService } from '../src/wallet/AirdropService';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

async function runTest() {
    console.log('--- Testing Genesis & Stalling Bug & Airdrop Logic ---');

    console.log('[Setup] Initializing Core Components...');
    const validatorPool = new ValidatorPool();
    const systemKeys = KeyManager.generateKeyPair(); // System Validator Keys

    // Register System Validator
    validatorPool.registerValidator('VAL_SYSTEM', 'system_user', systemKeys.publicKey);
    validatorPool.setOnline('VAL_SYSTEM');

    // Initialize Blockchain
    const blockchain = new Blockchain('VAL_SYSTEM', validatorPool);
    const mempool = new Mempool();

    // Inject local validator key for BlockProducer
    const producer = new BlockProducer(blockchain, validatorPool, mempool, 100, 10);
    producer.registerLocalValidator('VAL_SYSTEM', systemKeys.privateKey);

    // Initial Chain Check
    const chain = blockchain.getChain();
    console.log(`\n[Check] Chain length after init: ${chain.length}`);
    if (chain.length > 0 && chain[0].index === 0) {
        console.log('✅ Genesis Block confirmed at Index 0.');
    } else {
        console.error('❌ BUG: Genesis Block missing or invalid index.');
    }

    // Initialize AirdropService with System Keys (The FIX)
    // Note: We access private props of AirdropService to verify they are set, or relying on behavior.
    console.log('\n[Setup] Initializing AirdropService...');
    const airdropService = new AirdropService(625000, 'SYSTEM', blockchain, systemKeys);
    console.log('AirdropService initialized.');

    // 1. Simulate User Registration
    console.log('\n--- Simulating User Registration & Airdrop ---');

    // User mock
    const userWalletId = 'USER_TEST_WALLET';
    const userKeys = KeyManager.generateKeyPair();
    console.log(`User Wallet: ${userWalletId}`);

    // 1a. Profile Update Transaction
    // User nonce 0 -> Tx Nonce 1
    const profileTx = TransactionModel.create(userWalletId, userWalletId, TransactionType.PROFILE_UPDATE, 0, 0, 1);
    profileTx.sender_public_key = userKeys.publicKey;
    profileTx.sender_signature = KeyManager.sign(profileTx.getSignableData(), userKeys.privateKey);
    mempool.addTransaction(profileTx);
    console.log(`[Tw] Profile Update added to Mempool: ${profileTx.tx_id}`);

    // 1b. Airdrop Transaction (Triggered by Service)
    const airdropTx = airdropService.createAirdropTransaction(userWalletId, userWalletId);
    if (airdropTx) {
        // Log details about Airdrop Tx
        console.log(`[Tx] Airdrop Created. Nonce: ${airdropTx.nonce}, Signed: ${!!airdropTx.sender_signature}`);
        if (airdropTx.sender_signature) {
            const isValid = KeyManager.verify(airdropTx.getSignableData(), airdropTx.sender_signature, systemKeys.publicKey);
            console.log(`[Verify] Airdrop Signature Valid: ${isValid}`);
        }

        const adRes = mempool.addTransaction(airdropTx);
        console.log(`[Tx] Airdrop added to Mempool: ${airdropTx.tx_id} (Success: ${adRes.success})`);
    } else {
        console.error('❌ Failed to create Airdrop Tx.');
    }

    // 2. Mine Block 1
    console.log('\n[Mining] Triggering Block 1 Production...');
    // We expect both transactions to be mined
    const mineRes1 = await producer.triggerBlockProduction();
    console.log(`Mining Result: ${mineRes1.success ? 'Success' : mineRes1.error}`);

    const chain1 = blockchain.getChain();
    console.log(`Chain Length: ${chain1.length}`);
    const block1 = chain1[1];

    if (block1) {
        console.log(`Block 1 Txs: ${block1.transactions.length}`);
        block1.transactions.forEach(tx => console.log(` - Tx Type: ${tx.type}, Nonce: ${tx.nonce}, From: ${tx.from_wallet}`));

        // Check balance
        const balance = blockchain.getBalance(userWalletId);
        console.log(`User Balance after Block 1: ${balance}`);

        if (balance >= 625000) {
            console.log('✅ User received Airdrop funds.');
        } else {
            console.error('❌ User balance is 0. Airdrop failed to execute.');
        }
    } else {
        console.error('❌ Block 1 was NOT produced.');
    }

    // 3. Simulate Stalling (Second Transaction)
    console.log('\n--- Simulating Second Transaction (Stalling Test) ---');
    // Transfer 10 coins. 
    // User Nonce:
    // ProfileUpdate (Nonce 1) was processed. So User Nonce -> 1.
    // Next Tx Nonce should be 2.

    // Check User State Nonce
    const userState = blockchain.getAccountState(userWalletId);
    console.log(`User State Nonce: ${userState ? userState.nonce : 'undefined'}`);

    const tx2 = TransactionModel.create(userWalletId, 'OTHER_WALLET', TransactionType.TRANSFER, 10, 1, 2);
    tx2.sender_public_key = userKeys.publicKey;
    tx2.sender_signature = KeyManager.sign(tx2.getSignableData(), userKeys.privateKey);

    const memRes2 = mempool.addTransaction(tx2);
    console.log(`[Tx] Transfer added: ${tx2.tx_id} (Success: ${memRes2.success}, Error: ${memRes2.error})`);

    console.log('[Mining] Triggering Block 2 Production...');
    const mineRes2 = await producer.triggerBlockProduction();
    console.log(`Mining Result: ${mineRes2.success ? 'Success' : mineRes2.error}`);

    const chain2 = blockchain.getChain();
    console.log(`Final Chain Length: ${chain2.length}`);

    if (chain2.length > 2) {
        console.log('✅ Block 2 mined successfully. Stalling fixed.');
    } else {
        console.error('❌ Block 2 NOT mined. Stalling persists.');
    }
}

runTest().catch(console.error);
