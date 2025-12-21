
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

async function runTests() {
    console.log('🔄 Starting Transaction TTL Validation Tests...\n');

    // Setup Blockchain
    const blockchain = new Blockchain('GENESIS_VAL');

    // Create wallets
    const sender = KeyManager.generateKeyPair();
    const receiver = KeyManager.generateKeyPair();

    // Manually fund sender by directly manipulating state (bypassing transaction logic for setup)
    // @ts-ignore
    blockchain['state'].set(sender.publicKey, {
        address: sender.publicKey,
        balance: 1000,
        nonce: 0
    });


    console.log('✅ Setup Complete. Sender Balance:', blockchain.getBalance(sender.publicKey));

    // TEST 1: Transaction WITHOUT valid_until (Should Pass)
    console.log('\n🧪 TEST 1: Standard Transaction (No TTL)');
    const tx1 = TransactionModel.create(
        sender.publicKey,
        receiver.publicKey,
        TransactionType.TRANSFER,
        10,
        1,
        1, // Nonce 1
        {},
        sender.publicKey
    );
    // Sign tx1
    const sig1 = KeyManager.sign(tx1.getSignableData(), sender.privateKey);
    tx1.sender_signature = sig1;

    // @ts-ignore
    const result1 = blockchain.applyTransactionToState(tx1, blockchain['state']);
    if (result1.success) {
        console.log('  Pass: Standard transaction accepted');
    } else {
        console.error('  Fail: Standard transaction rejected', result1.error);
    }

    // TEST 2: Transaction WITH valid_until (Future) (Should Pass)
    console.log('\n🧪 TEST 2: Valid Transaction with TTL (Future)');
    const futureTime = Date.now() + 60000; // 1 minute in future
    const tx2 = TransactionModel.create(
        sender.publicKey,
        receiver.publicKey,
        TransactionType.TRANSFER,
        10,
        1,
        2, // Nonce 2
        {},
        sender.publicKey,
        undefined,
        futureTime // valid_until
    );
    const sig2 = KeyManager.sign(tx2.getSignableData(), sender.privateKey);
    tx2.sender_signature = sig2;

    // @ts-ignore
    const result2 = blockchain.applyTransactionToState(tx2, blockchain['state']);
    if (result2.success) {
        console.log('  Pass: TTL transaction accepted (valid_until in future)');
    } else {
        console.error('  Fail: TTL transaction rejected', result2.error);
    }

    // TEST 3: Transaction WITH valid_until (Expired) (Should Fail)
    console.log('\n🧪 TEST 3: Expired Transaction with TTL (Past)');
    const pastTime = Date.now() - 5000; // 5 seconds ago
    const tx3 = TransactionModel.create(
        sender.publicKey,
        receiver.publicKey,
        TransactionType.TRANSFER,
        10,
        1,
        3, // Nonce 3
        {},
        sender.publicKey,
        undefined,
        pastTime // valid_until
    );
    const sig3 = KeyManager.sign(tx3.getSignableData(), sender.privateKey);
    tx3.sender_signature = sig3;

    // @ts-ignore
    const result3 = blockchain.applyTransactionToState(tx3, blockchain['state']);
    if (!result3.success && result3.error && result3.error.includes('expired')) {
        console.log('  Pass: Expired transaction rejected correctly');
        console.log(`     Error: ${result3.error}`);
    } else {
        console.error('  Fail: Expired transaction NOT rejected', result3);
    }

    console.log('\n✅ Tests Completed');
}

runTests().catch(console.error);
