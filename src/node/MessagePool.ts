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

    // Batching State
    // "NORMAL" -> 10 mins
    // "LOW" -> 60 mins
    private batchWindows: Map<string, number> = new Map(); // priority -> endTime
    private pendingBatches: Map<string, InnerTransaction[]> = new Map(); // priority -> messages[]

    constructor(maxSize: number = 50000, expirationTime: number = 24 * 60 * 60 * 1000) {
        super();
        this.pool = new Map();
        this.maxSize = maxSize;
        this.expirationTime = expirationTime;

        // Initialize batch containers
        this.pendingBatches.set('NORMAL', []);
        this.pendingBatches.set('LOW', []);
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

        const FEE_FAST = 0.00001;
        const FEE_STANDARD = 0.0000001; // Normal
        const FEE_LOW = 0.00000001;     // Low

        let tier = 'FAST';
        if (message.amount < FEE_FAST) {
            if (message.amount >= FEE_STANDARD) tier = 'NORMAL';
            else tier = 'LOW';
        }

        if (tier === 'NORMAL' || tier === 'LOW') {
            const now = Date.now();
            let endTime = this.batchWindows.get(tier);

            if (!endTime || now > endTime) {
                // Start new window
                const duration = tier === 'NORMAL' ? 10 * 60 * 1000 : 60 * 60 * 1000;
                endTime = now + duration;
                this.batchWindows.set(tier, endTime);
                // Clear old batch if any remaining (should have been flushed, but just in case)
                this.pendingBatches.set(tier, []);
                console.log(`[MessagePool] Starting new ${tier} batch window. Ends at ${new Date(endTime).toISOString()}`);
            }

            // Add to pending batch
            const batch = this.pendingBatches.get(tier)!;
            batch.push(message);

            // We verify ID uniqueness inside batch too?
            // Simple check
            // We also add to main pool? 
            // NO. Pending batch messages are NOT in the main pool for individual mining.
            // They are held separately.

            this.emit('messageAdded', message); // Emit so UI sees it
            return { success: true };
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
        ['NORMAL', 'LOW'].forEach(tier => {
            const endTime = this.batchWindows.get(tier);
            const pending = this.pendingBatches.get(tier) || [];

            if (endTime && now >= endTime && pending.length > 0) {
                console.log(`[MessagePool] Closing ${tier} batch window. Bundling ${pending.length} messages.`);

                // Create BATCH Transaction
                // Note: The Miner/Validator calls getMessages. 
                // We construct a BATCH tx here.
                // The 'from_wallet' should be the Validator's ID? 
                // We don't have the validator's private key here to sign.
                // However, BATCH txs might be 'unsigned' container types if the block itself is signed?
                // OR the Validator constructs it. 
                // Detailed Design: "Validator ... signs the batch container".
                // Detailed Design: MessagePool gives raw messages. Validator constructs block.
                // If we return a "BATCH" type object here, the validator needs to sign it.
                // But `getMessages` returns `InnerTransaction[]`.
                // We'll wrap it in a special InnerTransaction or assume Validator handles it?
                // Let's create a BATCH tx but we need a way to pass it.

                // Hack/Pattern: We return a special "Pseudo-Transaction" that the Validator recognizes
                // OR we just return the raw messages but the Validator logic in `RPCServer` or `Miner` needs to batch them.

                // Better approach for this architecture:
                // `MessagePool` is just a pool. 
                // But the requirement says "Wait 10 mins then batch".
                // If we just return them individually, the miner might include them individually.
                // WE MUST BUNDLE THEM.

                // We create a BATCH transaction. 
                // Sender = "SYSTEM_BATCHER" (or similar placeholder), Signature = "PENDING_VALIDATOR_SIGN"
                // The Block Creator (Miner) sees this, signs it, and puts it in block.

                const batchTx: any = {
                    type: 'BATCH', // or CONVERSATION_BATCH
                    from_wallet: 'SYSTEM', // Miner will replace with their ID
                    to_wallet: 'SYSTEM',
                    amount: 0,
                    fee: 0, // Validator decides?
                    nonce: 0, // Validator sets
                    timestamp: now,
                    payload: {
                        transactions: [...pending] // Copy
                    },
                    signature: '', // Miner signs
                    tx_id: `BATCH-${tier}-${now}`
                };

                entries.push({
                    message: batchTx,
                    addedAt: now,
                    priority: 99999, // High priority to ensure inclusion
                    id: batchTx.tx_id
                });

                // Clear pending
                this.pendingBatches.set(tier, []);
                this.batchWindows.delete(tier);
            }
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
            totalPendingFees: Array.from(this.pool.values()).reduce((sum, e) => sum + e.message.amount, 0),
            pendingBatches: {
                NORMAL: this.pendingBatches.get('NORMAL')?.length || 0,
                LOW: this.pendingBatches.get('LOW')?.length || 0
            }
        };
    }
}
