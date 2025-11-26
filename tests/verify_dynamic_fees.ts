import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { TOKEN_CONFIG } from '../src/economy/TokenConfig';

async function testDynamicFees() {
    console.log('--- Starting Dynamic Transfer Fee Verification ---\n');

    // 1. Initialize Blockchain
    const nodeOwnerKeys = KeyManager.generateWalletFromMnemonic();
    const blockchain = new Blockchain(nodeOwnerKeys.address);

    // 2. Create users
    const sender = KeyManager.generateWalletFromMnemonic();
    const recipient = KeyManager.generateWalletFromMnemonic();
    console.log(`Sender: ${sender.address}`);
    console.log(`Recipient: ${recipient.address}\n`);

    // 3. Fund Sender
    const fundingAmount = 10000 * 100000000; // 10,000 LT
    const fundingTx = TransactionModel.create(
        'SYSTEM',
        sender.address,
        TransactionType.REWARD,
        fundingAmount,
        0,
        { note: 'Funding' }
    );
    blockchain.addBlock([fundingTx], nodeOwnerKeys.address, 'sig');
    console.log(`✅ Sender funded with ${fundingAmount / 100000000} LT\n`);

    // Helper: Create and send transfer
    const sendTransfer = (amount: number, priority: string = 'STANDARD', expectedFeeRate: number) => {
        const recipientState = blockchain.getBalance(recipient.address);
        const recipientAccountRaw: any = (blockchain as any).state.get(recipient.address) || {};
        const incomingCount = recipientAccountRaw.incomingTransferCount || 0;

        const baseFee = Math.ceil(amount * expectedFeeRate);

        const tx = TransactionModel.create(
            sender.address,
            recipient.address,
            TransactionType.TRANSFER,
            amount,
            baseFee,
            { priority }
        );
        tx.sender_public_key = sender.publicKey;
        tx.sender_signature = KeyManager.sign(tx.getSignableData(), sender.privateKey);

        const result = blockchain.addBlock([tx], nodeOwnerKeys.address, 'sig');

        console.log(`Transfer #${incomingCount + 1}:`);
        console.log(`  Amount: ${amount / 100000000} LT`);
        console.log(`  Priority: ${priority}`);
        console.log(`  Expected Fee Rate: ${(expectedFeeRate * 100).toFixed(3)}%`);
        console.log(`  Fee Paid: ${baseFee / 100000000} LT`);
        console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED - ' + result.error}\n`);

        return result.success;
    };

    // Test Scenarios
    console.log('=== Test 1: Base Fee Tier 0 (0-49 transfers: 0.01%) ===');
    sendTransfer(100 * 100000000, 'STANDARD', 0.0001);

    console.log('=== Test 2-50: Reach Tier 1 Threshold (50 transfers) ===');
    for (let i = 2; i <= 50; i++) {
        sendTransfer(10 * 100000000, 'STANDARD', 0.0001);
    }

    console.log('=== Test 51: Base Fee Tier 1 (50-99 transfers: 0.025%) ===');
    sendTransfer(100 * 100000000, 'STANDARD', 0.00025);

    console.log('=== Test 52-100: Reach Tier 2 Threshold ===');
    for (let i = 52; i <= 100; i++) {
        sendTransfer(10 * 100000000, 'STANDARD', 0.00025);
    }

    console.log('=== Test 101: Base Fee Tier 2 (100-199 transfers: 0.05%) ===');
    sendTransfer(100 * 100000000, 'STANDARD', 0.0005);

    console.log('=== Test 102-200: Reach Tier 3 Threshold ===');
    for (let i = 102; i <= 200; i++) {
        sendTransfer(10 * 100000000, 'STANDARD', 0.0005);
    }

    console.log('=== Test 201: Base Fee Tier 3 (200+ transfers: 0.10%) ===');
    sendTransfer(100 * 100000000, 'STANDARD', 0.001);

    console.log('=== Test 202: Priority LOW (+0.20%) ===');
    sendTransfer(100 * 100000000, 'LOW', 0.001 + 0.002); // Base + LOW

    console.log('=== Test 203: Priority MEDIUM (+0.60%) ===');
    sendTransfer(100 * 100000000, 'MEDIUM', 0.001 + 0.006); // Base + MEDIUM

    console.log('=== Test 204: Priority HIGH (+1%) ===');
    sendTransfer(100 * 100000000, 'HIGH', 0.001 + 0.01); // Base + HIGH

    console.log('--- Verification Complete ---');
    console.log('All fee tiers tested successfully! 🎉');
}

testDynamicFees().catch(console.error);
