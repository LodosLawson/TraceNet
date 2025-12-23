/**
 * Transaction types supported by the blockchain
 */
export enum TransactionType {
    TRANSFER = 'TRANSFER',
    REWARD = 'REWARD',
    POST_ACTION = 'POST_ACTION',
    PROFILE_UPDATE = 'PROFILE_UPDATE',
    LIKE = 'LIKE',
    FOLLOW = 'FOLLOW',
    MESSAGE_PAYMENT = 'MESSAGE_PAYMENT',
    POST_CONTENT = 'POST_CONTENT',      // New: Content posting
    COMMENT = 'COMMENT',                // New: Comment on content
    SHARE = 'SHARE',                    // New: Share content
    UNFOLLOW = 'UNFOLLOW',              // New: Unfollow user
    PRIVATE_MESSAGE = 'PRIVATE_MESSAGE', // New: Encrypted private message
    BATCH = 'BATCH',                    // New: Batch of multiple transactions
    CONVERSATION_BATCH = 'CONVERSATION_BATCH', // New: Optimized conversation batch
}

/**
 * Validator signature for multi-signature transactions
 */
export interface Signature {
    validator_id: string;
    signature: string;
    timestamp: number;
}

/**
 * Inner transaction structure for Batches
 */
export interface InnerTransaction {
    type: TransactionType;
    from_wallet: string;
    to_wallet: string;
    amount: number;
    payload: any;
    timestamp: number;
    nonce: number;
    signature: string; // Sender's signature for this specific inner message
    sender_public_key?: string; // Sender's public key (required for verification)
    max_wait_time?: number; // Anti-censorship: Max time to wait before upgrading lane
}

/**
 * Payload structure for Batch transactions
 */
export interface BatchPayload {
    transactions: InnerTransaction[];
}

/**
 * Transaction structure
 */
export interface Transaction {
    tx_id: string;
    from_wallet: string;
    to_wallet: string;
    type: TransactionType;
    payload: any;
    amount: number;
    fee: number;
    timestamp: number;
    nonce: number;
    signatures: Signature[];
    sender_public_key?: string;
    sender_signature?: string;
    valid_until?: number; // New: Timestamp until which the transaction is valid
}

/**
 * Transaction class with validation and utility methods
 */
export class TransactionModel {
    tx_id: string;
    from_wallet: string;
    to_wallet: string;
    type: TransactionType;
    payload: any;
    amount: number;
    fee: number;
    timestamp: number;
    nonce: number;
    signatures: Signature[];
    sender_public_key?: string;
    sender_signature?: string;
    valid_until?: number; // New: Timestamp until which the transaction is valid

    constructor(data: Transaction) {
        this.tx_id = data.tx_id;
        this.from_wallet = data.from_wallet;
        this.to_wallet = data.to_wallet;
        this.type = data.type;
        this.payload = data.payload;
        this.amount = data.amount;
        this.fee = data.fee;
        this.timestamp = data.timestamp;
        this.nonce = data.nonce;
        this.signatures = data.signatures || [];
        this.sender_public_key = data.sender_public_key;
        this.sender_signature = data.sender_signature;
        this.valid_until = data.valid_until; // Initialize valid_until
    }

    /**
     * Create a new transaction
     */
    static create(
        from_wallet: string,
        to_wallet: string,
        type: TransactionType,
        amount: number,
        fee: number,
        nonce: number,
        payload: any = {},
        sender_public_key?: string,
        sender_signature?: string,
        valid_until?: number // New: Optional valid_until parameter
    ): TransactionModel {
        const timestamp = Date.now();
        const tx_id = this.generateTxId(from_wallet, to_wallet, amount, timestamp, valid_until);

        return new TransactionModel({
            tx_id,
            from_wallet,
            to_wallet,
            type,
            payload,
            amount,
            fee,
            timestamp,
            nonce,
            signatures: [],
            sender_public_key,
            sender_signature,
            valid_until // Pass valid_until to the constructor
        });
    }

    /**
     * Generate transaction ID from transaction data
     */
    static generateTxId(
        from: string,
        to: string,
        amount: number,
        timestamp: number,
        valid_until?: number // Include valid_until in ID generation
    ): string {
        const crypto = require('crypto');
        const data = `${from}${to}${amount}${timestamp}${valid_until || ''}`; // Include valid_until in hash
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Add a validator signature
     */
    addSignature(validator_id: string, signature: string): void {
        this.signatures.push({
            validator_id,
            signature,
            timestamp: Date.now(),
        });
    }

    /**
     * Check if transaction has enough signatures
     */
    hasEnoughSignatures(threshold: number): boolean {
        return this.signatures.length >= threshold;
    }

    /**
     * Get transaction data for signing (excludes signatures)
     */
    getSignableData(): string {
        return JSON.stringify({
            tx_id: this.tx_id,
            from_wallet: this.from_wallet,
            to_wallet: this.to_wallet,
            type: this.type,
            payload: this.payload,
            amount: this.amount,
            fee: this.fee,
            timestamp: this.timestamp,
            nonce: this.nonce,
            valid_until: this.valid_until, // Include valid_until in signable data
            sender_public_key: this.sender_public_key // Include public key in signable data if present
        });
    }

    /**
     * Validate transaction structure
     */
    validate(): { valid: boolean; error?: string } {
        // Check required fields
        if (!this.tx_id || !this.from_wallet || !this.to_wallet) {
            return { valid: false, error: 'Missing required fields' };
        }

        // Validate amount and fee
        if (this.amount < 0 || this.fee < 0) {
            return { valid: false, error: 'Amount and fee must be non-negative' };
        }

        // Validate timestamp
        if (this.timestamp <= 0) {
            return { valid: false, error: 'Invalid timestamp' };
        }

        // Validate nonce
        if (this.nonce < 0) {
            return { valid: false, error: 'Nonce must be non-negative' };
        }

        // Validate valid_until if present
        if (this.valid_until !== undefined && this.valid_until <= this.timestamp) {
            return { valid: false, error: 'valid_until must be greater than timestamp' };
        }

        // Type-specific validation
        switch (this.type) {
            case TransactionType.TRANSFER:
            case TransactionType.MESSAGE_PAYMENT:
                if (this.amount <= 0) {
                    return { valid: false, error: 'Transfer amount must be positive' };
                }
                break;
            case TransactionType.REWARD:
                // Rewards can come from system (empty from_wallet)
                break;
            default:
                // Other types are valid
                break;
        }

        return { valid: true };
    }

    /**
     * Convert to plain object
     */
    toJSON(): Transaction {
        return {
            tx_id: this.tx_id,
            from_wallet: this.from_wallet,
            to_wallet: this.to_wallet,
            type: this.type,
            payload: this.payload,
            amount: this.amount,
            fee: this.fee,
            timestamp: this.timestamp,
            nonce: this.nonce,
            signatures: this.signatures,
            sender_public_key: this.sender_public_key,
            sender_signature: this.sender_signature,
            valid_until: this.valid_until // Include valid_until in JSON output
        };
    }
}
