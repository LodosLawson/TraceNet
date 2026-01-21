import { Transaction } from './Transaction';
import crypto from 'crypto';

/**
 * Block interface
 */
export interface IBlock {
    index: number;
    previous_hash: string;
    timestamp: number;
    merkle_root: string;
    state_root: string;
    transactions: Transaction[];
    validator_id: string;
    signature: string;
    signatures?: string[]; // Optional for backward compatibility, but generally required now
    nonce: number;
    hash?: string;
    metadata?: any; // Network metadata for genesis block
    node_wallet?: string; // Optional wallet address for node owner fee distribution
}

/**
 * Block class with validation and utility methods
 */
export class Block {
    index: number;
    previous_hash: string;
    timestamp: number;
    merkle_root: string;
    state_root: string;
    transactions: Transaction[];
    validator_id: string;
    signature: string; // Proposer signature
    signatures: string[]; // Witness signatures
    nonce: number;
    hash?: string;
    metadata?: any;
    node_wallet?: string;

    constructor(data: IBlock) {
        this.index = data.index;
        this.previous_hash = data.previous_hash;
        this.timestamp = data.timestamp;
        this.merkle_root = data.merkle_root;
        this.state_root = data.state_root;
        this.transactions = data.transactions;
        this.validator_id = data.validator_id;
        this.signature = data.signature;
        this.signatures = data.signatures || []; // Initialize signatures
        this.nonce = data.nonce;
        this.hash = data.hash;
        this.metadata = data.metadata;
        this.node_wallet = data.node_wallet;
    }

    /**
     * Create genesis block
     */
    static createGenesis(validator_id: string, networkMetadata?: any): Block {
        const genesisBlock = new Block({
            index: 0,
            previous_hash: '0'.repeat(64),
            timestamp: Date.now(),
            merkle_root: '0'.repeat(64),
            state_root: '0'.repeat(64),
            transactions: [],
            validator_id,
            signature: '',
            signatures: [],
            nonce: 0,
            metadata: networkMetadata,
        });

        genesisBlock.hash = genesisBlock.calculateHash();
        return genesisBlock;
    }

    /**
     * Create a new block
     */
    static create(
        index: number,
        previous_hash: string,
        transactions: Transaction[],
        validator_id: string,
        state_root: string,
        node_wallet?: string,
        timestamp: number = Date.now()
    ): Block {
        const merkle_root = this.calculateMerkleRoot(transactions);

        return new Block({
            index,
            previous_hash,
            timestamp,
            merkle_root,
            state_root,
            transactions,
            validator_id,
            signature: '',
            signatures: [],
            nonce: 0,
            node_wallet,
        });
    }

