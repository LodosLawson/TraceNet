import { TransactionModel, TransactionType } from '../blockchain/models/Transaction';
import { Blockchain } from '../blockchain/core/Blockchain';

/**
 * Reward configuration
 */
export interface RewardConfig {
    blockReward: number;
    signatureReward: number;
    feeDistributionPercent: number; // Percentage of fees to distribute to validators
}

/**
 * Reward record
 */
export interface RewardRecord {
    validator_id: string;
    amount: number;
    type: 'block_production' | 'signature' | 'fee_share';
    block_index: number;
    timestamp: number;
    tx_id?: string;
}

/**
 * Reward distributor for validator incentives
 */
export class RewardDistributor {
    private blockchain: Blockchain;
    private config: RewardConfig;
    private rewards: RewardRecord[];
    private systemWalletId: string;

    constructor(
        blockchain: Blockchain,
        config: RewardConfig,
        systemWalletId: string = 'SYSTEM'
    ) {
        this.blockchain = blockchain;
        this.config = config;
        this.rewards = [];
        this.systemWalletId = systemWalletId;
    }

    /**
     * Distribute rewards for block production
     */
    distributeBlockReward(
        blockIndex: number,
        producerId: string
    ): TransactionModel[] {
        const rewardTxs: TransactionModel[] = [];

        // Block production reward
        const blockRewardTx = TransactionModel.create(
            this.systemWalletId,
            producerId,
            TransactionType.REWARD,
            this.config.blockReward,
            0,
            0, // Nonce
            {
                type: 'block_production',
                block_index: blockIndex,
                description: 'Block production reward',
            }
        );

        rewardTxs.push(blockRewardTx);

        // Record reward
        this.rewards.push({
            validator_id: producerId,
            amount: this.config.blockReward,
            type: 'block_production',
            block_index: blockIndex,
            timestamp: Date.now(),
            tx_id: blockRewardTx.tx_id,
        });

        return rewardTxs;
    }

    /**
     * Distribute rewards for transaction signatures
     */
    distributeSignatureRewards(
        blockIndex: number,
        validatorIds: string[]
    ): TransactionModel[] {
        const rewardTxs: TransactionModel[] = [];

        for (const validatorId of validatorIds) {
            const signatureRewardTx = TransactionModel.create(
                this.systemWalletId,
                validatorId,
                TransactionType.REWARD,
                this.config.signatureReward,
                0,
                0, // Nonce
                {
                    type: 'signature',
                    block_index: blockIndex,
                    description: 'Transaction signature reward',
                }
            );

            rewardTxs.push(signatureRewardTx);

            // Record reward
            this.rewards.push({
                validator_id: validatorId,
                amount: this.config.signatureReward,
                type: 'signature',
                block_index: blockIndex,
                timestamp: Date.now(),
                tx_id: signatureRewardTx.tx_id,
            });
        }

        return rewardTxs;
    }

    /**
     * Distribute transaction fees to validators
     */
    distributeFeeRewards(
        blockIndex: number,
        totalFees: number,
        validatorIds: string[]
    ): TransactionModel[] {
        if (validatorIds.length === 0 || totalFees === 0) {
            return [];
        }

        const rewardTxs: TransactionModel[] = [];

        // Calculate distributable fees
        const distributableFees = Math.floor(
            (totalFees * this.config.feeDistributionPercent) / 100
        );

        // Distribute equally among validators
        const rewardPerValidator = Math.floor(distributableFees / validatorIds.length);

        if (rewardPerValidator === 0) {
            return [];
        }

        for (const validatorId of validatorIds) {
            const feeRewardTx = TransactionModel.create(
                this.systemWalletId,
                validatorId,
                TransactionType.REWARD,
                rewardPerValidator,
                0,
                0, // Nonce
                {
                    type: 'fee_share',
                    block_index: blockIndex,
                    total_fees: totalFees,
                    description: 'Transaction fee share',
                }
            );

            rewardTxs.push(feeRewardTx);

            // Record reward
            this.rewards.push({
                validator_id: validatorId,
                amount: rewardPerValidator,
                type: 'fee_share',
                block_index: blockIndex,
                timestamp: Date.now(),
                tx_id: feeRewardTx.tx_id,
            });
        }

        return rewardTxs;
    }

    /**
     * Get total rewards for a validator
     */
    getValidatorRewards(validatorId: string): {
        total: number;
        blockRewards: number;
        signatureRewards: number;
        feeRewards: number;
        count: number;
    } {
        const validatorRewards = this.rewards.filter(
            (r) => r.validator_id === validatorId
        );

        return {
            total: validatorRewards.reduce((sum, r) => sum + r.amount, 0),
            blockRewards: validatorRewards
                .filter((r) => r.type === 'block_production')
                .reduce((sum, r) => sum + r.amount, 0),
            signatureRewards: validatorRewards
                .filter((r) => r.type === 'signature')
                .reduce((sum, r) => sum + r.amount, 0),
            feeRewards: validatorRewards
                .filter((r) => r.type === 'fee_share')
                .reduce((sum, r) => sum + r.amount, 0),
            count: validatorRewards.length,
        };
    }

    /**
     * Get reward statistics
     */
    getStats(): {
        totalRewardsDistributed: number;
        totalBlockRewards: number;
        totalSignatureRewards: number;
        totalFeeRewards: number;
        uniqueValidators: number;
        rewardCount: number;
    } {
        const uniqueValidators = new Set(this.rewards.map((r) => r.validator_id));

        return {
            totalRewardsDistributed: this.rewards.reduce((sum, r) => sum + r.amount, 0),
            totalBlockRewards: this.rewards
                .filter((r) => r.type === 'block_production')
                .reduce((sum, r) => sum + r.amount, 0),
            totalSignatureRewards: this.rewards
                .filter((r) => r.type === 'signature')
                .reduce((sum, r) => sum + r.amount, 0),
            totalFeeRewards: this.rewards
                .filter((r) => r.type === 'fee_share')
                .reduce((sum, r) => sum + r.amount, 0),
            uniqueValidators: uniqueValidators.size,
            rewardCount: this.rewards.length,
        };
    }

    /**
     * Get recent rewards
     */
    getRecentRewards(limit: number = 100): RewardRecord[] {
        return this.rewards.slice(-limit);
    }

    /**
     * Export rewards to JSON
     */
    toJSON(): RewardRecord[] {
        return [...this.rewards];
    }

    /**
     * Import rewards from JSON
     */
    loadFromJSON(data: RewardRecord[]): void {
        this.rewards = [...data];
    }
}
