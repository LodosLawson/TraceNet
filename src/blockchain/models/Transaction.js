"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionModel = exports.TransactionType = void 0;
/**
 * Transaction types supported by the blockchain
 */
var TransactionType;
(function (TransactionType) {
    TransactionType["TRANSFER"] = "TRANSFER";
    TransactionType["REWARD"] = "REWARD";
    TransactionType["POST_ACTION"] = "POST_ACTION";
    TransactionType["PROFILE_UPDATE"] = "PROFILE_UPDATE";
    TransactionType["LIKE"] = "LIKE";
    TransactionType["FOLLOW"] = "FOLLOW";
    TransactionType["MESSAGE_PAYMENT"] = "MESSAGE_PAYMENT";
    TransactionType["POST_CONTENT"] = "POST_CONTENT";
    TransactionType["COMMENT"] = "COMMENT";
    TransactionType["SHARE"] = "SHARE";
    TransactionType["UNFOLLOW"] = "UNFOLLOW";
    TransactionType["PRIVATE_MESSAGE"] = "PRIVATE_MESSAGE";
    TransactionType["BATCH"] = "BATCH";
    TransactionType["CONVERSATION_BATCH"] = "CONVERSATION_BATCH";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
/**
 * Transaction class with validation and utility methods
 */
class TransactionModel {
    constructor(data) {
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
    static create(from_wallet, to_wallet, type, amount, fee, nonce, payload = {}, sender_public_key, sender_signature, valid_until // New: Optional valid_until parameter
    ) {
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
    static generateTxId(from, to, amount, timestamp, valid_until // Include valid_until in ID generation
    ) {
        const crypto = require('crypto');
        const data = `${from}${to}${amount}${timestamp}${valid_until || ''}`; // Include valid_until in hash
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Add a validator signature
     */
    addSignature(validator_id, signature) {
        this.signatures.push({
            validator_id,
            signature,
            timestamp: Date.now(),
        });
    }
    /**
     * Check if transaction has enough signatures
     */
    hasEnoughSignatures(threshold) {
        return this.signatures.length >= threshold;
    }
    /**
     * Get transaction data for signing (excludes signatures)
     */
    getSignableData() {
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
    validate() {
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
    toJSON() {
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
exports.TransactionModel = TransactionModel;
