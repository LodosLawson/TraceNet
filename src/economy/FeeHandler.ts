import { EventEmitter } from 'events';
import { TRANSFER_FEE_CONFIG, SOCIAL_FEES } from './TokenConfig';
import { TreasuryManager } from './TreasuryManager';

/**
 * Fee Calculation Result
 */
export interface FeeCalculation {
    totalCost: number;
    fee: number;
    netAmount: number; // For social, this is content owner share. For transfer, usually 0 or burned.

    // Distribution breakdown
    nodeAmount: number;
    poolAmount: number;
    recycleAmount: number;
    devAmount: number;
    treasuryAmount: number; // Remaining or specific treasury share
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

        const distribution = this.calculateDistribution(fee);

        return {
            totalCost: amount,
            fee,
            netAmount, // Amount receiver gets
            nodeAmount: 0, // Context dependent
            poolAmount: distribution.pool,
            recycleAmount: distribution.recycle,
            devAmount: distribution.dev,
            treasuryAmount: 0,
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
    /**
     * Calculate social interaction fee (like/comment)
     */
    calculateSocialFee(
        action: 'like' | 'comment' | 'message'
    ): FeeCalculation {
        const config = SOCIAL_FEES[action];
        const totalCost = config.cost;
        const fee = totalCost;

        // Use helper to calculate split
        const distribution = this.calculateDistribution(fee);

        // For social actions (Like/Comment), the 'netAmount' usually refers to what key people get?
        // Actually, in the new model:
        // 45% Node/Creator
        // 30% Pool
        // 20% Recycle
        // 5% Dev

        // IF it's a social action, the "Primary" 45% goes to the Content Creator (if no node) or Node?
        // Technical Report says: "45% Node Owner / Creator".
        // Blockchain.ts logic distinguishes: "If Node Wallet -> Node gets it. Else -> Creator gets it?"
        // Or "Node gets 45% AND Creator gets ?"
        // Let's assume the "Primary" share is the one directed to the intended recipient (Creator) or Facilitator (Node).
        // For LIKE/COMMENT -> To Creator.
        // For TRANSFER -> To Node.

        return {
            totalCost,
            fee,
            netAmount: distribution.primary, // This is the Creator/Node share
            nodeAmount: 0, // Assigned by Blockchain depending on context
            poolAmount: distribution.pool,
            recycleAmount: distribution.recycle,
            devAmount: distribution.dev,
            treasuryAmount: 0 // Using specific buckets now
        };
    }

    /**
     * Helper: Calculate fee distribution based on TokenConfig
     */
    public calculateDistribution(totalFee: number): { primary: number; pool: number; recycle: number; dev: number } {
        // Percentages
        const pPrimary = 0.45;
        const pPool = 0.30;
        const pRecycle = 0.20;
        // Dev is remainder to avoid rounding loss

        const primary = Math.floor(totalFee * pPrimary);
        const pool = Math.floor(totalFee * pPool);
        const recycle = Math.floor(totalFee * pRecycle);
        const dev = totalFee - primary - pool - recycle; // Approx 5%

        return { primary, pool, recycle, dev };
    }

    /**
     * Process social interaction fee (Just emits event, actual balance move is in Blockchain)
     */
    processSocialFee(
        action: 'like' | 'comment' | 'message',
        txId: string
    ): FeeCalculation {
        const calculation = this.calculateSocialFee(action);

        // Emit event
        this.emit('fee.collected', {
            feeType: `social_${action}`,
            amount: calculation.fee,
            distribution: calculation,
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
            distribution: {
                primary: calculation.netAmount,
                pool: calculation.poolAmount,
                recycle: calculation.recycleAmount,
                dev: calculation.devAmount
            }
        };

        if (calculation.netAmount > 0) {
            result.contentOwner = calculation.netAmount;
            result.contentOwnerLT = calculation.netAmount / 100_000_000;
        }

        return result;
    }
}