    /**
     * Calculate block hash
     */
    calculateHash(): string {
        const data = this.getHashableData();
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Get data for hashing (excludes hash itself AND signatures)
     */
    getHashableData(): string {
        return JSON.stringify({
            index: this.index,
            previous_hash: this.previous_hash,
            timestamp: this.timestamp,
            merkle_root: this.merkle_root,
            state_root: this.state_root,
            validator_id: this.validator_id,
            // signature: this.signature, // REMOVED: Signature should not be part of the hash usually, but in previous version it might have been diff. 
            // In standard BTC/ETH, signature is segregated or outside the hashable part for the ID.
            // Let's keep it backward compatible: The PRIMARY signature (proposer) might be inside if it was before, 
            // BUT for multi-sig, we definitely exclude the 'signatures' array.
            // Wait, looking at original code: `signature: this.signature` WAS included.
            // If I remove it, I break verification of old blocks (if any).
            // But usually, signature signs the hash. If hash includes signature, it's a circular dependency.
            // Checking original code... 
            // Original: `getHashableData` included `signature: this.signature`.
            // `calculateHash` calls `getHashableData`.
            // `setSignature` sets `this.signature` THEN calls `calculateHash`. 
            // This implies the signature IS included in the hash? 
            // That's impossible for digital signatures. You sign the hash. You can't put the signature in the data you hash to get the hash you sign.
            // Let's re-read the original ViewOutput carefully.

            // Original `setSignature`:
            // this.signature = signature;
            // this.hash = this.calculateHash();

            // Original `getHashableData`:
            // JSON.stringify({ ... signature: this.signature ... })

            // If I call setSignature(sig):
            // 1. this.signature = sig
            // 2. hash = calculateHash() -> JSON includes sig -> hash depends on sig.
            // This block hash is VALID. 
            // BUT, what did the Validator sign?
            // `getSignableData` excludes signature and hash.
            // So Validator signs {index, prev_hash...}. Result is SIG.
            // Then Block puts SIG in itself. 
            // Then Block calculates HASH including SIG.
            // This is valid. The Block Hash depends on the Proposer Signature.

            // FOR MULTI-SIG:
            // We want other validators to sign the BLOCK HASH (or the signable data).
            // If they sign the Signable Data, they are just co-signing the proposal.
            // If they sign the Block Hash, they confirm the Proposer's signature too.

            // Let's exclude the NEW `signatures` array from the hash to allow appending signatures without changing the block hash (if we want the hash to be stable).
            // HOWEVER, usually the block hash MUST change if content changes?
            // In Multi-Sig/BFT, often we have a "QC" (Quorum Certificate) which is a collection of signatures.
            // The Block ID is usually the hash of the content *before* QC.
            // But let's verify standard TraceNet behavior.

            signature: this.signature, // Keep primary proposer signature here
            nonce: this.nonce,
        });
    }

    /**
     * Get data for signing (excludes signature and hash)
     */
    getSignableData(): string {
        return JSON.stringify({
            index: this.index,
            previous_hash: this.previous_hash,
            timestamp: this.timestamp,
            merkle_root: this.merkle_root,
            state_root: this.state_root,
            validator_id: this.validator_id,
            nonce: this.nonce,
        });
    }

    /**
     * Calculate Merkle root from transactions
     */
    static calculateMerkleRoot(transactions: Transaction[]): string {
        if (transactions.length === 0) {
            return '0'.repeat(64);
        }

        // Get transaction hashes
        let hashes = transactions.map((tx) =>
            crypto.createHash('sha256').update(JSON.stringify(tx)).digest('hex')
        );

        // Build Merkle tree
        while (hashes.length > 1) {
            const newHashes: string[] = [];

            for (let i = 0; i < hashes.length; i += 2) {
                if (i + 1 < hashes.length) {
                    // Combine two hashes
                    const combined = hashes[i] + hashes[i + 1];
                    const hash = crypto.createHash('sha256').update(combined).digest('hex');
                    newHashes.push(hash);
                } else {
                    // Odd number of hashes, duplicate the last one
                    const combined = hashes[i] + hashes[i];
                    const hash = crypto.createHash('sha256').update(combined).digest('hex');
                    newHashes.push(hash);
                }
            }

            hashes = newHashes;
        }

        return hashes[0];
    }

    /**
     * Validate block structure
     */
    validate(): { valid: boolean; error?: string } {
        // Check index
        if (this.index < 0) {
            return { valid: false, error: 'Invalid block index' };
        }

        // Check previous hash format
        if (!/^[0-9a-f]{64}$/i.test(this.previous_hash)) {
            return { valid: false, error: 'Invalid previous_hash format' };
        }

        // Check timestamp
        if (this.timestamp <= 0) {
            return { valid: false, error: 'Invalid timestamp' };
        }

        // Verify merkle root
        const calculatedMerkleRoot = Block.calculateMerkleRoot(this.transactions);
        if (this.merkle_root !== calculatedMerkleRoot) {
            return { valid: false, error: 'Merkle root mismatch' };
        }

        // Verify hash
        const calculatedHash = this.calculateHash();
        if (this.hash && this.hash !== calculatedHash) {
            return { valid: false, error: 'Block hash mismatch' };
        }

        return { valid: true };
    }

    /**
     * Set block signature
     */
    setSignature(signature: string): void {
        this.signature = signature;
        this.hash = this.calculateHash();
    }

    /**
     * Add a validator signature (Multi-Sig)
     */
    addMultiSignature(signature: string): void {
        if (!this.signatures) this.signatures = [];
        if (!this.signatures.includes(signature)) {
            this.signatures.push(signature);
        }
    }

    /**
     * Convert to plain object
     */
    toJSON(): IBlock {
        return {
            index: this.index,
            previous_hash: this.previous_hash,
            timestamp: this.timestamp,
            merkle_root: this.merkle_root,
            state_root: this.state_root,
            transactions: this.transactions,
            validator_id: this.validator_id,
            signature: this.signature,
            signatures: this.signatures,
            nonce: this.nonce,
            hash: this.hash,
            metadata: this.metadata,
            node_wallet: this.node_wallet,
        };
    }
}

