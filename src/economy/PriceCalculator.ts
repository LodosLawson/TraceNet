import { EventEmitter } from 'events';
import { TOKEN_CONFIG } from './TokenConfig';

/**
 * Market Data Interface
 */
export interface MarketData {
    marketCap: number;        // USD
    totalSupply: number;      // LT tokens
    tokenPrice: number;       // USD per token
    priceChange24h: number;   // Percentage
    volume24h: number;        // USD
    lastUpdated: number;      // Timestamp
}

/**
 * Price History Entry
 */
interface PriceHistoryEntry {
    timestamp: number;
    price: number;
    marketCap: number;
}

/**
 * Token Price Calculator
 * Calculates dynamic token price based on market cap
 */
export class TokenPriceCalculator extends EventEmitter {
    private marketData: MarketData;
    private priceHistory: PriceHistoryEntry[];

    constructor() {
        super();
        this.marketData = {
            marketCap: TOKEN_CONFIG.INITIAL_MARKET_CAP_USD,
            totalSupply: TOKEN_CONFIG.TOTAL_SUPPLY,
            tokenPrice: TOKEN_CONFIG.INITIAL_PRICE_USD,
            priceChange24h: 0,
            volume24h: 0,
            lastUpdated: Date.now(),
        };
        this.priceHistory = [
            {
                timestamp: Date.now(),
                price: TOKEN_CONFIG.INITIAL_PRICE_USD,
                marketCap: TOKEN_CONFIG.INITIAL_MARKET_CAP_USD,
            },
        ];
    }

    /**
     * Calculate current token price
     */
    calculatePrice(): number {
        return this.marketData.marketCap / this.marketData.totalSupply;
    }

    /**
     * Update market cap (from oracle or manual)
     */
    updateMarketCap(newMarketCap: number): void {
        const oldPrice = this.marketData.tokenPrice;
        this.marketData.marketCap = newMarketCap;
        this.marketData.tokenPrice = this.calculatePrice();
        this.marketData.lastUpdated = Date.now();

        // Calculate 24h change
        const price24hAgo = this.getPriceFromHistory(Date.now() - 86400000);
        if (price24hAgo) {
            this.marketData.priceChange24h =
                ((this.marketData.tokenPrice - price24hAgo) / price24hAgo) * 100;
        }

        // Store in history
        this.priceHistory.push({
            timestamp: Date.now(),
            price: this.marketData.tokenPrice,
            marketCap: newMarketCap,
        });

        // Keep only 30 days of history
        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        this.priceHistory = this.priceHistory.filter(
            (entry) => entry.timestamp > thirtyDaysAgo
        );

        // Emit event
        this.emit('market_price.updated', {
            oldPrice,
            newPrice: this.marketData.tokenPrice,
            marketCap: newMarketCap,
            priceChange24h: this.marketData.priceChange24h,
            timestamp: Date.now(),
        });
    }

    /**
     * Calculate user's token value in USD
     */
    calculateUserValue(tokenBalance: number): {
        balance: number;
        priceUSD: number;
        valueUSD: number;
        priceChange24h: number;
    } {
        const balanceInTokens = tokenBalance / 100_000_000; // Convert from smallest unit
        const valueUSD = balanceInTokens * this.marketData.tokenPrice;

        return {
            balance: balanceInTokens,
            priceUSD: this.marketData.tokenPrice,
            valueUSD,
            priceChange24h: this.marketData.priceChange24h,
        };
    }

    /**
     * Get price from history
     */
    private getPriceFromHistory(timestamp: number): number | null {
        const entry = this.priceHistory.find(
            (e) => Math.abs(e.timestamp - timestamp) < 3600000 // Within 1 hour
        );
        return entry ? entry.price : null;
    }

    /**
     * Get current market data
     */
    getMarketData(): MarketData {
        return { ...this.marketData };
    }

    /**
     * Get price history for chart
     */
    getPriceHistory(period: '24h' | '7d' | '30d'): PriceHistoryEntry[] {
        const periodMs = {
            '24h': 86400000,
            '7d': 7 * 86400000,
            '30d': 30 * 86400000,
        };

        const cutoff = Date.now() - periodMs[period];
        return this.priceHistory.filter((entry) => entry.timestamp > cutoff);
    }

    /**
     * Update 24h volume
     */
    updateVolume24h(volume: number): void {
        this.marketData.volume24h = volume;
    }

    /**
     * Export to JSON
     */
    toJSON(): { marketData: MarketData; priceHistory: PriceHistoryEntry[] } {
        return {
            marketData: { ...this.marketData },
            priceHistory: [...this.priceHistory],
        };
    }

    /**
     * Import from JSON
     */
    loadFromJSON(data: { marketData: MarketData; priceHistory: PriceHistoryEntry[] }): void {
        this.marketData = { ...data.marketData };
        this.priceHistory = [...data.priceHistory];
    }
}
