
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { Mempool } from '../src/node/Mempool';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { Block } from '../src/blockchain/models/Block';

// Mock Blockchain to avoid complexity
class MockBlockchain extends Blockchain {
    constructor(validatorPool: ValidatorPool) {
        super('SYSTEM', validatorPool);
        (this as any).state = new Map();
    }
}

async function runTest() {
    console.log('--- Timestamp Stability Test ---');

    const validatorPool = new ValidatorPool();
    // Add a validator
    validatorPool.registerValidator('VAL1', 'user1', 'pub1');
    validatorPool.setOnline('VAL1');

    const blockchain = new MockBlockchain(validatorPool);
    const mempool = new Mempool();
    // Use very small block time to allow fast production
    const producer = new BlockProducer(blockchain, validatorPool, mempool, 1, 100);
    producer.registerLocalValidator('VAL1', 'priv1'); // Mock keys

    // We need to override selectBlockProducer to always return VAL1 for simplicity
    validatorPool.selectBlockProducer = () => ({
        validator_id: 'VAL1',
        public_key: 'pub1',
        ip_address: '127.0.0.1',
        stake: 1000,
        is_online: true,
        last_seen: Date.now()
    } as any);

    // Override KeyManager.sign for test
    const { KeyManager } = require('../src/blockchain/crypto/KeyManager');
    KeyManager.sign = () => 'mock_signature';
    KeyManager.verify = () => true;

    // Produce 50 blocks as fast as possible
    console.log('Producing 50 blocks...');

    for (let i = 0; i < 50; i++) {
        // Add a dummy transaction
        const tx = TransactionModel.create(
            'sender', 'receiver', TransactionType.TRANSFER, 10, 1, 1, {}, 'sender_pub'
        );
        mempool.addTransaction(tx);

        const result = await producer.triggerBlockProduction();
        if (!result.success) {
            console.error(`Failed to produce block ${i}: ${result.error}`);
            // If failed due to timestamp, it proves the issue (if we see "Invalid timestamp")
            if (result.error && result.error.includes('Invalid timestamp')) {
                console.log('🛑 CAUGHT INTENDED ERROR: Timestamp instability detected.');
            }
            // Even if it fails, we continue to see if we can produce more?
            // Actually if it fails, the chain doesn't advance, so next one will likely fail too if conditions persist.
        } else {
            // console.log(`Block ${result.block?.index} produced. Timestamp: ${result.block?.timestamp}`);
        }

        // Check latest block timestamp vs previous
        const latest = blockchain.getLatestBlock();
        const prev = blockchain.getBlockByIndex(latest.index - 1);
        if (prev && latest.timestamp <= prev.timestamp) {
            console.error(`❌ CRITICAL FAILURE: Block ${latest.index} timestamp (${latest.timestamp}) <= Block ${prev.index} timestamp (${prev.timestamp})`);
        }
    }

    console.log('Test Complete. Checking chain validity...');
    const validation = blockchain.validateChain();
    if (validation.valid) {
        console.log('✅ Chain is valid.');
    } else {
        console.error('❌ Chain validation failed:', validation.error);
    }
}

runTest().catch(console.error);
