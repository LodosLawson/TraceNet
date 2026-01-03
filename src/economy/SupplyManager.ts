/**
 * Supply Manager for tracking total token supply and enforcing cap
 */
export class SupplyManager {
    private totalMinted: number;
    private readonly maxSupply: number;

    constructor(maxSupply: number) {
        this.maxSupply = maxSupply;
        this.totalMinted = 0;
    }

    /**
     * Get total minted amount
     */
    getTotalMinted(): number {
        return this.totalMinted;
    }

    /**
     * Get maximum supply
     */
    getMaxSupply(): number {
        return this.maxSupply;
    }

    /**
     * Get remaining supply to mint
     */
    getRemainingSupply(): number {
        return Math.max(0, this.maxSupply - this.totalMinted);
    }

    /**
     * Check if minting is allowed
     */
    canMint(amount: number): boolean {
        return this.totalMinted + amount <= this.maxSupply;
    }

    /**
     * Record minted amount
     */
    recordMint(amount: number): boolean {
        if (!this.canMint(amount)) {
            console.warn(`Cannot mint ${amount}: Would exceed max supply`);
            return false;
        }

        this.totalMinted += amount;
        return true;
    }

    /**
     * Get supply statistics
     */
    getStats(): {
        totalMinted: number;
        maxSupply: number;
        remainingSupply: number;
        percentageMinted: number;
    } {
        const remainingSupply = this.getRemainingSupply();
        const percentageMinted = (this.totalMinted / this.maxSupply) * 100;

        return {
            totalMinted: this.totalMinted,
            maxSupply: this.maxSupply,
            remainingSupply,
            percentageMinted,
        };
    }

    /**
     * Calculate adjusted reward based on remaining supply
     */
    getAdjustedReward(baseReward: number): number {
        const remaining = this.getRemainingSupply();

        // If no supply left, return 0
        if (remaining <= 0) {
            return 0;
        }

        // If requesting more than available, return only what's available
        if (baseReward > remaining) {
            return remaining;
        }

        return baseReward;
    }

    /**
     * Export to JSON
     */
    toJSON(): { totalMinted: number; maxSupply: number } {
        return {
            totalMinted: this.totalMinted,
            maxSupply: this.maxSupply,
        };
    }

    /**
     * Load from JSON
     */
    loadFromJSON(data: { totalMinted: number; maxSupply: number }): void {
        if (data.maxSupply !== this.maxSupply) {
            throw new Error('Cannot change max supply');
        }
        this.totalMinted = data.totalMinted;
    }
}
