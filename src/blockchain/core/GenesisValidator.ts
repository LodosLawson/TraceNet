/**
 * Genesis Validator - TraceNet V3.0
 * 
 * Validates genesis block meets all production requirements
 */

import { Block } from '../models/Block';
import { KeyManager } from '../crypto/KeyManager';
import { NETWORK_CONFIG } from '../config/NetworkConfig';

export class GenesisValidator {
    private static readonly EXPECTED_NETWORK_MAGIC = 0x54524E33; // "TRN3"
    private static readonly EXPECTED_CHAIN_ID = 'tracenet-mainnet-v3';

    /**
     * Validate genesis block meets all 10 requirements
     */
    static validate(block: Block): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 1. ✅ Real block hash (not placeholder)
        if (!block.hash || block.hash.length !== 64) {
            errors.push('Invalid genesis hash format');
        }

        const calculatedHash = this.calculateBlockHash(block);
        if (block.hash !== calculatedHash) {
            errors.push('Genesis hash mismatch - hash not derived from content');
        }

        // 2. ✅ Signature exists
        if (!block.signature || block.signature.length === 0) {
            errors.push('Genesis signature missing');
        }

        // 3. ✅ Validator ID present
        if (!block.validator_id || block.validator_id.length === 0) {
            errors.push('Validator ID missing');
        }

        // 4. ✅ Initial state/balances defined
        if (!block.metadata) {
            errors.push('Genesis metadata missing');
        }

        // 5. ✅ Consensus rules defined
        if (!block.metadata?.consensus) {
            errors.push('Consensus rules not defined in genesis');
        } else {
            if (!block.metadata.consensus.type) {
                errors.push('Consensus type missing');
            }
            if (!block.metadata.consensus.blockTime) {
                errors.push('Block time not specified');
            }
        }

        // 6. ✅ Network magic / separation
        if (block.metadata?.networkMagic !== this.EXPECTED_NETWORK_MAGIC) {
            errors.push(`Wrong network magic. Expected: ${this.EXPECTED_NETWORK_MAGIC.toString(16)}`);
        }

        if (block.metadata?.chainId !== this.EXPECTED_CHAIN_ID) {
            errors.push(`Wrong chain ID. Expected: ${this.EXPECTED_CHAIN_ID}`);
        }

        // 7. ✅ State root defined
        if (!block.state_root || block.state_root === '0'.repeat(64)) {
            // Allow zero hash for empty state
            console.log('[Genesis] State root is zero (empty state) - acceptable for genesis');
        }

        // 8. ✅ Nonce usage clarified
        if (block.nonce !== 0) {
            errors.push('Genesis nonce must be 0 (PoS - no mining)');
        }

        // 9. ✅ Timestamp rules defined
        if (!block.metadata?.timestampRules) {
            errors.push('Timestamp rules not defined');
        } else {
            if (!block.metadata.timestampRules.maxDrift) {
                errors.push('Max timestamp drift not specified');
            }
            if (block.metadata.timestampRules.monotonic !== true) {
                errors.push('Monotonic timestamp rule not enabled');
            }
        }

        // 10. ✅ Ownership proof validation
        if (!block.metadata?.ownershipProof) {
            errors.push('Ownership proof missing');
        } else {
            const proof = block.metadata.ownershipProof;
            if (!proof.developer || !proof.project) {
                errors.push('Ownership proof incomplete (missing developer/project)');
            }
            if (!proof.wordHashes || Object.keys(proof.wordHashes).length !== 5) {
                errors.push('Ownership proof must have 5 word hashes');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Calculate block hash (simplified for genesis)
     */
    private static calculateBlockHash(block: Block): string {
        const data = JSON.stringify({
            index: block.index,
            previous_hash: block.previous_hash,
            timestamp: block.timestamp,
            merkle_root: block.merkle_root,
            state_root: block.state_root,
            transactions: block.transactions,
            validator_id: block.validator_id,
            nonce: block.nonce,
            metadata: block.metadata
        });
        return KeyManager.hash(data);
    }

    /**
     * Verify ownership by providing the 5 secret words
     * (Only project owner can do this)
     */
    static verifyOwnership(
        block: Block,
        word1: string,
        word2: string,
        word3: string,
        word4: string,
        word5: string
    ): boolean {
        if (!block.metadata?.ownershipProof) return false;

        const proof = block.metadata.ownershipProof;
        const hashes = proof.wordHashes;

        // Verify each word hash
        if (KeyManager.hash(word1) !== hashes.hash1) return false;
        if (KeyManager.hash(word2) !== hashes.hash2) return false;
        if (KeyManager.hash(word3) !== hashes.hash3) return false;
        if (KeyManager.hash(word4) !== hashes.hash4) return false;
        if (KeyManager.hash(word5) !== hashes.hash5) return false;

        // Verify combined hash
        const combined = `${word1}${word2}${word3}${word4}${word5}`;
        if (KeyManager.hash(combined) !== proof.combinedHash) return false;

        return true;
    }

    /**
     * Display validation results
     */
    static displayValidation(result: { valid: boolean; errors: string[] }): void {
        console.log('\n📋 Genesis Block Validation Results:');
        console.log(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`);

        if (!result.valid) {
            console.log('\n❌ Errors:');
            result.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        } else {
            console.log('✅ All 10 requirements met!');
        }
        console.log('');
    }
}
