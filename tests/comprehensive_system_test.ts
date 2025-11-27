import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { TOKEN_CONFIG } from '../src/economy/TokenConfig';

async function comprehensiveSystemTest() {
    console.log('='.repeat(80));
    console.log('TRACENET BLOCKCHAIN - COMPREHENSIVE SYSTEM TEST');
    console.log('='.repeat(80));

    let errorCount = 0;
    let warningCount = 0;

    // Initialize
    console.log('\n📦 1. INITIALIZING BLOCKCHAIN');
    const nodeOwner = KeyManager.generateWalletFromMnemonic();
    const blockchain = new Blockchain(nodeOwner.address);
    console.log(`✅ Node Owner: ${nodeOwner.address}`);

    // Create users
    console.log('\n👥 2. CREATING USERS');
    const alice = KeyManager.generateWalletFromMnemonic();
    const bob = KeyManager.generateWalletFromMnemonic();
    const charlie = KeyManager.generateWalletFromMnemonic();

    console.log(`✅ Alice: ${alice.address}`);
    console.log(`✅ Bob: ${bob.address}`);
    console.log(`✅ Charlie: ${charlie.address}`);

    // Fund users
    console.log('\n💰 3. FUNDING USERS');
    const fundAmount = 1000 * 100000000; // 1000 LT each

    const fundAlice = TransactionModel.create('SYSTEM', alice.address, TransactionType.REWARD, fundAmount, 0, {});
    const fundBob = TransactionModel.create('SYSTEM', bob.address, TransactionType.REWARD, fundAmount, 0, {});
    const fundCharlie = TransactionModel.create('SYSTEM', charlie.address, TransactionType.REWARD, fundAmount, 0, {});

    blockchain.addBlock([fundAlice, fundBob, fundCharlie], nodeOwner.address, 'sig');

    console.log(`✅ Alice balance: ${blockchain.getBalance(alice.address) / 100000000} LT`);
    console.log(`✅ Bob balance: ${blockchain.getBalance(bob.address) / 100000000} LT`);
    console.log(`✅ Charlie balance: ${blockchain.getBalance(charlie.address) / 100000000} LT`);

    // TEST 1: Simple Transfer
    console.log('\n💸 4. TEST: SIMPLE TRANSFER (Alice → Bob)');
    try {
        const transferAmount = 50 * 100000000; // 50 LT
        const transferTx = TransactionModel.create(
            alice.address,
            bob.address,
            TransactionType.TRANSFER,
            transferAmount,
            10000, // Fee
            {}
        );

        transferTx.sender_public_key = alice.publicKey;
        transferTx.sender_signature = KeyManager.sign(transferTx.getSignableData(), alice.privateKey);

        const result = blockchain.addBlock([transferTx], nodeOwner.address, 'sig');

        if (result.success) {
            const aliceNewBalance = blockchain.getBalance(alice.address);
            const bobNewBalance = blockchain.getBalance(bob.address);
            const nodeBalance = blockchain.getBalance(nodeOwner.address);

            console.log(`✅ Transfer successful`);
            console.log(`   Alice: ${aliceNewBalance / 100000000} LT (sent 50 + fee)`);
            console.log(`   Bob: ${bobNewBalance / 100000000} LT (received 50)`);
            console.log(`   Node: ${nodeBalance / 100000000} LT (fee collected)`);

            // Verify balances
            if (bobNewBalance !== (1000 * 100000000 + transferAmount)) {
                console.error(`❌ ERROR: Bob's balance incorrect!`);
                errorCount++;
            }
        } else {
            console.error(`❌ Transfer failed: ${result.error}`);
            errorCount++;
        }
    } catch (e) {
        console.error(`❌ EXCEPTION in transfer:`, e);
        errorCount++;
    }

    // TEST 2: Dynamic Fee Transfer
    console.log('\n💸 5. TEST: DYNAMIC FEE TRANSFER (Bob → Charlie)');
    try {
        const amount = 100 * 100000000; // 100 LT

        // Get Charlie's state to calculate fee
        const charlieAccount = (blockchain as any).state.get(charlie.address) || {
            address: charlie.address,
            balance: 0,
            nonce: 0,
            incomingTransferCount: 0
        };

        const calculatedFee = (blockchain as any).calculateTransferFee(charlieAccount, amount, 'STANDARD');

        console.log(`   Charlie incoming transfers: ${charlieAccount.incomingTransferCount || 0}`);
        console.log(`   Calculated fee: ${calculatedFee / 100000000} LT`);

        const transferTx = TransactionModel.create(
            bob.address,
            charlie.address,
            TransactionType.TRANSFER,
            amount,
            calculatedFee,
            { priority: 'STANDARD' }
        );

        transferTx.sender_public_key = bob.publicKey;
        transferTx.sender_signature = KeyManager.sign(transferTx.getSignableData(), bob.privateKey);

        const result = blockchain.addBlock([transferTx], nodeOwner.address, 'sig');

        if (result.success) {
            console.log(`✅ Dynamic fee transfer successful`);
            console.log(`   Bob: ${blockchain.getBalance(bob.address) / 100000000} LT`);
            console.log(`   Charlie: ${blockchain.getBalance(charlie.address) / 100000000} LT`);
        } else {
            console.error(`❌ Transfer failed: ${result.error}`);
            errorCount++;
        }
    } catch (e) {
        console.error(`❌ EXCEPTION in dynamic fee transfer:`, e);
        errorCount++;
    }

    // TEST 3: Encrypted Messaging
    console.log('\n💬 6. TEST: ENCRYPTED MESSAGING (Alice → Bob)');
    try {
        const secretMessage = "Hello Bob, this is a secret message from Alice!";

        // Encrypt client-side
        const encryptedMsg = KeyManager.encryptForUser(
            secretMessage,
            alice.encryptionPrivateKey,
            bob.encryptionPublicKey
        );

        console.log(`   Original: "${secretMessage}"`);
        console.log(`   Encrypted: ${encryptedMsg.substring(0, 40)}...`);

        const msgTx = TransactionModel.create(
            alice.address,
            bob.address,
            TransactionType.PRIVATE_MESSAGE,
            0,
            TOKEN_CONFIG.MESSAGE_FEE,
            { message: encryptedMsg, encrypted: true }
        );

        msgTx.sender_public_key = alice.publicKey;
        msgTx.sender_signature = KeyManager.sign(msgTx.getSignableData(), alice.privateKey);

        const result = blockchain.addBlock([msgTx], nodeOwner.address, 'sig');

        if (result.success) {
            console.log(`✅ Message sent to blockchain`);

            // Bob decrypts client-side
            try {
                const decrypted = KeyManager.decryptFromUser(
                    encryptedMsg,
                    bob.encryptionPrivateKey,
                    alice.encryptionPublicKey
                );

                if (decrypted === secretMessage) {
                    console.log(`✅ Bob decrypted: "${decrypted}"`);
                } else {
                    console.error(`❌ Decryption mismatch!`);
                    errorCount++;
                }
            } catch (e) {
                console.error(`❌ Decryption failed:`, e);
                errorCount++;
            }
        } else {
            console.error(`❌ Message send failed: ${result.error}`);
            errorCount++;
        }
    } catch (e) {
        console.error(`❌ EXCEPTION in messaging:`, e);
        errorCount++;
    }

    // TEST 4: Invalid Transfer (Insufficient Balance)
    console.log('\n⚠️ 7. TEST: INVALID TRANSFER (Insufficient Balance)');
    try {
        const hugeAmount = 10000 * 100000000; // More than Alice has

        const invalidTx = TransactionModel.create(
            alice.address,
            bob.address,
            TransactionType.TRANSFER,
            hugeAmount,
            10000,
            {}
        );

        invalidTx.sender_public_key = alice.publicKey;
        invalidTx.sender_signature = KeyManager.sign(invalidTx.getSignableData(), alice.privateKey);

        const result = blockchain.addBlock([invalidTx], nodeOwner.address, 'sig');

        if (!result.success) {
            console.log(`✅ Correctly rejected: ${result.error}`);
        } else {
            console.error(`❌ ERROR: Should have rejected insufficient balance!`);
            errorCount++;
        }
    } catch (e) {
        console.log(`✅ Exception caught (expected): ${e instanceof Error ? e.message : e}`);
    }

    // TEST 5: Blockchain Integrity
    console.log('\n🔗 8. TEST: BLOCKCHAIN INTEGRITY');
    try {
        const chain = blockchain.getChain();
        console.log(`   Chain length: ${chain.length} blocks`);

        // Verify chain continuity
        for (let i = 1; i < chain.length; i++) {
            if (chain[i].previous_hash !== chain[i - 1].hash) {
                console.error(`❌ Chain broken at block ${i}!`);
                errorCount++;
            }
        }

        console.log(`✅ Chain integrity verified`);

        // Count transactions
        let totalTx = 0;
        for (const block of chain) {
            totalTx += block.transactions.length;
        }
        console.log(`   Total transactions: ${totalTx}`);

    } catch (e) {
        console.error(`❌ EXCEPTION in integrity check:`, e);
        errorCount++;
    }

    // TEST 6: State Consistency
    console.log('\n📊 9. TEST: STATE CONSISTENCY');
    try {
        const aliceBalance = blockchain.getBalance(alice.address);
        const bobBalance = blockchain.getBalance(bob.address);
        const charlieBalance = blockchain.getBalance(charlie.address);
        const nodeBalance = blockchain.getBalance(nodeOwner.address);

        console.log(`   Alice: ${aliceBalance / 100000000} LT`);
        console.log(`   Bob: ${bobBalance / 100000000} LT`);
        console.log(`   Charlie: ${charlieBalance / 100000000} LT`);
        console.log(`   Node Owner: ${nodeBalance / 100000000} LT`);

        // Total should equal initial funding + any rewards
        const totalInSystem = aliceBalance + bobBalance + charlieBalance + nodeBalance;
        const expectedTotal = 3000 * 100000000; // 3 users × 1000 LT

        console.log(`   Total in system: ${totalInSystem / 100000000} LT`);
        console.log(`   Expected (3000 LT funding): ${expectedTotal / 100000000} LT`);

        if (totalInSystem === expectedTotal) {
            console.log(`✅ State consistency verified (no coins created/destroyed)`);
        } else {
            console.error(`❌ State inconsistency! Difference: ${(totalInSystem - expectedTotal) / 100000000} LT`);
            errorCount++;
        }
    } catch (e) {
        console.error(`❌ EXCEPTION in state check:`, e);
        errorCount++;
    }

    // Final Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Errors: ${errorCount}`);
    console.log(`Total Warnings: ${warningCount}`);

    if (errorCount === 0) {
        console.log('\n✅ ALL TESTS PASSED - NO BUGS FOUND!');
    } else {
        console.log(`\n❌ FOUND ${errorCount} ERROR(S) - NEEDS ATTENTION`);
    }

    console.log('='.repeat(80));
}

comprehensiveSystemTest().catch(console.error);
