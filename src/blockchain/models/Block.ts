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
    signature: string;
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
     * Get data for hashing (excludes hash itself)
     */
    getHashableData(): string {
        return JSON.stringify({
            index: this.index,
            previous_hash: this.previous_hash,
            timestamp: this.timestamp,
            merkle_root: this.merkle_root,
            state_root: this.state_root,
            validator_id: this.validator_id,
            signature: this.signature,
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
            nonce: this.nonce,
            hash: this.hash,
            metadata: this.metadata,
            node_wallet: this.node_wallet,
        };
    }
}
