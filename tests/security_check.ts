
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';

async function runSecurityCheck() {
    console.log('🛡️  Starting Security Verification: Sender Impersonation Check');

    // 1. Setup
    const blockchain = new Blockchain('SYSTEM');

    // 2. create Victim (Rich User)
    const victim = KeyManager.generateWalletFromMnemonic();
    console.log(`👤 Victim Address: ${victim.address}`);

    // 3. Create Attacker (Thief)
    const attacker = KeyManager.generateWalletFromMnemonic();
    console.log(`😈 Attacker Address: ${attacker.address}`);
    console.log(`😈 Attacker Public Key: ${attacker.publicKey}`);

    // 4. Create Forged Transaction
    // Attacker tries to send money FROM Victim TO Attacker
    // But signs it with ATTACKER'S private key (because they don't have victim's key)
    console.log('📝 Creating Forged Transaction...');

    // We construct the transaction claiming 'from_wallet' is VICTIM
    const tx = TransactionModel.create(
        victim.address,     // FROM Victim
        attacker.address,   // TO Attacker
        TransactionType.TRANSFER,
        1000,
        1,
        1 // Nonce
    );

    // CRITICAL: Set the public key BEFORE generating signable data
    // The attacker wants to include their key so the signature verifies against IT.
    tx.sender_public_key = attacker.publicKey;

    // Attacker signs the transaction with THEIR key
    const signableData = tx.getSignableData();
    const signature = KeyManager.sign(signableData, attacker.privateKey);

    // Attach signature
    tx.sender_signature = signature;

    console.log('🚀 Broadcasting Forged Transaction...');

    // Validate
    const validation = blockchain.validateTransaction(tx);

    if (validation.valid) {
        console.error('❌ SECURITY FAILURE: The blockchain ACCEPTED the forged transaction!');
        console.error('   This means anyone can steal funds.');
        process.exit(1);
    } else {
        console.log('✅ SECURITY SUCCESS: The blockchain REJECTED the forged transaction.');
        console.log(`   Reason: ${validation.error}`);
        if (validation.error && validation.error.includes('Key derives to')) {
            console.log('   (Confirmed: Address Derivation Check triggered)');
        }
        process.exit(0);
    }
}

runSecurityCheck().catch(err => {
    console.error('Test Error:', err);
    process.exit(1);
});
