import { TransactionModel, TransactionType } from '../../blockchain/models/Transaction';
import { Blockchain } from '../../blockchain/core/Blockchain';

/**
 * Reward rules configuration
 */
export interface RewardRules {
    postCreation: number;           // Reward for creating a post
    firstPostBonus: number;         // One-time bonus for first post
    likeMilestone: number;          // Reward per 100 likes (to author)
    comment: number;                // Reward for commenting
    share: number;                  // Reward for sharing
}

/**
 * Spending rules configuration
 */
export interface SpendingRules {
    messagePayment: number;         // Cost to send a message
    promotePost: number;            // Cost to promote a post
}

/**
 * Reward Engine for managing social action rewards
 */
export class RewardEngine {
    private blockchain: Blockchain;
    private rules: RewardRules;
    private spendingRules: SpendingRules;
    private firstPostUsers: Set<string>;
    private systemWalletId: string;

    constructor(
        blockchain: Blockchain,
        rules?: Partial<RewardRules>,
        spendingRules?: Partial<SpendingRules>,
        systemWalletId: string = 'SYSTEM'
    ) {
        this.blockchain = blockchain;
        this.systemWalletId = systemWalletId;
        this.firstPostUsers = new Set();

        // Default reward rules (in smallest unit, 8 decimals)
        this.rules = {
            postCreation: rules?.postCreation ?? 1000000000,      // 10 TRN
            firstPostBonus: rules?.firstPostBonus ?? 5000000000,  // 50 TRN
            likeMilestone: rules?.likeMilestone ?? 200000000,     // 2 TRN
            comment: rules?.comment ?? 100000000,                 // 1 TRN
            share: rules?.share ?? 50000000,                      // 0.5 TRN
        };

        this.spendingRules = {
            messagePayment: spendingRules?.messagePayment ?? 10000000,    // 0.1 TRN
            promotePost: spendingRules?.promotePost ?? 500000000,         // 5 TRN
        };
    }

    /**
     * Handle post creation reward
     */
    async handlePostCreated(userId: string, walletId: string): Promise<string[]> {
        const txIds: string[] = [];

        // Base reward for post creation
        const postRewardTx = TransactionModel.create(
            this.systemWalletId,
            walletId,
            TransactionType.REWARD,
            this.rules.postCreation,
            0,
            0, // Nonce
            {
                type: 'post_creation',
                user_id: userId,
                timestamp: Date.now(),
            }
        );
        txIds.push(postRewardTx.tx_id);

        // First post bonus
        if (!this.firstPostUsers.has(userId)) {
            const firstPostBonusTx = TransactionModel.create(
                this.systemWalletId,
                walletId,
                TransactionType.REWARD,
                this.rules.firstPostBonus,
                0,
                0, // Nonce
                {
                    type: 'first_post_bonus',
                    user_id: userId,
                    timestamp: Date.now(),
                }
            );
            txIds.push(firstPostBonusTx.tx_id);
            this.firstPostUsers.add(userId);
        }

        return txIds;
    }

    /**
     * Handle like milestone reward (every 100 likes)
     */
    async handleLikeMilestone(
        postAuthorWalletId: string,
        likeCount: number
    ): Promise<string | null> {
        // Check if milestone reached (every 100 likes)
        if (likeCount % 100 === 0 && likeCount > 0) {
            const milestoneTx = TransactionModel.create(
                this.systemWalletId,
                postAuthorWalletId,
                TransactionType.REWARD,
                this.rules.likeMilestone,
                0,
                0, // Nonce
                {
                    type: 'like_milestone',
                    like_count: likeCount,
                    timestamp: Date.now(),
                }
            );

            return milestoneTx.tx_id;
        }

        return null;
    }

    /**
     * Handle comment reward
     */
    async handleComment(commenterWalletId: string): Promise<string> {
        const commentTx = TransactionModel.create(
            this.systemWalletId,
            commenterWalletId,
            TransactionType.REWARD,
            this.rules.comment,
            0,
            0, // Nonce
            {
                type: 'comment',
                timestamp: Date.now(),
            }
        );

        return commentTx.tx_id;
    }

    /**
     * Handle share reward
     */
    async handleShare(sharerWalletId: string): Promise<string> {
        const shareTx = TransactionModel.create(
            this.systemWalletId,
            sharerWalletId,
            TransactionType.REWARD,
            this.rules.share,
            0,
            0, // Nonce
            {
                type: 'share',
                timestamp: Date.now(),
            }
        );

        return shareTx.tx_id;
    }

    /**
     * Handle message payment
     */
    async handleMessagePayment(
        senderWalletId: string,
        recipientWalletId: string
    ): Promise<string> {
        const messageTx = TransactionModel.create(
            senderWalletId,
            recipientWalletId,
            TransactionType.MESSAGE_PAYMENT,
            this.spendingRules.messagePayment,
            0,
            0, // Nonce
            {
                type: 'message_payment',
                timestamp: Date.now(),
            }
        );

        return messageTx.tx_id;
    }

    /**
     * Get reward rules
     */
    getRewardRules(): RewardRules {
        return { ...this.rules };
    }

    /**
     * Get spending rules
     */
    getSpendingRules(): SpendingRules {
        return { ...this.spendingRules };
    }

    /**
     * Update reward rules (admin only)
     */
    updateRewardRules(updates: Partial<RewardRules>): void {
        this.rules = { ...this.rules, ...updates };
    }

    /**
     * Update spending rules (admin only)
     */
    updateSpendingRules(updates: Partial<SpendingRules>): void {
        this.spendingRules = { ...this.spendingRules, ...updates };
    }

    /**
     * Check if user has received first post bonus
     */
    hasReceivedFirstPostBonus(userId: string): boolean {
        return this.firstPostUsers.has(userId);
    }

    /**
     * Get statistics
     */
    getStats(): {
        firstPostBonusCount: number;
        rewardRules: RewardRules;
        spendingRules: SpendingRules;
    } {
        return {
            firstPostBonusCount: this.firstPostUsers.size,
            rewardRules: this.getRewardRules(),
            spendingRules: this.getSpendingRules(),
        };
    }
}
