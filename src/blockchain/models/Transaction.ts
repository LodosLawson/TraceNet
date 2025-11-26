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
    signatures: Signature[];
    sender_public_key?: string;
    sender_signature?: string;
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
    signatures: Signature[];
    sender_public_key?: string;
    sender_signature?: string;

    constructor(data: Transaction) {
        this.tx_id = data.tx_id;
        this.from_wallet = data.from_wallet;
        this.to_wallet = data.to_wallet;
        this.type = data.type;
        this.payload = data.payload;
        this.amount = data.amount;
        this.fee = data.fee;
        this.timestamp = data.timestamp;
        this.signatures = data.signatures || [];
        this.sender_public_key = data.sender_public_key;
        this.sender_signature = data.sender_signature;
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
        payload: any = {},
        sender_public_key?: string,
        sender_signature?: string
    ): TransactionModel {
        const timestamp = Date.now();
        const tx_id = this.generateTxId(from_wallet, to_wallet, amount, timestamp);

        return new TransactionModel({
            tx_id,
            from_wallet,
            to_wallet,
            type,
            payload,
            amount,
            fee,
            timestamp,
            signatures: [],
            sender_public_key,
            sender_signature
        });
    }

    /**
     * Generate transaction ID from transaction data
     */
    static generateTxId(
        from: string,
        to: string,
        amount: number,
        timestamp: number
    ): string {
        const crypto = require('crypto');
        const data = `${from}${to}${amount}${timestamp}`;
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
            signatures: this.signatures,
            sender_public_key: this.sender_public_key,
            sender_signature: this.sender_signature
        };
    }
}
