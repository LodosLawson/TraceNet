import { InnerTransaction, TransactionModel, TransactionType } from '../blockchain/models/Transaction';
import { Mempool } from './Mempool';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import EventEmitter from 'events';

/**
 * Pool for batching social interactions (Likes, Comments)
 * Waits for a time window (e.g. 10 mins) before creating a block/batch.
 */
export class SocialPool extends EventEmitter {
    private mempool: Mempool;
    private nodePrivateKey: string;
    private nodePublicKey: string;

    // Separate queues for different batching policies
    private likeQueue: InnerTransaction[] = [];
    private commentQueue: InnerTransaction[] = [];

    // Check if we need other queues or a default one. 
    // For now, SocialService only routes Likes and Comments here plus related fee txs.

    private likeFlushTimer: NodeJS.Timeout | null = null;
    private commentFlushTimer: NodeJS.Timeout | null = null;

    private readonly LIKE_BATCH_WINDOW_MS = 10 * 60 * 1000; // 10 Minutes
    private readonly COMMENT_BATCH_WINDOW_MS = 5 * 60 * 1000; // 5 Minutes

    // For Debug/Dev:
    // private readonly LIKE_BATCH_WINDOW_MS = 20 * 1000; 
    // private readonly COMMENT_BATCH_WINDOW_MS = 10 * 1000;

    constructor(
        mempool: Mempool,
        nodePrivateKey: string,
        nodePublicKey: string
    ) {
        super();
        this.mempool = mempool;
        this.nodePrivateKey = nodePrivateKey;
        this.nodePublicKey = nodePublicKey;
    }

    /**
     * Add a social action to the pool
     */
    addSocialAction(action: InnerTransaction): void {
        if (action.type === TransactionType.LIKE) {
            this.addToLikeQueue(action);
        } else if (action.type === TransactionType.COMMENT) {
            this.addToCommentQueue(action);
        } else {
            console.warn(`[SocialPool] Unknown social action type: ${action.type}. defaulting to Comment Queue (safer/faster).`);
            this.addToCommentQueue(action);
        }
    }

    private addToLikeQueue(action: InnerTransaction): void {
        this.likeQueue.push(action);
        console.log(`[SocialPool] Like Action added. Queue size: ${this.likeQueue.length}`);

        if (!this.likeFlushTimer) {
            console.log(`[SocialPool] Starting Like batch timer (${this.LIKE_BATCH_WINDOW_MS / 1000}s)...`);
            this.likeFlushTimer = setTimeout(() => {
                this.flushLikes();
            }, this.LIKE_BATCH_WINDOW_MS);
        }
    }

    private addToCommentQueue(action: InnerTransaction): void {
        this.commentQueue.push(action);
        console.log(`[SocialPool] Comment Action added. Queue size: ${this.commentQueue.length}`);

        if (!this.commentFlushTimer) {
            console.log(`[SocialPool] Starting Comment batch timer (${this.COMMENT_BATCH_WINDOW_MS / 1000}s)...`);
            this.commentFlushTimer = setTimeout(() => {
                this.flushComments();
            }, this.COMMENT_BATCH_WINDOW_MS);
        }
    }

    /**
     * Flush Like Queue
     */
    flushLikes(): void {
        if (this.likeQueue.length === 0) return;

        console.log(`[SocialPool] Flushing ${this.likeQueue.length} Likes to a Batch...`);
        this.createBatchTransaction(this.likeQueue, 'LIKES_BATCH');

        this.likeQueue = [];
        this.likeFlushTimer = null;
    }

    /**
     * Flush Comment Queue
     */
    flushComments(): void {
        if (this.commentQueue.length === 0) return;

        console.log(`[SocialPool] Flushing ${this.commentQueue.length} Comments to a Batch...`);
        this.createBatchTransaction(this.commentQueue, 'COMMENTS_BATCH');

        this.commentQueue = [];
        this.commentFlushTimer = null;
    }

    /**
     * Create and submit a BATCH transaction to mempool
     */
    private createBatchTransaction(actions: InnerTransaction[], batchTypeTag: string): void {
        // Create BATCH Transaction
        const batchTx = TransactionModel.create(
            this.nodePublicKey, // Sender: The Node itself (Batch Relayer)
            'BATCH_SERVICE', // Recipient (System ID)
            TransactionType.BATCH,
            0,
            0,
            Date.now(),
            {
                batch_type: batchTypeTag, // Tag for debugging/explorer
                transactions: [...actions]
            }
        );

        // Sign the transaction
        const signature = KeyManager.sign(batchTx.tx_id, this.nodePrivateKey);
        batchTx.sender_signature = signature;

        this.mempool.addTransaction(batchTx.toJSON());
        console.log(`[SocialPool] Batch ${batchTx.tx_id} (${batchTypeTag}) created, signed, and sent to Mempool.`);
        this.emit('batchCreated', batchTx);
    }

    /**
     * Flush legacy method (flushes everything)
     */
    flush(): void {
        this.flushLikes();
        this.flushComments();
    }

    /**
     * Get pending actions for a specific wallet (for balance calculation)
     */
    getPendingActions(walletId: string): InnerTransaction[] {
        const likes = this.likeQueue.filter(tx => tx.from_wallet === walletId);
        const comments = this.commentQueue.filter(tx => tx.from_wallet === walletId);
        return [...likes, ...comments];
    }

    /**
     * Get pending likes for content
     */
    getPendingLikesForContent(contentId: string): InnerTransaction[] {
        // We only care about the LIKE action, not the Fee/Pool actions
        return this.likeQueue.filter(tx =>
            tx.type === TransactionType.LIKE &&
            (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId)
        );
    }

    /**
     * Get pending comments for content
     */
    getPendingCommentsForContent(contentId: string): InnerTransaction[] {
        return this.commentQueue.filter(tx =>
            tx.type === TransactionType.COMMENT &&
            (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId)
        );
    }

    /**
     * Force flush (for testing/debug)
     */
    forceFlush(): void {
        if (this.likeFlushTimer) {
            clearTimeout(this.likeFlushTimer);
            this.likeFlushTimer = null;
        }
        if (this.commentFlushTimer) {
            clearTimeout(this.commentFlushTimer);
            this.commentFlushTimer = null;
        }
        this.flush();
    }
}
