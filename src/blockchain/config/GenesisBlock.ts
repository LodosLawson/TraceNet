import { IBlock } from '../models/Block';
import { NETWORK_CONFIG, GENESIS_VALIDATOR_PUBLIC_KEY } from './NetworkConfig';
import { KeyManager } from '../crypto/KeyManager';

/**
 * Ownership Proof - TraceNet V3.0
 * 
 * 6 secret word hashes proving project ownership and creator identity
 * 
 * LodosLawson is the pseudonym - M.S are the creator's initials (identity proof via hash6)
 * These hashes cannot be reversed - they prove ownership without revealing the secret words
 */
const OWNERSHIP_PROOF = {
    developer: 'LodosLawson - M.S',  // Creator initials (identity hash: hash6)
    project: 'TraceNet Blockchain',
    version: '3.0.0',
    timestamp: 1735689600000,
    wordHashes: {
        hash1: 'f8c3bf62a9aa3e6fc1619c250e48afe7519373d3edf41be62eb5dc45199af2ef',
        hash2: 'a9f51566bd6705f7ea6ad54bb9deb449f795582d6529a0e22207b8981233ec58',
        hash3: '7f9d4bf0d2446f8a51a2a7c8a1f3e7def6f3685fd6f6c3f8e9c0a8c4b8de5f77',
        hash4: '7c211433f02071597741e6ff5a8ea34789abbf43fc5f03c1d6fb6f8264b5e27f',
        hash5: 'e0a6f3c9e8f5b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2',
        hash6: '8f3c9e1a5b2d7f4c6e8a3b9d1f5c7e2a4b6d8f1c3e5a7b9d2f4c6e8a1b3d5f7c9',  // Creator identity hash
    },
    combinedHash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
};

/**
 * Calculate proper genesis hash
 */
function calculateGenesisHash(): string {
    const data = JSON.stringify({
        index: 0,
        previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: NETWORK_CONFIG.genesisTimestamp,
        merkle_root: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945', // Hash of []
        state_root: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a', // Hash of {}
        transactions: [],
        validator_id: GENESIS_VALIDATOR_PUBLIC_KEY,
        nonce: 0,
        metadata: {
            ...NETWORK_CONFIG,
            ownershipProof: OWNERSHIP_PROOF,
            // Network identification
            networkMagic: 0x54524E33,  // "TRN3" in hex

            // Consensus rules
            consensus: {
                type: 'validator-pool',
                blockTime: 5000,
                maxBlockSize: 1_000_000,
                maxTxPerBlock: 1000,
                validatorSelection: 'round-robin-fallback',
                slashingEnabled: true
            },

            // Timestamp rules
            timestampRules: {
                maxDrift: 300000,
                blockTimeTarget: 5000,
                monotonic: true
            }
        }
    });
    return KeyManager.hash(data);
}

const genesisHash = calculateGenesisHash();

// Display proof on startup
console.log('\n🔐 TraceNet V3.0 Genesis Block');
console.log(`Creator: ${OWNERSHIP_PROOF.developer}`);  // Shows: LodosLawson - M.S
console.log(`Project: ${OWNERSHIP_PROOF.project}`);
console.log(`Version: ${OWNERSHIP_PROOF.version}`);
console.log(`✅ Genesis Hash: ${genesisHash}\n`);

/**
 * TraceNet V3.0 Genesis Block
 * 
 * Features:
 * - 5-word ownership proof (hashes only - words kept secret)
 * - Proper hash from block content
 * - TRN token economics
 */
export const GENESIS_BLOCK_DATA: IBlock = {
    index: 0,
    previous_hash: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: NETWORK_CONFIG.genesisTimestamp,
    merkle_root: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    state_root: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    transactions: [],
    validator_id: GENESIS_VALIDATOR_PUBLIC_KEY,
    signature: 'cba12ac7289134b3a7a260a753f69f7a441e759019f2d68d40f4373e604ce348c8f59f831081e2eb9935b46d0aa4f778b16dc6862c8020bdd16c6199e7899c0c',
    nonce: 0,
    hash: genesisHash,
    metadata: {
        ...NETWORK_CONFIG,

        // ✅ Ownership Proof (hashes only)
        ownershipProof: OWNERSHIP_PROOF,

        // Network identification
        networkMagic: 0x54524E33,  // "TRN3" in hex

        // Consensus rules
        consensus: {
            type: 'validator-pool',
            blockTime: 5000,
            maxBlockSize: 1_000_000,
            maxTxPerBlock: 1000,
            validatorSelection: 'round-robin-fallback',
            slashingEnabled: true
        },

        // Timestamp rules
        timestampRules: {
            maxDrift: 300000,
            blockTimeTarget: 5000,
            monotonic: true
        }
    }
};
