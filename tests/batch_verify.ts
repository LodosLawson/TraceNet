
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { TransactionModel, TransactionType, InnerTransaction } from '../src/blockchain/models/Transaction';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

async function runTest() {
    console.log('--- Starting Batch Verification ---');

    const validatorKeys = KeyManager.generateKeyPair();
    const blockchain = new Blockchain(validatorKeys.publicKey);

    // Setup Users
    const userA = KeyManager.generateKeyPair();
    const userB = KeyManager.generateKeyPair();

    // Fund users
    // @ts-ignore
    blockchain.state.set(userA.publicKey, { address: userA.publicKey, balance: 50, nonce: 0 });
    // @ts-ignore
    blockchain.state.set(userB.publicKey, { address: userB.publicKey, balance: 50, nonce: 0 });
    // @ts-ignore
    blockchain.state.set(validatorKeys.publicKey, { address: validatorKeys.publicKey, balance: 10, nonce: 0 });

    console.log('Users funded. Creating inner transactions...');

    // Helper to sign inner tx
    function signInner(inner: Partial<InnerTransaction>, keys: any): InnerTransaction {
        const fullInner = {
            type: inner.type || TransactionType.MESSAGE_PAYMENT,
            from_wallet: keys.publicKey,
            to_wallet: inner.to_wallet || 'RECIPIENT',
            amount: inner.amount || 0,
            payload: inner.payload || {},
            timestamp: inner.timestamp || Date.now(),
            nonce: inner.nonce || 1,
            max_wait_time: inner.max_wait_time
        } as InnerTransaction;

        const signableData = JSON.stringify({
            type: fullInner.type,
            from_wallet: fullInner.from_wallet,
            to_wallet: fullInner.to_wallet,
            amount: fullInner.amount,
            payload: fullInner.payload,
            timestamp: fullInner.timestamp,
            nonce: fullInner.nonce,
            max_wait_time: fullInner.max_wait_time
        });

        fullInner.signature = KeyManager.sign(signableData, keys.privateKey);
        return fullInner;
    }

    const innerTxA = signInner({
        amount: 1,
        payload: { text: 'Msg A' },
        nonce: 1
    }, userA);

    const innerTxB = signInner({
        amount: 2,
        payload: { text: 'Msg B' },
        nonce: 1
    }, userB);

    console.log('Inner transactions signed.');

    // Create Batch Tx
    const batchTx = TransactionModel.create(
        validatorKeys.publicKey,
        validatorKeys.publicKey,
        TransactionType.BATCH,
        0,
        0.00001, // Fast fee
        1,
        { transactions: [innerTxA, innerTxB] },
        validatorKeys.publicKey
    );
    batchTx.sender_signature = KeyManager.sign(batchTx.getSignableData(), validatorKeys.privateKey);

    console.log('Batch transaction created. Adding block...');

    const result = blockchain.addBlock([batchTx], validatorKeys.publicKey, 'mock_sig');

    if (result.success) {
        console.log('✅ Batch Accepted');
        // Verify state
        const stateA = blockchain.getAccountState(userA.publicKey);
        const stateB = blockchain.getAccountState(userB.publicKey);

        let success = true;

        if (stateA?.balance === 49 && stateA.nonce === 1) {
            console.log('✅ User A State Updated (Balance 50->49, Nonce 0->1)');
        } else {
            console.error('❌ User A State Error:', stateA);
            success = false;
        }

        if (stateB?.balance === 48 && stateB.nonce === 1) {
            console.log('✅ User B State Updated (Balance 50->48, Nonce 0->1)');
        } else {
            console.error('❌ User B State Error:', stateB);
            success = false;
        }

        if (success) console.log('✅ ALL TESTS PASSED');

    } else {
        console.error('❌ Batch Failed:', result);
    }
}
runTest().catch(console.error);
