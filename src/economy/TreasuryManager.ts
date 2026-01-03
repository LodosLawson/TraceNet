import { EventEmitter } from 'events';

/**
 * Treasury Account Interface
 */
export interface TreasuryAccount {
    address: string;
    balance: number;
    totalIncome: number;
    totalOutflow: number;
    incomeSources: {
        transferFees: number;
        socialFees: number;
        validatorSlashing: number;
        other: number;
    };
    outflowCategories: {
        burns: number;
        grants: number;
        airdrops: number;
        validatorBonus: number;
        other: number;
    };
}

/**
 * Treasury Manager
 * Manages the blockchain treasury account
 */
export class TreasuryManager extends EventEmitter {
    private account: TreasuryAccount;

    constructor(treasuryAddress: string, initialBalance: number = 30_000_000 * 100_000_000) {
        super();
        this.account = {
            address: treasuryAddress,
            balance: initialBalance,
            totalIncome: 0,
            totalOutflow: 0,
            incomeSources: {
                transferFees: 0,
                socialFees: 0,
                validatorSlashing: 0,
                other: 0,
            },
            outflowCategories: {
                burns: 0,
                grants: 0,
                airdrops: 0,
                validatorBonus: 0,
                other: 0,
            },
        };
    }

    /**
     * Add income to treasury
     */
    addIncome(amount: number, source: keyof TreasuryAccount['incomeSources']): void {
        this.account.balance += amount;
        this.account.totalIncome += amount;
        this.account.incomeSources[source] += amount;

        this.emit('treasury.income', {
            amount,
            source,
            newBalance: this.account.balance,
            timestamp: Date.now(),
        });
    }

    /**
     * Add outflow from treasury
     */
    addOutflow(amount: number, category: keyof TreasuryAccount['outflowCategories']): void {
        if (this.account.balance < amount) {
            throw new Error(`Insufficient treasury balance. Required: ${amount}, Available: ${this.account.balance}`);
        }

        this.account.balance -= amount;
        this.account.totalOutflow += amount;
        this.account.outflowCategories[category] += amount;

        this.emit('treasury.outflow', {
            amount,
            category,
            newBalance: this.account.balance,
            timestamp: Date.now(),
        });
    }

    /**
     * Burn tokens (deflationary mechanism)
     */
    burn(amount: number): void {
        this.addOutflow(amount, 'burns');

        this.emit('token.burned', {
            amount,
            totalBurned: this.account.outflowCategories.burns,
            timestamp: Date.now(),
        });
    }

    /**
     * Get current balance
     */
    getBalance(): number {
        return this.account.balance;
    }

    /**
     * Get treasury statistics
     */
    getStats(): TreasuryAccount {
        return { ...this.account };
    }

    /**
     * Get income by source
     */
    getIncomeBySource(source: keyof TreasuryAccount['incomeSources']): number {
        return this.account.incomeSources[source];
    }

    /**
     * Get outflow by category
     */
    getOutflowByCategory(category: keyof TreasuryAccount['outflowCategories']): number {
        return this.account.outflowCategories[category];
    }

    /**
     * Export to JSON
     */
    toJSON(): TreasuryAccount {
        return { ...this.account };
    }

    /**
     * Import from JSON
     */
    loadFromJSON(data: TreasuryAccount): void {
        this.account = { ...data };
    }
}
