
import { KeyManager } from '../blockchain/crypto/KeyManager';
import { GENESIS_BLOCK_DATA } from '../blockchain/config/GenesisBlock';
import { NETWORK_CONFIG } from '../blockchain/config/NetworkConfig';

// 1. Generate Genesis Validator Keys
console.log('Generating Genesis Validator Keys...');
const validatorKeys = KeyManager.generateKeyPair();

console.log('\n----------------------------------------');
console.log('GENESIS VALIDATOR KEYS (SAVE THESE)');
console.log('----------------------------------------');
console.log(`Public Key:  ${validatorKeys.publicKey}`);
console.log(`Private Key: ${validatorKeys.privateKey}`);
console.log('----------------------------------------\n');

// 2. Calculate Empty State Root
// For an empty state (no accounts), the root is hash of empty array/object representation
// But typically for Genesis we might want some pre-allocations.
// For now, we'll adhere to the "Empty State" but strictly defined.
const emptyState = {};
const stateRoot = KeyManager.hash(JSON.stringify(emptyState));

// 3. Calculate Merkle Root of Empty Transactions
// If transactions is [], traditional merkle root is often hash of empty string or null bytes
// But simpler to just hash the string "[]" or similar for this static block
const merkleRoot = KeyManager.hash(JSON.stringify([]));

// 4. Update Block Data for Hashing
const blockData = {
    index: 0,
    previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: NETWORK_CONFIG.genesisTimestamp,
    merkle_root: merkleRoot,
    state_root: stateRoot,
    transactions: [],
    validator_id: validatorKeys.publicKey,
    nonce: 0,
    metadata: {
        ...NETWORK_CONFIG,
        // We need to inject the ownership proof here as it is in the real file
        ownershipProof: GENESIS_BLOCK_DATA.metadata.ownershipProof
    }
};

// 5. Calculate Genesis Hash
const dataString = JSON.stringify(blockData);
const genesisHash = KeyManager.hash(dataString);

// 6. Sign the Hash
const signature = KeyManager.sign(genesisHash, validatorKeys.privateKey);

console.log('GENESIS BLOCK VALUES');
console.log('----------------------------------------');
console.log(`Genesis Hash: ${genesisHash}`);
console.log(`Merkle Root:  ${merkleRoot}`);
console.log(`State Root:   ${stateRoot}`);
console.log(`Validator ID: ${validatorKeys.publicKey}`);
console.log(`Signature:    ${signature}`);
console.log('----------------------------------------');
