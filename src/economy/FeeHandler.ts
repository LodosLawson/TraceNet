import { EventEmitter } from 'events';
import { TRANSFER_FEE_CONFIG, SOCIAL_FEES } from './TokenConfig';
import { TreasuryManager } from './TreasuryManager';

/**
 * Fee Calculation Result
 */
export interface FeeCalculation {
    totalCost: number;
    fee: number;
    netAmount: number;
    contentOwnerAmount?: number;
    treasuryAmount: number;
}

/**
 * Fee Handler
 * Handles fee calculation and distribution for all transaction types
 */
export class FeeHandler extends EventEmitter {
    private treasuryManager: TreasuryManager;

    constructor(treasuryManager: TreasuryManager) {
        super();
        this.treasuryManager = treasuryManager;
    }

    /**
     * Calculate transfer fee
     */
    calculateTransferFee(amount: number): FeeCalculation {
        const fee = Math.floor(amount * TRANSFER_FEE_CONFIG.feeRate);
        const netAmount = amount - fee;
        const treasuryAmount = fee;

        return {
            totalCost: amount,
            fee,
            netAmount,
            treasuryAmount,
        };
    }

    /**
     * Process transfer fee
     */
    processTransferFee(amount: number, txId: string): FeeCalculation {
        const calculation = this.calculateTransferFee(amount);

        // Add to treasury
        this.treasuryManager.addIncome(calculation.treasuryAmount, 'transferFees');

        // Emit event
        this.emit('fee.collected', {
            feeType: 'transfer',
            amount: calculation.fee,
            treasuryAmount: calculation.treasuryAmount,
            txId,
            timestamp: Date.now(),
        });

        return calculation;
    }

    /**
     * Calculate social interaction fee (like/comment)
     */
    calculateSocialFee(
        action: 'like' | 'comment' | 'message'
    ): FeeCalculation {
        const config = SOCIAL_FEES[action];
        const totalCost = config.cost;

        if (action === 'message') {
            return {
                totalCost,
                fee: totalCost,
                netAmount: 0,
                treasuryAmount: totalCost,
            };
        }

        const contentOwnerAmount = Math.floor(totalCost * (config as any).contentOwnerShare);
        const treasuryAmount = totalCost - contentOwnerAmount;

        return {
            totalCost,
            fee: totalCost,
            netAmount: contentOwnerAmount,
            contentOwnerAmount,
            treasuryAmount,
        };
    }

    /**
     * Process social interaction fee
     */
    processSocialFee(
        action: 'like' | 'comment' | 'message',
        txId: string
    ): FeeCalculation {
        const calculation = this.calculateSocialFee(action);

        // Add to treasury
        this.treasuryManager.addIncome(calculation.treasuryAmount, 'socialFees');

        // Emit event
        this.emit('fee.collected', {
            feeType: `social_${action}`,
            amount: calculation.fee,
            contentOwnerAmount: calculation.contentOwnerAmount || 0,
            treasuryAmount: calculation.treasuryAmount,
            txId,
            timestamp: Date.now(),
        });

        return calculation;
    }

    /**
     * Validate user has sufficient balance for action
     */
    validateBalance(userBalance: number, requiredAmount: number): {
        valid: boolean;
        error?: string;
    } {
        if (userBalance < requiredAmount) {
            return {
                valid: false,
                error: `Insufficient balance. Required: ${requiredAmount / 100_000_000} LT, Available: ${userBalance / 100_000_000} LT`,
            };
        }

        return { valid: true };
    }

    /**
     * Get fee for action type
     */
    getFeeForAction(action: 'transfer' | 'like' | 'comment' | 'message', amount?: number): number {
        if (action === 'transfer' && amount) {
            return Math.floor(amount * TRANSFER_FEE_CONFIG.feeRate);
        }

        if (action === 'like' || action === 'comment') {
            return SOCIAL_FEES[action].cost;
        }

        if (action === 'message') {
            return SOCIAL_FEES.message.cost;
        }

        return 0;
    }

    /**
     * Get fee breakdown for UI display
     */
    getFeeBreakdown(action: 'transfer' | 'like' | 'comment' | 'message', amount?: number): {
        action: string;
        totalCost: number;
        totalCostLT: number;
        contentOwner?: number;
        contentOwnerLT?: number;
        treasury: number;
        treasuryLT: number;
    } {
        let calculation: FeeCalculation;

        if (action === 'transfer' && amount) {
            calculation = this.calculateTransferFee(amount);
        } else {
            calculation = this.calculateSocialFee(action as 'like' | 'comment' | 'message');
        }

        const result: any = {
            action,
            totalCost: calculation.totalCost,
            totalCostLT: calculation.totalCost / 100_000_000,
            treasury: calculation.treasuryAmount,
            treasuryLT: calculation.treasuryAmount / 100_000_000,
        };

        if (calculation.contentOwnerAmount) {
            result.contentOwner = calculation.contentOwnerAmount;
            result.contentOwnerLT = calculation.contentOwnerAmount / 100_000_000;
        }

        return result;
    }
}
