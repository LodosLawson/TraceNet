
import { Blockchain } from '../blockchain/core/Blockchain';
import { TransactionType, InnerTransaction } from '../blockchain/models/Transaction';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import { TOKEN_CONFIG } from '../economy/TokenConfig';

async function verifyBalanceDeduction() {
    console.log('Starting Balance Deduction Verification...');

    // 1. Initialize Blockchain
    const blockchain = new Blockchain('VALIDATOR_1');
    const validatorKeys = KeyManager.generateKeyPair();
    const userKeys = KeyManager.generateKeyPair();
    const userAddress = userKeys.publicKey; // Simple address for now

    // 2. Fund User (Force State)
    const initialBalance = 1000;
    blockchain.forceSetAccountState(userAddress, {
        address: userAddress,
        balance: initialBalance,
        nonce: 0,
        public_key: userKeys.publicKey
    });

    console.log(`[Setup] User Balance: ${blockchain.getBalance(userAddress)}`);

    // 3. Create Inner Transaction (LIKE)
    const likeFee = 500; // Normal Tier Fee
    const innerTx: any = {
        type: TransactionType.LIKE,
        from_wallet: userAddress,
        to_wallet: 'CONTENT_CREATOR',
        amount: likeFee, // User pays this
        payload: { content_id: 'post_123' },
        timestamp: Date.now(),
        nonce: 1,
        sender_public_key: userKeys.publicKey,
        fee: 0 // Inner tx technically has no "fee" field in interface, amount covers cost
    };

    // Sign Inner Tx
    const signable = JSON.stringify(innerTx); // Simplified signing for test
    // Real logic uses sortObject, but we need to match what verify() expects. 
    // Let's use the helper if possible, or manual.
    // Actually, Blockchain.ts uses sortObject. We need to match that.

    // Quick Sort Helper
    const sortObject = (obj: any): any => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(sortObject);
        return Object.keys(obj).sort().reduce((sorted: any, key: string) => {
            sorted[key] = sortObject(obj[key]);
            return sorted;
        }, {});
    };

    // Construct raw inner compatible with Blockchain.ts structure
    const rawInner = {
        type: innerTx.type,
        from_wallet: innerTx.from_wallet,
        to_wallet: innerTx.to_wallet,
        amount: innerTx.amount,
        payload: innerTx.payload,
        timestamp: innerTx.timestamp,
        nonce: innerTx.nonce,
        max_wait_time: undefined,
        sender_public_key: innerTx.sender_public_key
    };
    const signature = KeyManager.sign(JSON.stringify(sortObject(rawInner)), userKeys.privateKey);
    innerTx.signature = signature;

    // 4. Create Batch Transaction (Validator)
    const batchTx: any = {
        tx_id: 'batch_1',
        from_wallet: 'VALIDATOR_1',
        to_wallet: 'VALIDATOR_1',
        type: TransactionType.BATCH,
        amount: 0,
        fee: 0,
        timestamp: Date.now(),
        nonce: 1,
        payload: {
            transactions: [innerTx]
        },
        sender_public_key: validatorKeys.publicKey
    };

    // Sign Batch
    // MATCH TransactionModel.getSignableData() order EXACTLY:
    // tx_id, from_wallet, to_wallet, type, payload, amount, fee, timestamp, nonce, valid_until, sender_public_key
    const batchSignableFixed = {
        tx_id: batchTx.tx_id,
        from_wallet: batchTx.from_wallet,
        to_wallet: batchTx.to_wallet,
        type: batchTx.type,
        payload: batchTx.payload,
        amount: batchTx.amount,
        fee: batchTx.fee,
        timestamp: batchTx.timestamp,
        nonce: batchTx.nonce,
        valid_until: undefined,
        sender_public_key: batchTx.sender_public_key
    };

    // Do NOT sortObject the outer wrapper, because Transaction.ts doesn't.
    // However, verify() likely just stringifies.
    // Let's assume Transaction.ts returns the object as written.
    // We should stringify it directly.
    batchTx.sender_signature = KeyManager.sign(JSON.stringify(batchSignableFixed), validatorKeys.privateKey);

    // Also need to set Validator state so it has a public key for verification
    blockchain.forceSetAccountState('VALIDATOR_1', {
        address: 'VALIDATOR_1',
        balance: 0,
        nonce: 0,
        public_key: validatorKeys.publicKey
    });

    // 5. Apply Transaction
    console.log('[Test] Applying Batch...');
    const result = blockchain['applyTransactionToState'](batchTx, blockchain['state'], 'VALIDATOR_1', 1); // Access private method for test

    if (!result.success) {
        console.error('Transaction Failed:', result.error);
        process.exit(1);
    }

    // 6. Verify Balances
    const finalBalance = blockchain.getBalance(userAddress);
    console.log(`[Result] User Final Balance: ${finalBalance}`);

    // Check Treasury/Pool Balances
    const poolBalance = blockchain.getBalance('VALIDATOR_POOL');
    const devBalance = blockchain.getBalance('TREASURY_DEV');
    const recycleBalance = blockchain.getBalance('TREASURY_RECYCLE');
    const creatorBalance = blockchain.getBalance('CONTENT_CREATOR');
    const validatorBalance = blockchain.getBalance('VALIDATOR_1');

    console.log(`[Result] Validator Pool (37%): ${poolBalance}`);
    console.log(`[Result] Dev Treasury (8%): ${devBalance}`);
    console.log(`[Result] Recycle (15%): ${recycleBalance}`);
    console.log(`[Result] Creator (40%): ${creatorBalance}`);
    console.log(`[Result] Validator Sender: ${validatorBalance}`);

    if (finalBalance === initialBalance - likeFee) {
        console.log('✅ SUCCESS: User balance deducted correctly.');
    } else {
        console.error(`❌ FAILURE: User balance mismatch. Expected ${initialBalance - likeFee}, Got ${finalBalance}`);
        process.exit(1);
    }

    // Expected Splits for 500 Fee (V2.6 Recycle):
    // Pool:    185 (37%)
    // Dev:     40  (8%)
    // Recycle: 75  (15%)
    // Creator: 200 (40%)

    if (poolBalance === 185 && devBalance === 40 && recycleBalance === 75 && creatorBalance === 200) {
        console.log('✅ SUCCESS: Fee distributed correctly to System/Creator/Recycle.');
    } else {
        console.error(`❌ FAILURE: Fee split mismatch.`);
        console.error(`Expected Pool: 185, Got: ${poolBalance}`);
        console.error(`Expected Dev: 40, Got: ${devBalance}`);
        console.error(`Expected Recycle: 75, Got: ${recycleBalance}`);
        console.error(`Expected Creator: 200, Got: ${creatorBalance}`);
        process.exit(1);
    }

    if (validatorBalance === 0) {
        console.log('✅ SUCCESS: Validator balance unchanged (will be rewarded via Pool later).');
    } else {
        console.warn(`⚠️ NOTE: Validator received funds? Balance: ${validatorBalance}`);
    }
}

verifyBalanceDeduction();
