/**
 * TraceNet V3.0 Fee Calculator
 * 
 * Implements dynamic percentage-based fees and TRN economics
 */

export class FeeCalculator {
    // Base fee for ALL transactions (goes to mining pool)
    static readonly BASE_NODE_FEE = 10; // 0.0000001 TRN

    // Transfer fee tiers (percentage-based on recipient count)
    static readonly TRANSFER_FEE_TIERS = [
        { maxTransfers: 100, percentage: 0.0001 },   // 0.01%
        { maxTransfers: 200, percentage: 0.001 },    // 0.10%
        { maxTransfers: 300, percentage: 0.01 },     // 1.00%
        { maxTransfers: Infinity, percentage: 0.03 } // 3.00%
    ];

    // Messaging fees (units)
    static readonly MESSAGE_FEES = {
        FAST: 100,    // 0.000001 TRN (instant)
        NORMAL: 10,   // 0.0000001 TRN (10 min batch)
        SLOW: 1       // 0.00000001 TRN (1 hour batch)
    };

    // Social interaction fees (units)
    static readonly SOCIAL_FEES = {
        FOLLOW: 10,      // 0.0000001 TRN
        UNFOLLOW: 20,    // 0.0000002 TRN
        LIKE: 10,        // 0.0000001 TRN
        COMMENT: 20,     // 0.0000002 TRN
        POST: 50         // 0.0000005 TRN
    };

    /**
     * Calculate dynamic transfer fee based on recipient's incoming transfer count
     * 
     * @param amount Transfer amount in units
     * @param recipientTransferCount Number of transfers recipient has received this year
     * @returns Total fee in units
     */
    static calculateTransferFee(amount: number, recipientTransferCount: number): number {
        // SECURITY: Validate inputs to prevent overflow and negative value attacks
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error('Invalid amount: must be non-negative finite number');
        }

        if (!Number.isFinite(recipientTransferCount) || recipientTransferCount < 0) {
            throw new Error('Invalid transfer count: must be non-negative finite number');
        }

        if (!Number.isSafeInteger(amount)) {
            throw new Error('Amount exceeds safe integer range');
        }

        if (amount > Number.MAX_SAFE_INTEGER - this.BASE_NODE_FEE) {
            throw new Error('Amount too large - overflow risk');
        }

        // Find applicable tier
        let percentage = 0;
        for (const tier of this.TRANSFER_FEE_TIERS) {
            if (recipientTransferCount < tier.maxTransfers) {
                percentage = tier.percentage;
                break;
            }
        }

        // Calculate percentage fee
        const percentageFee = Math.floor(amount * percentage);

        // Total = percentage fee + base node fee
        const totalFee = percentageFee + this.BASE_NODE_FEE;

        return Math.max(totalFee, this.BASE_NODE_FEE); // Minimum is base fee
    }

    /**
     * Get message fee based on priority
     */
    static getMessageFee(priority: 'fast' | 'normal' | 'slow'): number {
        const baseFee = this.MESSAGE_FEES[priority.toUpperCase() as keyof typeof this.MESSAGE_FEES];
        return baseFee + this.BASE_NODE_FEE;
    }

    /**
     * Get social interaction fee
     */
    static getSocialFee(type: 'FOLLOW' | 'UNFOLLOW' | 'LIKE' | 'COMMENT' | 'POST'): number {
        const baseFee = this.SOCIAL_FEES[type];
        return baseFee + this.BASE_NODE_FEE;
    }

    /**
     * Convert units to TRN for display
     */
    static toTRN(units: number): string {
        const trn = units / 100_000_000;
        return trn.toFixed(8) + ' TRN';
    }

    /**
     * Convert TRN to units
     */
    static toUnits(trn: number): number {
        return Math.floor(trn * 100_000_000);
    }
}
