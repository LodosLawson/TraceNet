
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { Block } from '../src/blockchain/models/Block';

async function runTests() {
    console.log('🔒 Starting Security Verification Tests...\n');

    // Setup
    const validatorPool = new ValidatorPool();
    const systemKeyPair = KeyManager.generateKeyPair();
    validatorPool.registerValidator('SYSTEM', 'system_user', systemKeyPair.publicKey);
    validatorPool.setOnline('SYSTEM');

    const blockchain = new Blockchain('SYSTEM', validatorPool);

    // Create test wallets
    const aliceKeys = KeyManager.generateKeyPair();
    const bobKeys = KeyManager.generateKeyPair();
    const aliceWallet = 'alice_wallet';
    const bobWallet = 'bob_wallet';

    // Fund alice (hack state for testing)
    const aliceAccount = {
        address: aliceWallet,
        balance: 1000,
        nonce: 0
    };
    // @ts-ignore - Accessing private state for test setup
    (blockchain as any).state.set(aliceWallet, aliceAccount);

    console.log('✅ Setup Complete');

    // TEST 1: Replay Protection
    console.log('\n🧪 TEST 1: Replay Protection');
    const tx1 = TransactionModel.create(
        aliceWallet,
        bobWallet,
        TransactionType.TRANSFER,
        100,
        10, // fee
        1,  // nonce (correct: 0 + 1)
        {}, // payload
        aliceKeys.publicKey
    );
    // Sign
    const signature1 = KeyManager.sign(tx1.getSignableData(), aliceKeys.privateKey);
    tx1.addSignature(aliceWallet, signature1);

    const result1 = (blockchain as any).applyTransactionToState(tx1, (blockchain as any).state); // Apply 1st time
    if (result1.success) {
        console.log('  Pass: First transaction accepted');
    } else {
        console.error('  Fail: First transaction rejected', result1.error);
    }

    // Replay
    const result1Replay = (blockchain as any).applyTransactionToState(tx1, (blockchain as any).state); // Apply again
    if (!result1Replay.success && (result1Replay.error?.includes('nonce') || result1Replay.error?.includes('Duplicate'))) {
        console.log('  Pass: Replay transaction rejected (Duplicate or Nonce error)');
    } else {
        console.error('  Fail: Replay transaction NOT rejected correctly', result1Replay);
    }

    // TEST 2: Invalid Nonce
    console.log('\n🧪 TEST 2: Invalid Nonce');
    const tx2 = TransactionModel.create(
        aliceWallet,
        bobWallet,
        TransactionType.TRANSFER,
        50,
        10,
        5,  // Invalid nonce
        {},
        aliceKeys.publicKey
    );
    const signature2 = KeyManager.sign(tx2.getSignableData(), aliceKeys.privateKey);
    tx2.addSignature(aliceWallet, signature2);

    const result2 = (blockchain as any).applyTransactionToState(tx2, (blockchain as any).state);
    if (!result2.success && result2.error?.includes('nonce')) {
        console.log('  Pass: Transaction with gap nonce rejected');
    } else {
        console.error('  Fail: Transaction with gap nonce accepted', result2);
    }


    // TEST 3: Block Signature Verification
    console.log('\n🧪 TEST 3: Block Signature Verification');
    const latestBlock = blockchain.getLatestBlock();
    const newBlock = Block.create(
        latestBlock.index + 1,
        latestBlock.hash || '',
        [],
        'SYSTEM',
        '0'.repeat(64)
    );

    // Invalid signature
    const invalidSig = 'invalid_signature_hex';
    const blockResInv = await blockchain.addBlock([], 'SYSTEM', invalidSig);

    const resSigVal = blockchain.addBlock([], 'SYSTEM', 'deadbeef'); // bad signature
    if (!resSigVal.success && (resSigVal.error?.includes('signature') || resSigVal.error?.includes('Invalid'))) {
        console.log('  Pass: Block with invalid signature rejected');
    } else {
        console.error('  Fail: Block with invalid signature accepted or wrong error', resSigVal);
    }

    // TEST 4: Timestamp Drift
    console.log('\n🧪 TEST 4: Timestamp Drift');

    // We need to bypass addBlock to test validation of a specific block object
    const futureBlock = Block.create(
        latestBlock.index + 1,
        latestBlock.hash || '',
        [],
        'SYSTEM',
        '0'.repeat(64)
    );
    futureBlock.timestamp = Date.now() + 20000; // +20s (Limit is 15s)

    // Note: validateBlock is public? No, usually private or public?
    // Checking Blockchain.ts: public validateBlock(block: Block, previousBlock: Block)
    const resTime = blockchain.validateBlock(futureBlock, latestBlock);
    if (!resTime.valid && resTime.error?.includes('future')) {
        console.log('  Pass: Future block rejected');
    } else {
        console.error('  Fail: Future block NOT rejected', resTime);
    }


    // TEST 5: Deterministic Validator Selection
    console.log('\n🧪 TEST 5: Validator Selection');
    // Add another validator
    const val2Keys = KeyManager.generateKeyPair();
    validatorPool.registerValidator('VAL2', 'val2_user', val2Keys.publicKey);
    validatorPool.setOnline('VAL2');

    const prevHash = 'hash123';
    validatorPool.selectBlockProducer(100, prevHash); // Warm up ?

    const s1 = validatorPool.selectBlockProducer(100, prevHash);
    const s2 = validatorPool.selectBlockProducer(100, prevHash);

    if (s1?.validator_id === s2?.validator_id) {
        console.log('  Pass: Selection is deterministic');
    } else {
        console.error('  Fail: Selection is NOT deterministic');
    }

    const s3 = validatorPool.selectBlockProducer(100, 'hash456'); // Change hash
    // Might be different
    console.log(`  Hash1 -> ${s1?.validator_id}, Hash2 -> ${s3?.validator_id}`);


    // TEST 6: Duplicate Transaction ID
    console.log('\n🧪 TEST 6: Duplicate Transaction ID');
    // Using tx1 again, even if we hacked the nonce or something, the ID should be cached
    // However, applyTransactionToState might have rejected it due to nonce earlier.
    // Let's make a new valid transaction
    const tx3 = TransactionModel.create(
        aliceWallet,
        bobWallet,
        TransactionType.TRANSFER,
        5,
        1,
        2, // nonce 2
        {},
        aliceKeys.publicKey
    );
    const sig3 = KeyManager.sign(tx3.getSignableData(), aliceKeys.privateKey);
    tx3.addSignature(aliceWallet, sig3);

    const res3 = (blockchain as any).applyTransactionToState(tx3, (blockchain as any).state);
    if (res3.success) {
        console.log('  Pass: New valid transaction accepted');
    } else {
        console.error('  Fail: New valid transaction rejected', res3);
    }

    // Try to replay SAME transaction ID immediately
    // Note: in real flow, this happens if same tx is broadcast twice.
    const res3Dup = (blockchain as any).applyTransactionToState(tx3, (blockchain as any).state);
    if (!res3Dup.success && res3Dup.error?.includes('Duplicate')) {
        console.log('  Pass: Duplicate Transaction ID rejected');
    } else {
        console.error('  Fail: Duplicate Transaction ID NOT rejected', res3Dup);
    }

    // TEST 7: Slashing (Double Signing)
    console.log('\n🧪 TEST 7: Slashing (Double Signing)');

    // We need to simulate:
    // 1. Validator produces a valid block at height H
    // 2. Validator tries to produce ANOTHER block at height H (different hash/payload)

    // Let's add a valid block first
    const blockA = Block.create(
        latestBlock.index + 1, // Valid next block
        latestBlock.hash || '',
        [],
        'VAL2', // Use our second validator
        '0'.repeat(64)
    );
    blockA.hash = blockA.calculateHash();
    // HACK: manually insert block into chain to simulate it being there
    (blockchain as any).chain.push(blockA);
    console.log(`  Inserted block at height ${blockA.index}`);

    // Now try to add another block at same height from same validator
    // This goes through receiveBlock which has the check
    const blockB_Transactions: any[] = [];
    const blockB = Block.create(
        blockA.index, // Same height as blockA
        latestBlock.hash || '', // Same previous hash
        blockB_Transactions,
        'VAL2',
        '1'.repeat(64) // different state root makes hash different
    );
    blockB.hash = blockB.calculateHash();
    // Note: receiveBlock takes the BLOCK object
    const resSlash = (blockchain as any).receiveBlock(blockB);

    if (!resSlash.success && resSlash.error?.includes('Double signing')) {
        console.log('  Pass: Double signing detected and rejected');

        // Check if validator is offline/slashed
        const val2 = validatorPool.getValidator('VAL2');
        if (val2 && !val2.is_online && val2.reputation <= 50) {
            console.log('  Pass: Validator slashed (reputation reduced and set offline)');
        } else {
            console.error('  Fail: Validator NOT slashed correctly', val2);
        }
    } else {
        console.error('  Fail: Double signing NOT detected', resSlash);
    }

    console.log('\n✅ Tests Completed');
}

runTests().catch(console.error);
