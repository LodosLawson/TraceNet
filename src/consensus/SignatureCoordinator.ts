import { Transaction } from '../blockchain/models/Transaction';
import { ValidatorPool, Validator } from './ValidatorPool';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import EventEmitter from 'events';

/**
 * Signature collection status
 */
export interface SignatureCollection {
    tx_id: string;
    transaction: Transaction;
    required_signatures: number;
    collected_signatures: number;
    validators: string[];
    signatures: Map<string, string>;
    started_at: number;
    timeout: number;
    status: 'pending' | 'completed' | 'failed' | 'timeout';
}

/**
 * Signature coordinator for DPoA consensus
 */
export class SignatureCoordinator extends EventEmitter {
    private validatorPool: ValidatorPool;
    private collections: Map<string, SignatureCollection>;
    private thresholdPercent: number;
    private validatorsPerTx: number;
    private signatureTimeout: number;

    constructor(
        validatorPool: ValidatorPool,
        thresholdPercent: number = 66,
        validatorsPerTx: number = 7,
        signatureTimeout: number = 5000
    ) {
        super();
        this.validatorPool = validatorPool;
        this.collections = new Map();
        this.thresholdPercent = thresholdPercent;
        this.validatorsPerTx = validatorsPerTx;
        this.signatureTimeout = signatureTimeout;
    }

    /**
     * Request signatures for a transaction
     */
    requestSignatures(transaction: Transaction): {
        success: boolean;
        error?: string;
        collection_id?: string;
    } {
        // Check if already collecting signatures for this transaction
        if (this.collections.has(transaction.tx_id)) {
            return { success: false, error: 'Already collecting signatures for this transaction' };
        }

        // Select validators
        const validators = this.validatorPool.selectValidators(this.validatorsPerTx);

        if (validators.length === 0) {
            return { success: false, error: 'No online validators available' };
        }

        // Calculate required signatures (threshold)
        const requiredSignatures = Math.ceil(
            (validators.length * this.thresholdPercent) / 100
        );

        // Create collection
        const collection: SignatureCollection = {
            tx_id: transaction.tx_id,
            transaction,
            required_signatures: requiredSignatures,
            collected_signatures: 0,
            validators: validators.map((v) => v.validator_id),
            signatures: new Map(),
            started_at: Date.now(),
            timeout: this.signatureTimeout,
            status: 'pending',
        };

        this.collections.set(transaction.tx_id, collection);

        // Emit sign request event for each validator
        for (const validator of validators) {
            this.emit('signRequest', {
                validator_id: validator.validator_id,
                tx_id: transaction.tx_id,
                transaction,
            });
        }

        // Set timeout
        setTimeout(() => {
            this.checkTimeout(transaction.tx_id);
        }, this.signatureTimeout);

        return { success: true, collection_id: transaction.tx_id };
    }

    /**
     * Add validator signature
     */
    addSignature(
        txId: string,
        validatorId: string,
        signature: string,
        publicKey: string
    ): { success: boolean; error?: string; completed?: boolean } {
        const collection = this.collections.get(txId);

        if (!collection) {
            return { success: false, error: 'Collection not found' };
        }

        if (collection.status !== 'pending') {
            return { success: false, error: 'Collection is not pending' };
        }

        // Check if validator is in the selected list
        if (!collection.validators.includes(validatorId)) {
            return { success: false, error: 'Validator not selected for this transaction' };
        }

        // Check if validator already signed
        if (collection.signatures.has(validatorId)) {
            return { success: false, error: 'Validator already signed' };
        }

        // Verify signature
        const txData = JSON.stringify(collection.transaction);
        const isValid = KeyManager.verify(txData, signature, publicKey);

        if (!isValid) {
            return { success: false, error: 'Invalid signature' };
        }

        // Add signature
        collection.signatures.set(validatorId, signature);
        collection.collected_signatures++;

        // Update validator stats
        this.validatorPool.incrementSignatures(validatorId);

        // Check if threshold reached
        if (collection.collected_signatures >= collection.required_signatures) {
            collection.status = 'completed';

            // Add all signatures to transaction
            for (const [valId, sig] of collection.signatures.entries()) {
                collection.transaction.signatures.push({
                    validator_id: valId,
                    signature: sig,
                    timestamp: Date.now(),
                });
            }

            // Emit completion event
            this.emit('signatureComplete', {
                tx_id: txId,
                transaction: collection.transaction,
                signature_count: collection.collected_signatures,
            });

            return { success: true, completed: true };
        }

        return { success: true, completed: false };
    }

    /**
     * Check for timeout
     */
    private checkTimeout(txId: string): void {
        const collection = this.collections.get(txId);

        if (!collection || collection.status !== 'pending') {
            return;
        }

        const elapsed = Date.now() - collection.started_at;

        if (elapsed >= collection.timeout) {
            // Check if we have enough signatures
            if (collection.collected_signatures >= collection.required_signatures) {
                collection.status = 'completed';

                // Add signatures to transaction
                for (const [valId, sig] of collection.signatures.entries()) {
                    collection.transaction.signatures.push({
                        validator_id: valId,
                        signature: sig,
                        timestamp: Date.now(),
                    });
                }

                this.emit('signatureComplete', {
                    tx_id: txId,
                    transaction: collection.transaction,
                    signature_count: collection.collected_signatures,
                });
            } else {
                collection.status = 'timeout';

                this.emit('signatureTimeout', {
                    tx_id: txId,
                    collected: collection.collected_signatures,
                    required: collection.required_signatures,
                });
            }
        }
    }

    /**
     * Get collection status
     */
    getCollectionStatus(txId: string): SignatureCollection | undefined {
        return this.collections.get(txId);
    }

    /**
     * Remove collection
     */
    removeCollection(txId: string): boolean {
        return this.collections.delete(txId);
    }

    /**
     * Get active collections
     */
    getActiveCollections(): SignatureCollection[] {
        return Array.from(this.collections.values()).filter(
            (c) => c.status === 'pending'
        );
    }

    /**
     * Get statistics
     */
    getStats(): {
        activeCollections: number;
        completedCollections: number;
        failedCollections: number;
        timeoutCollections: number;
        avgSignatureTime: number;
    } {
        const collections = Array.from(this.collections.values());

        const completed = collections.filter((c) => c.status === 'completed');
        const avgSignatureTime =
            completed.length > 0
                ? completed.reduce((sum, c) => sum + (Date.now() - c.started_at), 0) /
                completed.length
                : 0;

        return {
            activeCollections: collections.filter((c) => c.status === 'pending').length,
            completedCollections: completed.length,
            failedCollections: collections.filter((c) => c.status === 'failed').length,
            timeoutCollections: collections.filter((c) => c.status === 'timeout').length,
            avgSignatureTime,
        };
    }

    /**
     * Clear old collections
     */
    clearOldCollections(maxAge: number = 3600000): number {
        const now = Date.now();
        let cleared = 0;

        for (const [txId, collection] of this.collections.entries()) {
            if (
                collection.status !== 'pending' &&
                now - collection.started_at > maxAge
            ) {
                this.collections.delete(txId);
                cleared++;
            }
        }

        return cleared;
    }
}
