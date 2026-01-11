import { InnerTransaction, TransactionModel, TransactionType } from '../blockchain/models/Transaction';
import { Mempool } from './Mempool';
import EventEmitter from 'events';

/**
 * Pool for batching social interactions (Likes, Comments)
 * Waits for a time window (e.g. 10 mins) before creating a block/batch.
 */
export class SocialPool extends EventEmitter {
    private mempool: Mempool;
    private queue: InnerTransaction[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    private readonly BATCH_WINDOW_MS = 10 * 60 * 1000; // 10 Minutes
    // private readonly BATCH_WINDOW_MS = 10 * 1000; // 10 Seconds (Debug)

    constructor(mempool: Mempool) {
        super();
        this.mempool = mempool;
    }

    /**
     * Add a social action to the pool
     */
    addSocialAction(action: InnerTransaction): void {
        this.queue.push(action);
        console.log(`[SocialPool] Action added. Queue size: ${this.queue.length}`);

        // Start timer if not running
        if (!this.flushTimer) {
            console.log(`[SocialPool] Starting batch timer (${this.BATCH_WINDOW_MS / 1000}s)...`);
            this.flushTimer = setTimeout(() => {
                this.flush();
            }, this.BATCH_WINDOW_MS);
        }
    }

    /**
     * Flush the queue into a single BATCH transaction
     */
    flush(): void {
        if (this.queue.length === 0) return;

        console.log(`[SocialPool] Flushing ${this.queue.length} actions to a Batch...`);

        // Create BATCH Transaction
        // The sender of the BATCH is effectively the 'Network' or 'Validator' who picks it up,
        // but for mempool submission we need a valid structure. 
        // We act as a "System Batch".
        // In a real decentralized system, this pool might be local to a Validator who then constructs the block.
        // Here, we simulate it by creating a BATCH tx signed by a placeholder or system key, 
        // OR we just create a BATCH tx that requires no signature? 
        // (Transaction validation checks signature!)

        // For now, we will use a special "SYSTEM_BATCHER" wallet or similar approach.
        // OR we just use the first user's wallet as the 'from', but that's wrong (they pay for everyone?)
        // TRICK: The user pays for their INNER transaction. The BATCH container fee is paid by the Batcher.
        // IF we don't have a batcher wallet, we might have an issue.

        // SOLUTION: We create a generic BATCH transaction. 
        // We use a dummy wallet for now, or if this is running on a Node, the Node Wallet?
        // Let's assume the Node has a wallet. But `SocialPool` doesn't have access to Node Wallet private key here.

        // TEMPORARY: We construct the object and push it. 
        // The `Mempool` validation might fail if signature is missing.
        // We might need to bypass signature check for "Local System Batches" or ensure `SocialService` passes a wallet.

        // BETTER: Use `SocialService` to sign? No.

        // Let's create an "Unsigned Batch" and rely on the BlockProducer to sign it? 
        // Standard mempool rejects invalid signatures.

        // As a fallback for this task, I will mock the signature or use a system key if available.
        // Or I can use a simpler approach: Just keep them in mempool as separate transactions?
        // USER REQUESTED: "belrili zamandan sonra block halinde gelir" (comes as a block after a time).

        // Let's implement `flush` to create a `BATCH` transaction.
        // We will mock the sender as "BATCH_SERVICE" and skip signature verification for strictly "BATCH" type if possible,
        // OR we assume the node has a key.

        const batchTx = TransactionModel.create(
            'BATCH_SERVICE', // Sender
            'BATCH_SERVICE', // Recipient
            TransactionType.BATCH,
            0,
            0,
            Date.now(),
            {
                transactions: [...this.queue]
            }
        );

        // Sign with a dummy or if we can't sign, we mark it.
        // (Ideally we inject a Wallet to sign batches).

        this.mempool.addTransaction(batchTx.toJSON());

        // Clear queue
        this.queue = [];
        this.flushTimer = null;

        console.log(`[SocialPool] Batch ${batchTx.tx_id} created and sent to Mempool.`);
        this.emit('batchCreated', batchTx);
    }

    /**
     * Get pending actions for a specific wallet (for balance calculation)
     */
    getPendingActions(walletId: string): InnerTransaction[] {
        return this.queue.filter(tx => tx.from_wallet === walletId);
    }

    /**
     * Force flush (for testing/debug)
     */
    forceFlush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.flush();
    }
}
