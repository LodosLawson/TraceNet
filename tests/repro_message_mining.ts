
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { LocalDatabase } from '../src/database/LocalDatabase';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

// Mock Validator Pool
class MockValidatorPool extends ValidatorPool {
    private pubKey: string;
    // Default to system_pub_key if not provided, but we should provide it
    constructor(pubKey: string = 'system_pub_key') {
        super();
        this.pubKey = pubKey;
    }
    // Override selectBlockProducer to always return our test validator
    selectBlockProducer(blockIndex: number, previousHash: string | undefined, round: number): any {
        return {
            validator_id: 'SYSTEM_VALIDATOR',
            public_key: this.pubKey,
            stake: 100000,
            is_online: true
        };
    }

    // Override getValidator to pass Blockchain validation
    getValidator(validatorId: string): any {
        if (validatorId === 'SYSTEM_VALIDATOR') {
            return {
                validator_id: 'SYSTEM_VALIDATOR',
                public_key: this.pubKey,
                stake: 100000,
                is_online: true
            };
        }
        return undefined;
    }
}

async function runTest() {
    console.log('--- Testing Message Mining Failure (Repro Signed Final) ---');

    // 1. Setup Validator Keys
    const validatorKeys = KeyManager.generateKeyPair();

    // Pass keys to pool
    const validatorPool = new MockValidatorPool(validatorKeys.publicKey);

    const blockchain = new Blockchain('SYSTEM_VALIDATOR', validatorPool);
    const mempool = new Mempool();
    const blockProducer = new BlockProducer(blockchain, validatorPool, mempool);

    // Register Validator with correct private key
    blockProducer.registerLocalValidator('SYSTEM_VALIDATOR', validatorKeys.privateKey);

    // Generate User with Keys
    const keyPair = KeyManager.generateKeyPair();
    const userId = KeyManager.deriveAddress(keyPair.publicKey);
    const privateKey = keyPair.privateKey;
    const publicKey = keyPair.publicKey;

    // Fund user (add to state manually to bypass fee checks on funding)
    blockchain['state'].set(userId, {
        address: userId,
        balance: 1000000,
        nonce: 0
    });

    // 2. Create Messages with different fees

    // A. FAST (Should mine immediately)
    const txFast = TransactionModel.create(
        userId,
        userId,
        'PRIVATE_MESSAGE' as TransactionType,
        0,
        0.00001, // FEE_FAST
        1, // Nonce 1
        { message: 'Fast Message' },
        publicKey
    );
    let signData = txFast.getSignableData();
    txFast.sender_signature = KeyManager.sign(signData, privateKey);
    txFast.sender_public_key = publicKey;

    // B. STANDARD (Should wait 10 mins)
    const txStandard = TransactionModel.create(
        userId,
        userId,
        'PRIVATE_MESSAGE' as TransactionType,
        0,
        0.0000001, // FEE_STANDARD
        2, // Nonce 2
        { message: 'Standard Message' },
        publicKey
    );
    signData = txStandard.getSignableData();
    txStandard.sender_signature = KeyManager.sign(signData, privateKey);
    txStandard.sender_public_key = publicKey;

    // C. LOW (Should wait 1 hour)
    const txLow = TransactionModel.create(
        userId,
        userId,
        'PRIVATE_MESSAGE' as TransactionType,
        0,
        0.00000001, // FEE_LOW
        3, // Nonce 3
        { message: 'Low Message' },
        publicKey
    );
    signData = txLow.getSignableData();
    txLow.sender_signature = KeyManager.sign(signData, privateKey);
    txLow.sender_public_key = publicKey;

    console.log('Adding transactions to mempool...');
    mempool.addTransaction(txFast.toJSON());
    mempool.addTransaction(txStandard.toJSON());
    mempool.addTransaction(txLow.toJSON());

    console.log(`Mempool size: ${mempool.getSize()}`);

    // 3. Trigger Block Production (Time 0)
    console.log('\n--- Attempt 1: Immediate Mining ---');
    // Using triggerBlockProduction explicitly
    const result = await blockProducer.triggerBlockProduction();
    if (!result.success) {
        console.log(`Mining failed: ${result.error}`);
    }

    let latestBlock = blockchain.getLatestBlock();
    console.log(`Latest Block Index: ${latestBlock.index}`);
    console.log(`Transactions in block: ${latestBlock.transactions.length}`);
    latestBlock.transactions.forEach(tx => console.log(` - ${tx.tx_id} (${tx.type}) Fee: ${tx.fee}`));

    // Check what remains in mempool
    console.log(`Mempool size after mining: ${mempool.getSize()}`);

    // Expectations:
    // Block should contain FAST tx (1 total).
    // Mempool should contain STANDARD and LOW (2 total).

    if (latestBlock.transactions.length === 1 && mempool.getSize() === 2) {
        console.log('SUCCESS: FAST mined, others held.');
    } else {
        console.log(`FAILURE: Expected 1 in block (Got ${latestBlock.transactions.length}), 2 in mempool (Got ${mempool.getSize()})`);
    }

}

runTest().catch(console.error);
