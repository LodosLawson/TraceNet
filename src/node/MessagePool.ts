import { InnerTransaction, TransactionType } from '../blockchain/models/Transaction';
import EventEmitter from 'events';

/**
 * Message pool entry
 */
export interface MessagePoolEntry {
    message: InnerTransaction;
    addedAt: number;
    priority: number;
    id: string; // Composite ID: sender + nonce
}

/**
 * Pool for pending InnerTransactions (messages) waiting to be batched
 */
export class MessagePool extends EventEmitter {
    private pool: Map<string, MessagePoolEntry>;
    private maxSize: number;
    private expirationTime: number;

    constructor(maxSize: number = 50000, expirationTime: number = 24 * 60 * 60 * 1000) {
        super();
        this.pool = new Map();
        this.maxSize = maxSize;
        this.expirationTime = expirationTime;
    }

    /**
     * Add message to pool
     */
    addMessage(message: InnerTransaction): { success: boolean; error?: string } {
        // Generate ID
        const id = `${message.from_wallet}:${message.nonce}`;

        if (this.pool.has(id)) {
            return { success: false, error: 'Message already in pool' };
        }

        if (this.pool.size >= this.maxSize) {
            this.removeLowPriorityMessage();
        }

        const priority = this.calculatePriority(message);

        const entry: MessagePoolEntry = {
            message,
            addedAt: Date.now(),
            priority,
            id
        };

        this.pool.set(id, entry);
        this.emit('messageAdded', message);

        return { success: true };
    }

    /**
     * Get messages for batching
     * @param limit Max number of messages
     * @param minWaitTime Optional filter for messages waiting at least X ms
     */
    getMessages(limit: number = 50, minWaitTime: number = 0): InnerTransaction[] {
        const now = Date.now();
        const entries = Array.from(this.pool.values())
            .filter(e => {
                const waitTime = now - e.addedAt;
                return waitTime >= minWaitTime;
            });

        // Sort by priority (descending)
        entries.sort((a, b) => b.priority - a.priority);

        return entries.slice(0, limit).map(e => e.message);
    }

    /**
     * Remove messages (e.g. after they are included in a block)
     */
    removeMessages(ids: string[]): void {
        ids.forEach(id => this.pool.delete(id));
    }

    /**
     * Get specific message
     */
    getMessage(from: string, nonce: number): InnerTransaction | undefined {
        return this.pool.get(`${from}:${nonce}`)?.message;
    }

    /**
     * Calculate priority based on Fee Density and Time Urgency
     */
    private calculatePriority(msg: InnerTransaction): number {
        // Core metric: Fee per byte (simplified as raw fee here)
        // Optimization: Validator earns more if they pack high-fee messages.

        // Base priority = Amount (Fee)
        let priority = msg.amount;

        // Time Boost: The longer it waits, the higher the priority?
        // OR: Fast Lane fees are high, so naturally high priority.
        // But low fee messages MUST wait.
        // So a lower fee message that HAS waited enough becomes valid to include.
        // It doesn't necessarily become "higher priority" revenue-wise,
        // but validators might want to clear them to reduce state size or purely altruistic/protocol rules?

        // For now, simple revenue maximization:
        return priority;
    }

    private removeLowPriorityMessage(): void {
        let lowestPriority = Infinity;
        let lowestId: string | null = null;

        for (const [id, entry] of this.pool.entries()) {
            if (entry.priority < lowestPriority) {
                lowestPriority = entry.priority;
                lowestId = id;
            }
        }

        if (lowestId) {
            this.pool.delete(lowestId);
        }
    }

    getStats() {
        return {
            size: this.pool.size,
            totalPendingFees: Array.from(this.pool.values()).reduce((sum, e) => sum + e.message.amount, 0)
        };
    }
}
