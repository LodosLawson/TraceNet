
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

async function runTest() {
    console.log('--- Starting Time-Based Fee Verification ---');

    // Helper to create fresh blockchain
    const validatorKeys = KeyManager.generateKeyPair();
    const senderKeys = KeyManager.generateKeyPair();

    function setupBlockchain() {
        const blk = new Blockchain(validatorKeys.publicKey);
        // @ts-ignore
        blk.state.set(senderKeys.publicKey, {
            address: senderKeys.publicKey,
            balance: 100,
            nonce: 0
        });
        return blk;
    }

    // 2. Test Case 1: Low Fee, Immediate (Should Fail)
    console.log('\n[Test 1] Low Fee (Standard Batch) - Immediate Execution');
    let blockchain = setupBlockchain();

    const lowFee = 0.0000001; // Meets Standard Batch threshold
    const tx1 = TransactionModel.create(
        senderKeys.publicKey,
        'RECIPIENT_WALLET',
        TransactionType.MESSAGE_PAYMENT,
        0, // amount
        lowFee,
        1, // nonce
        { message: 'Hello World' },
        senderKeys.publicKey
    );
    // Sign tx1
    const sig1 = KeyManager.sign(tx1.getSignableData(), senderKeys.privateKey);
    tx1.sender_signature = sig1;

    // Try to add block
    const result1 = blockchain.addBlock([tx1], validatorKeys.publicKey, 'mock_sig');

    if (!result1.success && result1.error?.includes('Standard priority requires 10 min wait')) {
        console.log('✅ Passed: Immediate low fee transaction rejected as expected.');
    } else {
        console.error('❌ Failed: Expected rejection for immediate low fee tx. Got:', result1);
    }

    // 3. Test Case 2: Low Fee, Delayed (Should Pass)
    console.log('\n[Test 2] Low Fee (Standard Batch) - Delayed Execution (11 mins)');
    blockchain = setupBlockchain(); // RESET STATE

    const tx2 = TransactionModel.create(
        senderKeys.publicKey,
        'RECIPIENT_WALLET',
        TransactionType.MESSAGE_PAYMENT,
        0,
        lowFee,
        1, // nonce (Fresh chain, so nonce is 1)
        { message: 'Hello World Delayed' },
        senderKeys.publicKey
    );
    // Manually set timestamp to 11 mins ago
    tx2.timestamp = Date.now() - (11 * 60 * 1000);
    const sig2 = KeyManager.sign(tx2.getSignableData(), senderKeys.privateKey);
    tx2.sender_signature = sig2;

    // Note: addBlock validates nonce. Since tx1 failed, account nonce is 0.
    // So tx2 nonce should be 1.
    tx2.nonce = 1;
    // Updating nonce changes hash/signable data, re-sign again
    tx2.sender_signature = KeyManager.sign(tx2.getSignableData(), senderKeys.privateKey);

    const result2 = blockchain.addBlock([tx2], validatorKeys.publicKey, 'mock_sig');

    if (result2.success) {
        console.log('✅ Passed: Delayed low fee transaction accepted.');
    } else {
        console.error('❌ Failed: Expected success for delayed low fee tx. Got:', result2);
    }

    // 4. Test Case 3: Fast Fee, Immediate (Should Pass)
    console.log('\n[Test 3] Fast Fee - Immediate Execution');
    blockchain = setupBlockchain(); // RESET STATE

    const fastFee = 0.00001;
    const tx3 = TransactionModel.create(
        senderKeys.publicKey,
        'RECIPIENT_WALLET',
        TransactionType.MESSAGE_PAYMENT,
        0,
        fastFee,
        1, // nonce (Fresh chain)
        { message: 'Fast Message' },
        senderKeys.publicKey
    );

    const sig3 = KeyManager.sign(tx3.getSignableData(), senderKeys.privateKey);
    tx3.sender_signature = sig3;

    const result3 = blockchain.addBlock([tx3], validatorKeys.publicKey, 'mock_sig');
    if (result3.success) {
        console.log('✅ Passed: Immediate fast fee transaction accepted.');
    } else {
        console.error('❌ Failed: Expected success for fast fee tx. Got:', result3);
    }

}

runTest().catch(console.error);
