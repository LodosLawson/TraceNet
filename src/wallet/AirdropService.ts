import { TransactionModel, TransactionType } from '../blockchain/models/Transaction';

/**
 * Airdrop record
 */
export interface AirdropRecord {
    user_id: string;
    wallet_id: string;
    tx_id: string;
    amount: number;
    timestamp: number;
    status: 'pending' | 'confirmed' | 'failed';
}

/**
 * Airdrop service for automatic token distribution
 */
export class AirdropService {
    private airdrops: Map<string, AirdropRecord>; // user_id -> airdrop record
    private airdropAmount: number;
    private systemWalletId: string;

    constructor(airdropAmount: number = 625000, systemWalletId: string = 'SYSTEM') {
        this.airdrops = new Map();
        this.airdropAmount = airdropAmount;
        this.systemWalletId = systemWalletId;
    }

    /**
     * Create airdrop transaction for first wallet
     */
    createAirdropTransaction(
        userId: string,
        walletId: string
    ): TransactionModel | null {
        // Check if user already received airdrop
        if (this.airdrops.has(userId)) {
            console.log(`User ${userId} already received airdrop`);
            return null;
        }

        // Create REWARD transaction
        const airdropTx = TransactionModel.create(
            this.systemWalletId,
            walletId,
            TransactionType.REWARD,
            this.airdropAmount,
            0, // No fee for airdrops
            {
                type: 'initial_airdrop',
                user_id: userId,
                description: 'Welcome bonus for first wallet',
            }
        );

        // Record airdrop
        const record: AirdropRecord = {
            user_id: userId,
            wallet_id: walletId,
            tx_id: airdropTx.tx_id,
            amount: this.airdropAmount,
            timestamp: Date.now(),
            status: 'pending',
        };

        this.airdrops.set(userId, record);

        return airdropTx;
    }

    /**
     * Mark airdrop as confirmed
     */
    confirmAirdrop(userId: string): void {
        const record = this.airdrops.get(userId);
        if (record) {
            record.status = 'confirmed';
            this.airdrops.set(userId, record);
        }
    }

    /**
     * Mark airdrop as failed
     */
    failAirdrop(userId: string): void {
        const record = this.airdrops.get(userId);
        if (record) {
            record.status = 'failed';
            this.airdrops.set(userId, record);
        }
    }

    /**
     * Check if user received airdrop
     */
    hasReceivedAirdrop(userId: string): boolean {
        return this.airdrops.has(userId);
    }

    /**
     * Get airdrop record for user
     */
    getAirdropRecord(userId: string): AirdropRecord | undefined {
        return this.airdrops.get(userId);
    }

    /**
     * Get all airdrop records
     */
    getAllAirdrops(): AirdropRecord[] {
        return Array.from(this.airdrops.values());
    }

    /**
     * Get airdrop statistics
     */
    getStats(): {
        totalAirdrops: number;
        confirmedAirdrops: number;
        pendingAirdrops: number;
        failedAirdrops: number;
        totalDistributed: number;
    } {
        const records = Array.from(this.airdrops.values());

        return {
            totalAirdrops: records.length,
            confirmedAirdrops: records.filter((r) => r.status === 'confirmed').length,
            pendingAirdrops: records.filter((r) => r.status === 'pending').length,
            failedAirdrops: records.filter((r) => r.status === 'failed').length,
            totalDistributed:
                records
                    .filter((r) => r.status === 'confirmed')
                    .reduce((sum, r) => sum + r.amount, 0),
        };
    }

    /**
     * Export airdrops to JSON
     */
    toJSON(): AirdropRecord[] {
        return Array.from(this.airdrops.values());
    }

    /**
     * Import airdrops from JSON
     */
    loadFromJSON(data: AirdropRecord[]): void {
        this.airdrops.clear();
        for (const record of data) {
            this.airdrops.set(record.user_id, record);
        }
    }
}
