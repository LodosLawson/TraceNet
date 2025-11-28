import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { TOKEN_CONFIG } from '../src/economy/TokenConfig';

async function testNodeFeeDistribution() {
    console.log('--- Testing Node Wallet Fee Distribution ---\n');

    // 1. Create wallets
    const nodeOwnerWallet = KeyManager.generateWalletFromMnemonic();
    const userWallet1 = KeyManager.generateWalletFromMnemonic();
    const userWallet2 = KeyManager.generateWalletFromMnemonic();
    const contentCreator = KeyManager.generateWalletFromMnemonic();

    console.log(`Node Owner Wallet: ${nodeOwnerWallet.address}`);
    console.log(`User 1: ${userWallet1.address}`);
    console.log(`User 2: ${userWallet2.address}`);
    console.log(`Content Creator: ${contentCreator.address}\n`);

    const blockchain = new Blockchain('GENESIS_NODE');

    // 2. Fund users
    const fundAmount = 1000 * 100000000; // 1000 LT
    const fund1 = TransactionModel.create('SYSTEM', userWallet1.address, TransactionType.REWARD, fundAmount, 0, {});
    const fund2 = TransactionModel.create('SYSTEM', userWallet2.address, TransactionType.REWARD, fundAmount, 0, {});

    blockchain.addBlock([fund1, fund2], 'GENESIS', 'sig'); // Genesis block, no node wallet
    console.log(`✅ Users funded\n`);

    // 3. Test Transfer with node wallet
    console.log('=== Test 1: Transfer with node wallet (Block #1) ===');
    const transferAmount = 100 * 100000000;
    const transferFee = 2000; // Small fee for testing
    const transferTx = TransactionModel.create(
        userWallet1.address,
        userWallet2.address,
        TransactionType.TRANSFER,
        transferAmount,
        transferFee,
        {}
    );
    transferTx.sender_public_key = userWallet1.publicKey;
    transferTx.sender_signature = KeyManager.sign(transferTx.getSignableData(), userWallet1.privateKey);

    blockchain.addBlock([transferTx], 'NODE_1', 'sig', nodeOwnerWallet.address);

    const nodeBalance1 = blockchain.getBalance(nodeOwnerWallet.address);
    const treasuryBalance1 = blockchain.getBalance('TREASURY_MAIN');

    console.log(`Transfer fee: ${transferFee / 100000000} LT`);
    console.log(`Node owner balance: ${nodeBalance1 / 100000000} LT (expected: ${(transferFee * 0.5) / 100000000})`);
    console.log(`Treasury balance: ${treasuryBalance1 / 100000000} LT (expected: ${(transferFee * 0.5) / 100000000})`);
    console.log(`✅ Transfer with node wallet test ${nodeBalance1 === transferFee * 0.5 ? 'PASSED' : 'FAILED'}\n`);

    // 4. Test Social action (LIKE) with node wallet
    console.log('=== Test 2: LIKE with node wallet (Block #2) ===');
    const likeFee = TOKEN_CONFIG.LIKE_FEE; // 2000
    const likeTx = TransactionModel.create(
        userWallet1.address,
        contentCreator.address,
        TransactionType.LIKE,
        0,
        likeFee,
        { content_id: 'test_content_1' }
    );
    likeTx.sender_public_key = userWallet1.publicKey;
    likeTx.sender_signature = KeyManager.sign(likeTx.getSignableData(), userWallet1.privateKey);

    blockchain.addBlock([likeTx], 'NODE_1', 'sig', nodeOwnerWallet.address);

    const nodeBalance2 = blockchain.getBalance(nodeOwnerWallet.address);
    const contentCreatorBalance = blockchain.getBalance(contentCreator.address);
    const treasuryBalance2 = blockchain.getBalance('TREASURY_MAIN');

    const expectedNodeTotal = transferFee * 0.5 + likeFee * 0.5;
    const expectedContentOwner = Math.floor((likeFee - likeFee * 0.5) * 0.5); // 25% of total
    const expectedTreasuryTotal = transferFee * 0.5 + (likeFee - likeFee * 0.5 - expectedContentOwner);

    console.log(`Like fee: ${likeFee / 100000000} LT`);
    console.log(`Node owner balance: ${nodeBalance2 / 100000000} LT (expected: ${expectedNodeTotal / 100000000})`);
    console.log(`Content creator balance: ${contentCreatorBalance / 100000000} LT (expected: ${expectedContentOwner / 100000000})`);
    console.log(`Treasury balance: ${treasuryBalance2 / 100000000} LT (expected: ${expectedTreasuryTotal / 100000000})`);
    console.log(`✅ LIKE with node wallet test ${nodeBalance2 === expectedNodeTotal ? 'PASSED' : 'FAILED'}\n`);

    // 5. Test Transfer WITHOUT node wallet
    console.log('=== Test 3: Transfer WITHOUT node wallet (Block #3) ===');
    const transferTx2 = TransactionModel.create(
        userWallet2.address,
        userWallet1.address,
        TransactionType.TRANSFER,
        50 * 100000000,
        transferFee,
        {}
    );
    transferTx2.sender_public_key = userWallet2.publicKey;
    transferTx2.sender_signature = KeyManager.sign(transferTx2.getSignableData(), userWallet2.privateKey);

    const beforeTreasury = blockchain.getBalance('TREASURY_MAIN');
    blockchain.addBlock([transferTx2], 'NODE_2', 'sig'); // No node wallet

    const afterTreasury = blockchain.getBalance('TREASURY_MAIN');
    const treasuryIncrease = afterTreasury - beforeTreasury;

    console.log(`Transfer fee: ${transferFee / 100000000} LT`);
    console.log(`Treasury increase: ${treasuryIncrease / 100000000} LT (expected: ${transferFee / 100000000})`);
    console.log(`✅ Transfer without node wallet test ${treasuryIncrease === transferFee ? 'PASSED' : 'FAILED'}\n`);

    // 6. Test Social action (COMMENT) WITHOUT node wallet
    console.log('=== Test 4: COMMENT WITHOUT node wallet (Block #4) ===');
    const commentFee = TOKEN_CONFIG.COMMENT_FEE; // 2000
    const commentTx = TransactionModel.create(
        userWallet2.address,
        contentCreator.address,
        TransactionType.COMMENT,
        0,
        commentFee,
        { content_id: 'test_content_1', text: 'Great content!' }
    );
    commentTx.sender_public_key = userWallet2.publicKey;
    commentTx.sender_signature = KeyManager.sign(commentTx.getSignableData(), userWallet2.privateKey);

    const beforeContentCreator = blockchain.getBalance(contentCreator.address);
    const beforeTreasury2 = blockchain.getBalance('TREASURY_MAIN');

    blockchain.addBlock([commentTx], 'NODE_2', 'sig'); // No node wallet

    const afterContentCreator = blockchain.getBalance(contentCreator.address);
    const afterTreasury2 = blockchain.getBalance('TREASURY_MAIN');

    const contentCreatorIncrease = afterContentCreator - beforeContentCreator;
    const treasuryIncrease2 = afterTreasury2 - beforeTreasury2;

    console.log(`Comment fee: ${commentFee / 100000000} LT`);
    console.log(`Content creator increase: ${contentCreatorIncrease / 100000000} LT (expected: ${Math.floor(commentFee * 0.5) / 100000000})`);
    console.log(`Treasury increase: ${treasuryIncrease2 / 100000000} LT (expected: ${(commentFee - Math.floor(commentFee * 0.5)) / 100000000})`);
    console.log(`✅ COMMENT without node wallet test ${contentCreatorIncrease === Math.floor(commentFee * 0.5) ? 'PASSED' : 'FAILED'}\n`);

    console.log('--- All Node Fee Distribution Tests Complete ---');
}

testNodeFeeDistribution().catch(console.error);
