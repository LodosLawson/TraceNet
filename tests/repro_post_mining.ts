
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { LocalDatabase } from '../src/database/LocalDatabase';

async function runTest() {
    console.log('--- Testing Mining Failure (Repro) ---');

    const validatorPool = new ValidatorPool();
    const systemKeyPair = KeyManager.generateKeyPair();
    validatorPool.registerValidator('SYSTEM', 'sys', systemKeyPair.publicKey);
    validatorPool.setOnline('SYSTEM');

    const blockchain = new Blockchain('SYSTEM', validatorPool);
    const mempool = new Mempool();
    const blockProducer = new BlockProducer(blockchain, validatorPool, mempool);
    blockProducer.registerLocalValidator('SYSTEM', systemKeyPair.privateKey);

    // Mock restore to ensure we have genesis
    // (In real app, index.ts restores it. Here new Blockchain() creates genesis)

    // Create User
    const userKeys = KeyManager.generateKeyPair();
    const userId = KeyManager.deriveAddress(userKeys.publicKey);

    // 1. Create PROFILE_UPDATE (Nonce 1)
    const profileTx = TransactionModel.create(
        userId,
        userId,
        getTransactionType('PROFILE_UPDATE'),
        0,
        0,
        1,
        { nickname: 'Tester' }
    );
    // Sign
    profileTx.sender_public_key = userKeys.publicKey;
    const profileData = new TransactionModel(profileTx).getSignableData();
    profileTx.sender_signature = KeyManager.sign(profileData, userKeys.privateKey);

    // 2. Create POST_CONTENT (Nonce 2)
    const postTx = TransactionModel.create(
        userId,
        userId,
        getTransactionType('POST_CONTENT'),
        0,
        0.0000001, // FEE_STANDARD
        2,
        { content: 'Hello World' }
    );
    postTx.sender_public_key = userKeys.publicKey;
    const postData = new TransactionModel(postTx).getSignableData();
    postTx.sender_signature = KeyManager.sign(postData, userKeys.privateKey);

    // Add to Mempool
    mempool.addTransaction(profileTx);
    mempool.addTransaction(postTx);

    console.log('Mempool size:', mempool.getSize());

    // Trigger Mining
    console.log('Triggering Block Production...');
    const result = await blockProducer.triggerBlockProduction();

    if (result.success) {
        console.log('✅ Block produced successfully.');
        console.log('Block tx count:', result.block!.transactions.length);
    } else {
        console.error('❌ Mining Failed:', result.error);

        // STATUS CHECK
        if (mempool.getSize() > 0) {
            console.log('⚠️  Transactions still in mempool (Potential Stall).');
        } else {
            console.log('✅ Mempool cleared (No stall).');
        }
    }
}

// Helper to avoid TS enum issues if distinct files
function getTransactionType(typeStr: string): any {
    return typeStr as any;
}

runTest().catch(console.error);
