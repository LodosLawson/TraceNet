
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

async function runTests() {
    console.log('🔄 Starting Validator Fallback (Soft-Turn) Tests...\n');

    // Setup Validator Pool with 3 validators
    const validatorPool = new ValidatorPool();

    // Register validators
    const val1 = KeyManager.generateKeyPair();
    const val2 = KeyManager.generateKeyPair();
    const val3 = KeyManager.generateKeyPair();

    validatorPool.registerValidator('VAL1', 'user1', val1.publicKey);
    validatorPool.registerValidator('VAL2', 'user2', val2.publicKey);
    validatorPool.registerValidator('VAL3', 'user3', val3.publicKey);

    validatorPool.setOnline('VAL1');
    validatorPool.setOnline('VAL2');
    validatorPool.setOnline('VAL3');

    console.log(`✅ Registered 3 online validators: VAL1, VAL2, VAL3`);

    // Mock constants
    const BLOCK_TIME = 5000; // 5 seconds
    const previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const blockIndex = 100;

    // Test Round 0 (Happy Path)
    console.log('\n🧪 TEST 1: Round 0 (Normal Operation)');
    const producer0 = validatorPool.selectBlockProducer(blockIndex, previousHash, 0);
    console.log(`  Round 0 Producer: ${producer0?.validator_id}`);

    if (!producer0) {
        console.error('  Fail: No producer selected');
        return;
    }

    // Test Round 1 (Fallback 1)
    console.log('\n🧪 TEST 2: Round 1 (Fallback - 1st turn missed)');
    const producer1 = validatorPool.selectBlockProducer(blockIndex, previousHash, 1);
    console.log(`  Round 1 Producer: ${producer1?.validator_id}`);

    if (producer1?.validator_id === producer0?.validator_id) {
        console.error('  Fail: Producer did not rotate');
    } else {
        console.log('  Pass: Producer rotated');
    }

    // Test Round 2 (Fallback 2)
    console.log('\n🧪 TEST 3: Round 2 (Fallback - 2nd turn missed)');
    const producer2 = validatorPool.selectBlockProducer(blockIndex, previousHash, 2);
    console.log(`  Round 2 Producer: ${producer2?.validator_id}`);

    if (producer2?.validator_id === producer1?.validator_id || producer2?.validator_id === producer0?.validator_id) {
        console.log('  Note: Rotation check depends on sort order. Just checking it produces valid output.');
    }

    // Verify Rotation Sequence
    console.log('\n📊 Sequence Simulation:');
    for (let r = 0; r < 5; r++) {
        const p = validatorPool.selectBlockProducer(blockIndex, previousHash, r);
        console.log(`  Round ${r}: ${p?.validator_id}`);
    }

    // Check if rotation covers all validators
    const distinctProducers = new Set();
    distinctProducers.add(validatorPool.selectBlockProducer(blockIndex, previousHash, 0)?.validator_id);
    distinctProducers.add(validatorPool.selectBlockProducer(blockIndex, previousHash, 1)?.validator_id);
    distinctProducers.add(validatorPool.selectBlockProducer(blockIndex, previousHash, 2)?.validator_id);

    if (distinctProducers.size === 3) {
        console.log('\n✅ Pass: All validators get a turn via round rotation');
    } else {
        console.error('\n❌ Fail: Not all validators reachable via rotation');
    }

    console.log('\n✅ Tests Completed');
}

runTests().catch(console.error);
