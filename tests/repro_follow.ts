
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';

// Mock Validator Pool to bypass "No validator available" error
class MockValidatorPool extends ValidatorPool {
    private pubKey: string;
    constructor(pubKey: string = 'system_pub_key') {
        super();
        this.pubKey = pubKey;
    }
    // Override selectBlockProducer to always return our test validator
    selectBlockProducer(blockIndex: number, previousHash: string | undefined, round: number): any {
        return {
            validator_id: 'SYSTEM_VALIDATOR',
            public_key: this.pubKey,
            stake: 100000,
            is_online: true
        };
    }

    // Override getValidator to pass Blockchain validation
    getValidator(validatorId: string): any {
        if (validatorId === 'SYSTEM_VALIDATOR') {
            return {
                validator_id: 'SYSTEM_VALIDATOR',
                public_key: this.pubKey,
                stake: 100000,
                is_online: true
            };
        }
        return undefined;
    }
}

async function runTest() {
    console.log('--- Testing Follow/Unfollow Mining Failure (Repro Fixed) ---');

    // 1. Setup
    const validatorKeys = KeyManager.generateKeyPair();
    const validatorPool = new MockValidatorPool(validatorKeys.publicKey);

    const blockchain = new Blockchain('SYSTEM_VALIDATOR', validatorPool);
    const mempool = new Mempool();
    const blockProducer = new BlockProducer(blockchain, validatorPool, mempool);
    blockProducer.registerLocalValidator('SYSTEM_VALIDATOR', validatorKeys.privateKey);

    // 2. Setup Users
    const userA = KeyManager.generateKeyPair();
    const addressA = KeyManager.deriveAddress(userA.publicKey);

    const userB = KeyManager.generateKeyPair();
    const addressB = KeyManager.deriveAddress(userB.publicKey);

    // Fund User A
    // We cast to any to modify state directly if needed, but here we stick to standard props
    blockchain['state'].set(addressA, {
        address: addressA,
        balance: 1000,
        nonce: 0,
        incomingTransferCount: 0
    });

    // Fund User B (Target)
    blockchain['state'].set(addressB, {
        address: addressB,
        balance: 1000,
        nonce: 0,
        incomingTransferCount: 0
    });

    // 3. Create FOLLOW Transaction
    console.log(`User A (${addressA}) following User B (${addressB})`);

    const txFollow = TransactionModel.create(
        addressA,
        addressB,
        'FOLLOW' as TransactionType,
        0, // Amount
        0.000001, // Fee
        1, // Nonce
        { target: addressB }, // Payload 
        userA.publicKey
    );

    // Sign
    let signData = txFollow.getSignableData();
    txFollow.sender_signature = KeyManager.sign(signData, userA.privateKey);
    txFollow.sender_public_key = userA.publicKey;

    console.log('Adding FOLLOW tx to mempool...');
    mempool.addTransaction(txFollow.toJSON());

    // 4. Mine Block
    console.log('Mining block...');
    const result = await blockProducer.triggerBlockProduction();

    if (result.success) {
        console.log(`Block mined! Transactions: ${result.block?.transactions.length}`);
        if (result.block?.transactions.length === 1) {
            console.log('SUCCESS: Follow transaction mined.');
        } else {
            console.log('FAILURE: Block mined but empty.');
        }
    } else {
        console.log(`FAILURE: Mining failed: ${result.error}`);
    }

    // 5. Verify State (Check only standard props, social props might be missing)
    const stateA = blockchain.getAccountState(addressA) as any;

    // This check expects 'following' to exist on AccountState which we now know is MISSING in type
    // but might exist in runtime state? 
    // Let's check runtime existence.
    console.log(`User A Following (Runtime): ${JSON.stringify(stateA?.following)}`);

    if (stateA?.following && stateA.following.includes(addressB)) {
        console.log('SUCCESS: State updated (Following exists)');
    } else {
        console.log('WARNING: State NOT updated in Blockchain (Following missing). This confirms Blockchain.ts does not track social graph.');
    }

}

runTest().catch(console.error);
