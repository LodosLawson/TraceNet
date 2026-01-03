/**
 * Social Action Pool
 * 
 * Batches LIKE and COMMENT transactions for processing every 10 minutes
 * Similar to MessagePool but for social actions
 */

export interface PendingSocialAction {
    action_type: 'LIKE' | 'COMMENT';
    wallet_id: string;
    content_id: string;
    comment_text?: string;
    parent_comment_id?: string;
    timestamp: number;
    processing_at: number; // When this will be processed
}

export class SocialPool {
    private pool: Map<string, PendingSocialAction> = new Map();
    private readonly BATCH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

    /**
     * Add social action to pool
     */
    addAction(action: Omit<PendingSocialAction, 'timestamp' | 'processing_at'>): {
        success: boolean;
        action_id: string;
        processing_at: number;
        wait_time_seconds: number;
    } {
        const now = Date.now();
        const nextBatchTime = this.getNextBatchTime(now);

        // Create unique action ID
        const action_id = `${action.action_type}_${action.wallet_id}_${action.content_id}_${now}`;

        // Check for duplicates
        if (this.pool.has(action_id)) {
            return {
                success: false,
                action_id,
                processing_at: 0,
                wait_time_seconds: 0,
            };
        }

        const pendingAction: PendingSocialAction = {
            ...action,
            timestamp: now,
            processing_at: nextBatchTime,
        };

        this.pool.set(action_id, pendingAction);

        const waitTimeMs = nextBatchTime - now;
        const waitTimeSeconds = Math.ceil(waitTimeMs / 1000);

        console.log(`[SocialPool] Added ${action.action_type} to pool, processing in ${waitTimeSeconds}s`);

        return {
            success: true,
            action_id,
            processing_at: nextBatchTime,
            wait_time_seconds: waitTimeSeconds,
        };
    }

    /**
     * Get actions ready for processing
     */
    getReadyActions(): PendingSocialAction[] {
        const now = Date.now();
        const ready: PendingSocialAction[] = [];

        for (const [id, action] of this.pool.entries()) {
            if (action.processing_at <= now) {
                ready.push(action);
                this.pool.delete(id); // Remove from pool
            }
        }

        return ready;
    }

    /**
     * Get all pending actions (for status check)
     */
    getAllActions(): PendingSocialAction[] {
        return Array.from(this.pool.values());
    }

    /**
     * Get pool size
     */
    getSize(): number {
        return this.pool.size;
    }

    /**
     * Calculate next batch processing time
     * Rounds up to nearest 10-minute mark
     */
    private getNextBatchTime(now: number): number {
        const intervalMs = this.BATCH_INTERVAL_MS;
        const nextBatch = Math.ceil(now / intervalMs) * intervalMs;
        return nextBatch;
    }

    /**
     * Get time until next batch
     */
    getTimeUntilNextBatch(): number {
        const now = Date.now();
        const nextBatch = this.getNextBatchTime(now);
        return Math.max(0, nextBatch - now);
    }

    /**
     * Clear pool (admin only)
     */
    clear(): void {
        this.pool.clear();
        console.log('[SocialPool] Pool cleared');
    }
}
