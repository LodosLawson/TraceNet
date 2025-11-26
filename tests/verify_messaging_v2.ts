import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { TOKEN_CONFIG } from '../src/economy/TokenConfig';

async function testMessagingAndFees() {
    console.log('--- Starting Encrypted Messaging & Node Fee Verification ---');

    // 1. Initialize Blockchain with a Node Owner (Validator)
    const nodeOwnerKeys = KeyManager.generateWalletFromMnemonic();
    const blockchain = new Blockchain(nodeOwnerKeys.address);
    console.log(`Node Owner (Validator): ${nodeOwnerKeys.address}`);

    // 2. Create two users
    const user1 = KeyManager.generateWalletFromMnemonic();
    const user2 = KeyManager.generateWalletFromMnemonic();
    console.log(`User 1: ${user1.address}`);
    console.log(`User 2: ${user2.address}`);

    // 3. Fund User 1
    const fundingAmount = 100 * 100000000; // 100 LT
    const fundingTx = TransactionModel.create(
        'SYSTEM',
        user1.address,
        TransactionType.REWARD,
        fundingAmount,
        0,
        { note: 'Funding User 1' }
    );

    // Add block produced by Node Owner
    blockchain.addBlock([fundingTx], nodeOwnerKeys.address, 'sig');

    // 4. Test Encrypted Message
    console.log('\n--- Testing Encrypted Message ---');
    const secretMessage = "This is a top secret message for User 2 only.";

    // Encrypt: User 1 encrypts for User 2 using ENCRYPTION keys
    const encryptedContent = KeyManager.encryptForUser(
        secretMessage,
        user1.encryptionPrivateKey, // Sender Encryption Private Key
        user2.encryptionPublicKey   // Recipient Encryption Public Key
    );

    console.log(`Original: ${secretMessage}`);
    console.log(`Encrypted: ${encryptedContent.substring(0, 30)}...`);

    // Create Transaction
    const msgFee = TOKEN_CONFIG.MESSAGE_FEE; // Should be 100 (0.000001 LT)
    console.log(`Message Fee: ${msgFee} units (${msgFee / 100000000} LT)`);

    const messageTx = TransactionModel.create(
        user1.address,
        user2.address,
        TransactionType.PRIVATE_MESSAGE,
        0,
        msgFee,
        {
            message: encryptedContent,
            encrypted: true
        }
    );

    messageTx.sender_public_key = user1.publicKey;
    messageTx.sender_signature = KeyManager.sign(messageTx.getSignableData(), user1.privateKey);

    // Add block produced by Node Owner
    const blockResult = blockchain.addBlock([messageTx], nodeOwnerKeys.address, 'sig');

    if (blockResult.success) {
        console.log('Encrypted message block added successfully.');
    } else {
        console.error('Failed to add block:', blockResult.error);
        return;
    }

    // 5. Verify Decryption
    console.log('\n--- Verifying Decryption ---');
    // User 2 decrypts using ENCRYPTION keys
    try {
        const decrypted = KeyManager.decryptFromUser(
            encryptedContent,
            user2.encryptionPrivateKey, // Recipient Encryption Private Key
            user1.encryptionPublicKey   // Sender Encryption Public Key
        );

        if (decrypted === secretMessage) {
            console.log('✅ DECRYPTION SUCCESS: User 2 successfully read the message.');
        } else {
            console.error('❌ DECRYPTION FAILED: Content mismatch.');
        }
    } catch (e) {
        console.error('❌ DECRYPTION FAILED: Error decrypting.', e);
    }

    // 6. Verify Node Fee (Validator Reward)
    console.log('\n--- Verifying Node Owner Fees ---');
    const nodeBalance = blockchain.getBalance(nodeOwnerKeys.address);
    console.log(`Node Owner Balance: ${nodeBalance} units`);

    if (nodeBalance >= msgFee) {
        console.log(`✅ FEE VERIFICATION SUCCESS: Node Owner received ${nodeBalance} units.`);
    } else {
        console.error(`❌ FEE VERIFICATION FAILED: Node Owner balance ${nodeBalance} < Expected ${msgFee}`);
    }
}

testMessagingAndFees().catch(console.error);
