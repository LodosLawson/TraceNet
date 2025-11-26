import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { Mempool } from '../src/node/Mempool';

async function testMessaging() {
    console.log('--- Starting Messaging System Verification ---');

    // 1. Initialize Blockchain
    const validatorKeys = KeyManager.generateWalletFromMnemonic();
    const blockchain = new Blockchain(validatorKeys.address);

    console.log('Blockchain initialized.');

    // 2. Create two users
    const user1 = KeyManager.generateWalletFromMnemonic();
    const user2 = KeyManager.generateWalletFromMnemonic();

    console.log(`User 1: ${user1.address}`);
    console.log(`User 2: ${user2.address}`);

    // 3. Fund User 1 via REWARD transaction
    const fundingAmount = 100 * 100000000; // 100 LT

    const fundingTx = TransactionModel.create(
        'SYSTEM',
        user1.address,
        TransactionType.REWARD,
        fundingAmount,
        0,
        { note: 'Funding User 1' }
    );

    const fundingBlock = blockchain.addBlock(
        [fundingTx],
        validatorKeys.address,
        'signature_placeholder'
    );

    if (fundingBlock.success) {
        console.log('Funding block added successfully.');
    } else {
        console.error('Failed to add funding block:', fundingBlock.error);
        return;
    }

    const balance1 = blockchain.getBalance(user1.address);
    console.log(`User 1 Balance: ${balance1 / 100000000} LT`);

    if (balance1 < fundingAmount) {
        console.error('User 1 was not funded correctly.');
        return;
    }

    // 4. Send MESSAGE_PAYMENT from User 1 to User 2
    console.log('\n--- Testing MESSAGE_PAYMENT ---');
    const messageContent = "Hello User 2, this is a paid message!";
    const paymentAmount = 1 * 100000000; // 1 LT payment to recipient
    const txFee = 0.01 * 100000000; // 0.01 LT fee

    const messageTx = TransactionModel.create(
        user1.address,
        user2.address,
        TransactionType.MESSAGE_PAYMENT,
        paymentAmount,
        txFee,
        {
            message: messageContent,
            message_type: 'text',
            timestamp: Date.now()
        }
    );

    messageTx.sender_public_key = user1.publicKey;
    messageTx.sender_signature = KeyManager.sign(messageTx.getSignableData(), user1.privateKey);

    const msgBlock = blockchain.addBlock(
        [messageTx],
        validatorKeys.address,
        'signature_placeholder'
    );

    if (msgBlock.success) {
        console.log('Message block added successfully.');
    } else {
        console.error('Failed to add message block:', msgBlock.error);
        return;
    }

    const balance2 = blockchain.getBalance(user2.address);
    console.log(`User 2 Balance: ${balance2 / 100000000} LT`);

    const latestBlock = blockchain.getLatestBlock();
    const txFound = latestBlock.transactions.find(tx => tx.tx_id === messageTx.tx_id);

    if (txFound && balance2 === paymentAmount) {
        console.log('MESSAGE_PAYMENT verified: Transaction found and balance updated.');
    } else {
        console.error('MESSAGE_PAYMENT failed verification.');
    }

    // 5. Test PRIVATE_MESSAGE (0 amount)
    console.log('\n--- Testing PRIVATE_MESSAGE ---');
    const privateMsgContent = "This is a private message (0 value transfer).";

    const privateMsgTx = TransactionModel.create(
        user1.address,
        user2.address,
        TransactionType.PRIVATE_MESSAGE,
        0, // 0 Amount
        txFee,
        {
            message: privateMsgContent,
            encrypted: false
        }
    );

    privateMsgTx.sender_public_key = user1.publicKey;
    privateMsgTx.sender_signature = KeyManager.sign(privateMsgTx.getSignableData(), user1.privateKey);

    const privateMsgBlock = blockchain.addBlock(
        [privateMsgTx],
        validatorKeys.address,
        'signature_placeholder'
    );

    if (privateMsgBlock.success) {
        console.log('Private message block added successfully.');
        const pBlock = blockchain.getLatestBlock();
        const pTx = pBlock.transactions.find(tx => tx.tx_id === privateMsgTx.tx_id);
        if (pTx) {
            console.log('PRIVATE_MESSAGE verified: Transaction found in block.');
        } else {
            console.error('PRIVATE_MESSAGE not found in block.');
        }
    } else {
        console.error('Failed to add private message block:', privateMsgBlock.error);
    }

    // 6. Verify Treasury Balance (Fees)
    console.log('\n--- Verifying Treasury Fees ---');
    const treasuryAddress = 'TREASURY_MAIN';
    const treasuryBalance = blockchain.getBalance(treasuryAddress);
    console.log(`Treasury Balance: ${treasuryBalance / 100000000} LT`);

    // Expected fees: 0.01 (Message) + 0.01 (Private Message) = 0.02 LT
    const expectedFees = (txFee * 2);

    if (treasuryBalance >= expectedFees) {
        console.log('✅ FEE VERIFICATION SUCCESS: Treasury received fees.');
    } else {
        console.error(`❌ FEE VERIFICATION FAILED: Treasury balance ${treasuryBalance} < Expected ${expectedFees}`);
    }
}

testMessaging().catch(console.error);
