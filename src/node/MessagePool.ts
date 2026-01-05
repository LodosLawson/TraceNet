import { InnerTransaction, TransactionType } from '../blockchain/models/Transaction';
import EventEmitter from 'events';
import { TOKEN_CONFIG } from '../economy/TokenConfig';

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

    // Batching State
    // "NORMAL" -> 10 mins
    // "LOW" -> 60 mins
    // Batching State
    private batchWindows: Map<string, number> = new Map(); // key (tier_category) -> endTime
    private pendingBatches: Map<string, InnerTransaction[]> = new Map(); // key -> messages[]

    constructor(maxSize: number = 50000, expirationTime: number = 24 * 60 * 60 * 1000) {
        super();
        this.pool = new Map();
        this.maxSize = maxSize;
        this.expirationTime = expirationTime;

        // Initialize batch containers

        // Initialize batch containers will be dynamic based on keys

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

        if (this.pool.size >= this.maxSize) {
            this.removeLowPriorityMessage();
        }

        const priorityVal = this.calculatePriority(message);

        // BATCHING LOGIC
        // Determine Priority Tier based on fee (simplified mapping for now)
        // In a real system, we'd check fee vs config. 
        // Assuming we can derive tier from fee or some other property if not explicit.
        // For this task, we will check message fee or assume based on metadata if available.
        // But `InnerTransaction` doesn't have a 'priority' string field.
        // We use Fee Thresholds.

        const { FAST, NORMAL, LOW } = TOKEN_CONFIG.FEE_TIERS;

        let tier = 'FAST';
        if (message.amount < FAST) {
            if (message.amount >= NORMAL) tier = 'NORMAL';
            else tier = 'LOW';
        }

        if (tier === 'NORMAL' || tier === 'LOW') {
            const category = this.getCategory(message.type);
            const batchKey = `${tier}_${category}`;

            // If category is NONE (e.g. Transfer), treat as individual/FAST regardless of fee? 
            // Or maybe batch transfers too? User only asked for Social/Messages.
            // Let's force transfers to individual for now unless low fee.
            if (category === 'NONE') {
                // Fallthrough to individual pool
            } else {
                const now = Date.now();
                let endTime = this.batchWindows.get(batchKey);

                if (!endTime || now > endTime) {
                    // Start new window
                    // const duration = tier === 'NORMAL' ? 10 * 60 * 1000 : 60 * 60 * 1000;
                    // For dev/testing, let's keep it smaller or configurable?
                    // User said "10 minutes".
                    const duration = tier === 'NORMAL' ? 10 * 60 * 1000 : 60 * 60 * 1000;

                    endTime = now + duration;
                    this.batchWindows.set(batchKey, endTime);
                    this.pendingBatches.set(batchKey, []);
                    console.log(`[MessagePool] Starting new ${batchKey} batch window. Ends at ${new Date(endTime).toISOString()}`);
                }

                // Add to pending batch
                let batch = this.pendingBatches.get(batchKey);
                if (!batch) {
                    batch = [];
                    this.pendingBatches.set(batchKey, batch);
                }
                batch.push(message);

                this.emit('messageAdded', message);
                return { success: true };
            }
        }

        // FAST messages go to standard pool
        const priority = priorityVal;

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

        // CHECK BATCH WINDOWS
        // If a window has closed, we create a BATCH transaction and include it
        // CHECK BATCH WINDOWS
        // Iterate all active windows
        for (const [key, endTime] of this.batchWindows.entries()) {
            const pending = this.pendingBatches.get(key) || [];

            if (now >= endTime && pending.length > 0) {
                console.log(`[MessagePool] Closing ${key} batch window. Bundling ${pending.length} messages.`);

                const category = key.split('_')[1]; // NORMAL_SOCIAL -> SOCIAL
                const batchType = category === 'MESSAGE' ? TransactionType.CONVERSATION_BATCH : TransactionType.BATCH;

                const batchTx: any = {
                    type: batchType,
                    from_wallet: 'SYSTEM',
                    to_wallet: 'SYSTEM',
                    amount: 0,
                    fee: 0,
                    nonce: 0,
                    timestamp: now,
                    payload: {
                        transactions: [...pending]
                    },
                    signature: '',
                    tx_id: `BATCH-${key}-${now}`
                };

                entries.push({
                    message: batchTx,
                    addedAt: now,
                    priority: 99999, // High priority
                    id: batchTx.tx_id
                });

                // Clear pending
                this.pendingBatches.set(key, []);
                this.batchWindows.delete(key);
            }
        }

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
            totalPendingFees: Array.from(this.pool.values()).reduce((sum, e) => sum + e.message.amount, 0),
            pendingBatches: Array.from(this.pendingBatches.entries()).map(([k, v]) => `${k}: ${v.length}`)
        };
    }

    private getCategory(type: TransactionType): 'SOCIAL' | 'MESSAGE' | 'NONE' {
        switch (type) {
            case TransactionType.LIKE:
            case TransactionType.COMMENT:
            case TransactionType.SHARE:
            case TransactionType.POST_CONTENT:
            case TransactionType.FOLLOW:
            case TransactionType.UNFOLLOW:
                return 'SOCIAL';
            case TransactionType.PRIVATE_MESSAGE:
                return 'MESSAGE';
            default:
                return 'NONE';
        }
    }
}
