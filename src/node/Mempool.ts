import { Transaction, TransactionModel } from '../blockchain/models/Transaction';
import EventEmitter from 'events';

/**
 * Mempool entry with priority
 */
interface MempoolEntry {
    transaction: Transaction;
    addedAt: number;
    priority: number;
}

/**
 * Transaction mempool for pending transactions
 */
export class Mempool extends EventEmitter {
    private pool: Map<string, MempoolEntry>;
    private maxSize: number;
    private expirationTime: number; // milliseconds

    constructor(maxSize: number = 10000, expirationTime: number = 3600000) {
        super();
        this.pool = new Map();
        this.maxSize = maxSize;
        this.expirationTime = expirationTime;
    }

    /**
     * Add transaction to mempool
     */
    addTransaction(transaction: Transaction): { success: boolean; error?: string } {
        // Check if transaction already exists
        if (this.pool.has(transaction.tx_id)) {
            return { success: false, error: 'Transaction already in mempool' };
        }

        // Check mempool size
        if (this.pool.size >= this.maxSize) {
            // Remove lowest priority transaction
            this.removeLowPriorityTransaction();
        }

        // Calculate priority (higher fee = higher priority)
        const priority = this.calculatePriority(transaction);

        // Add to pool
        const entry: MempoolEntry = {
            transaction,
            addedAt: Date.now(),
            priority,
        };

        this.pool.set(transaction.tx_id, entry);

        // Emit event for block production
        this.emit('transactionAdded', transaction);

        return { success: true };
    }

    /**
     * Remove transaction from mempool
     */
    removeTransaction(txId: string): boolean {
        return this.pool.delete(txId);
    }

    /**
     * Get transaction from mempool
     */
    getTransaction(txId: string): Transaction | undefined {
        return this.pool.get(txId)?.transaction;
    }

    /**
     * Get all transactions sorted by priority
     */
    getTransactions(limit?: number): Transaction[] {
        const entries = Array.from(this.pool.values());

        // Sort by priority (descending)
        entries.sort((a, b) => b.priority - a.priority);

        const transactions = entries.map((e) => e.transaction);

        return limit ? transactions.slice(0, limit) : transactions;
    }

    /**
     * Get transactions by wallet (from/to)
     */
    getTransactionsByWallet(walletId: string): Transaction[] {
        const transactions: Transaction[] = [];
        for (const entry of this.pool.values()) {
            if (entry.transaction.from_wallet === walletId || entry.transaction.to_wallet === walletId) {
                transactions.push(entry.transaction);
            }
        }
        return transactions;
    }

    /**
     * Get ALL transactions (raw iterator)
     */
    getAllTransactions(): Transaction[] {
        return Array.from(this.pool.values()).map(e => e.transaction);
    }

    /**
     * Get top N transactions for block creation
     */
    getTopTransactions(count: number): Transaction[] {
        return this.getTransactions(count);
    }

    /**
     * Check if transaction exists in mempool
     */
    hasTransaction(txId: string): boolean {
        return this.pool.has(txId);
    }

    /**
     * Get mempool size
     */
    getSize(): number {
        return this.pool.size;
    }

    /**
     * Clear expired transactions
     */
    clearExpired(): number {
        const now = Date.now();
        let removedCount = 0;

        for (const [txId, entry] of this.pool.entries()) {
            if (now - entry.addedAt > this.expirationTime) {
                this.pool.delete(txId);
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * Clear all transactions
     */
    clear(): void {
        this.pool.clear();
    }

    /**
     * Calculate transaction priority
     */
    private calculatePriority(transaction: Transaction): number {
        // Priority = fee / size (simplified)
        // Higher fee = higher priority
        // Older transactions get slight boost

        const basePriority = transaction.fee;

        // Boost for certain transaction types
        let typeBoost = 0;
        switch (transaction.type) {
            case 'REWARD':
                typeBoost = 1000; // Rewards have high priority
                break;
            case 'TRANSFER':
                typeBoost = 100;
                break;
            default:
                typeBoost = 50;
        }

        return basePriority + typeBoost;
    }

    /**
     * Remove lowest priority transaction
     */
    private removeLowPriorityTransaction(): void {
        let lowestPriority = Infinity;
        let lowestTxId: string | null = null;

        for (const [txId, entry] of this.pool.entries()) {
            if (entry.priority < lowestPriority) {
                lowestPriority = entry.priority;
                lowestTxId = txId;
            }
        }

        if (lowestTxId) {
            this.pool.delete(lowestTxId);
        }
    }

    /**
     * Get mempool statistics
     */
    getStats(): {
        size: number;
        totalFees: number;
        avgPriority: number;
        oldestTxAge: number;
    } {
        const entries = Array.from(this.pool.values());

        if (entries.length === 0) {
            return {
                size: 0,
                totalFees: 0,
                avgPriority: 0,
                oldestTxAge: 0,
            };
        }

        const totalFees = entries.reduce((sum, e) => sum + e.transaction.fee, 0);
        const avgPriority =
            entries.reduce((sum, e) => sum + e.priority, 0) / entries.length;

        const now = Date.now();
        const oldestTxAge = Math.max(...entries.map((e) => now - e.addedAt));

        return {
            size: entries.length,
            totalFees,
            avgPriority,
            oldestTxAge,
        };
    }

    /**
     * Export mempool to JSON
     */
    toJSON(): Transaction[] {
        return Array.from(this.pool.values()).map((e) => e.transaction);
    }
}
