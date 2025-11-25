import { Router, Request, Response } from 'express';
import { TokenPriceCalculator } from './PriceCalculator';
import { TreasuryManager } from './TreasuryManager';
import { FeeHandler } from './FeeHandler';
import { TOKEN_CONFIG, TOKEN_DISTRIBUTION } from './TokenConfig';

/**
 * Economy API Router
 * Provides endpoints for token economics data
 */
export class EconomyAPI {
    private router: Router;
    private priceCalculator: TokenPriceCalculator;
    private treasuryManager: TreasuryManager;
    private feeHandler: FeeHandler;

    constructor(
        priceCalculator: TokenPriceCalculator,
        treasuryManager: TreasuryManager,
        feeHandler: FeeHandler
    ) {
        this.router = Router();
        this.priceCalculator = priceCalculator;
        this.treasuryManager = treasuryManager;
        this.feeHandler = feeHandler;

        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Get current token price
        this.router.get('/tokenPrice', this.getTokenPrice.bind(this));

        // Get user token value
        this.router.get('/userValue/:userId', this.getUserValue.bind(this));

        // Get treasury stats
        this.router.get('/treasury', this.getTreasuryStats.bind(this));

        // Get token distribution
        this.router.get('/distribution', this.getDistribution.bind(this));

        // Get price history
        this.router.get('/priceHistory', this.getPriceHistory.bind(this));

        // Get fee breakdown
        this.router.get('/fees/:action', this.getFeeBreakdown.bind(this));
    }

    /**
     * GET /economy/tokenPrice
     */
    private async getTokenPrice(req: Request, res: Response): Promise<void> {
        try {
            const marketData = this.priceCalculator.getMarketData();

            res.json({
                success: true,
                data: {
                    tokenPrice: marketData.tokenPrice,
                    marketCap: marketData.marketCap,
                    totalSupply: marketData.totalSupply,
                    priceChange24h: marketData.priceChange24h,
                    volume24h: marketData.volume24h,
                    lastUpdated: marketData.lastUpdated,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * GET /economy/userValue/:userId
     */
    private async getUserValue(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            // TODO: Get user wallets from WalletService
            // For now, return mock data
            const mockBalance = 50 * 100_000_000; // 50 LT

            const value = this.priceCalculator.calculateUserValue(mockBalance);

            res.json({
                success: true,
                data: {
                    userId,
                    wallets: [
                        {
                            walletId: `LT_${userId}_001`,
                            balance: value.balance,
                            valueUSD: value.valueUSD,
                            priceUSD: value.priceUSD,
                            priceChange24h: value.priceChange24h,
                        },
                    ],
                    totalBalance: value.balance,
                    totalValueUSD: value.valueUSD,
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * GET /economy/treasury
     */
    private async getTreasuryStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = this.treasuryManager.getStats();
            const marketData = this.priceCalculator.getMarketData();
            const balanceUSD = (stats.balance / 100_000_000) * marketData.tokenPrice;

            res.json({
                success: true,
                data: {
                    address: stats.address,
                    balance: stats.balance / 100_000_000,
                    balanceUSD,
                    totalIncome: stats.totalIncome / 100_000_000,
                    totalOutflow: stats.totalOutflow / 100_000_000,
                    incomeSources: {
                        transferFees: stats.incomeSources.transferFees / 100_000_000,
                        socialFees: stats.incomeSources.socialFees / 100_000_000,
                        validatorSlashing: stats.incomeSources.validatorSlashing / 100_000_000,
                        other: stats.incomeSources.other / 100_000_000,
                    },
                    outflowCategories: {
                        burns: stats.outflowCategories.burns / 100_000_000,
                        grants: stats.outflowCategories.grants / 100_000_000,
                        airdrops: stats.outflowCategories.airdrops / 100_000_000,
                        validatorBonus: stats.outflowCategories.validatorBonus / 100_000_000,
                        other: stats.outflowCategories.other / 100_000_000,
                    },
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * GET /economy/distribution
     */
    private async getDistribution(req: Request, res: Response): Promise<void> {
        try {
            const treasuryStats = this.treasuryManager.getStats();

            res.json({
                success: true,
                data: {
                    totalSupply: TOKEN_CONFIG.TOTAL_SUPPLY,
                    circulating: 10_000_000, // TODO: Calculate from actual data
                    locked: 90_000_000,
                    distribution: {
                        airdropPool: {
                            allocated: TOKEN_DISTRIBUTION.airdropPool.allocated / 100_000_000,
                            distributed: 0, // TODO: Track actual distributions
                            remaining: TOKEN_DISTRIBUTION.airdropPool.allocated / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.airdropPool.percentage,
                        },
                        treasury: {
                            allocated: TOKEN_DISTRIBUTION.treasury.allocated / 100_000_000,
                            current: treasuryStats.balance / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.treasury.percentage,
                        },
                        validatorRewards: {
                            allocated: TOKEN_DISTRIBUTION.validatorRewards.allocated / 100_000_000,
                            distributed: 0,
                            remaining: TOKEN_DISTRIBUTION.validatorRewards.allocated / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.validatorRewards.percentage,
                        },
                        communityRewards: {
                            allocated: TOKEN_DISTRIBUTION.communityRewards.allocated / 100_000_000,
                            distributed: 0,
                            remaining: TOKEN_DISTRIBUTION.communityRewards.allocated / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.communityRewards.percentage,
                        },
                        liquidityPool: {
                            allocated: TOKEN_DISTRIBUTION.liquidityPool.allocated / 100_000_000,
                            locked: TOKEN_DISTRIBUTION.liquidityPool.allocated / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.liquidityPool.percentage,
                        },
                        team: {
                            allocated: TOKEN_DISTRIBUTION.team.allocated / 100_000_000,
                            vested: 0,
                            locked: TOKEN_DISTRIBUTION.team.allocated / 100_000_000,
                            percentage: TOKEN_DISTRIBUTION.team.percentage,
                            vestingPeriodMonths: TOKEN_DISTRIBUTION.team.vestingPeriodMonths,
                        },
                    },
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * GET /economy/priceHistory?period=24h
     */
    private async getPriceHistory(req: Request, res: Response): Promise<void> {
        try {
            const period = (req.query.period as '24h' | '7d' | '30d') || '24h';

            if (!['24h', '7d', '30d'].includes(period)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid period. Must be 24h, 7d, or 30d',
                });
                return;
            }

            const history = this.priceCalculator.getPriceHistory(period);

            res.json({
                success: true,
                data: {
                    period,
                    data: history.map((entry) => ({
                        timestamp: entry.timestamp,
                        price: entry.price,
                        marketCap: entry.marketCap,
                    })),
                },
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * GET /economy/fees/:action?amount=100
     */
    private async getFeeBreakdown(req: Request, res: Response): Promise<void> {
        try {
            const { action } = req.params;
            const amount = req.query.amount ? parseInt(req.query.amount as string) : undefined;

            if (!['transfer', 'like', 'comment', 'message'].includes(action)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be transfer, like, comment, or message',
                });
                return;
            }

            const breakdown = this.feeHandler.getFeeBreakdown(
                action as 'transfer' | 'like' | 'comment' | 'message',
                amount ? amount * 100_000_000 : undefined
            );

            res.json({
                success: true,
                data: breakdown,
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }

    /**
     * Get Express router
     */
    getRouter(): Router {
        return this.router;
    }
}
