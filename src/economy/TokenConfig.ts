/**
 * Token configuration for TraceNet blockchain
 */
export const TOKEN_CONFIG = {
    SYMBOL: 'LT',
    NAME: 'TraceNet Token',
    DECIMALS: 8,
    TOTAL_SUPPLY: 10000000000000000, // 100,000,000 LT (in smallest unit)
    INITIAL_MARKET_CAP_USD: 1000,
    INITIAL_PRICE_USD: 0.00001, // $1000 / 100M

    // Fees (50% goes to recipient/creator, 50% to blockchain treasury)
    MESSAGE_FEE: 50, // 0.0000005 LT (total, split 50/50)
    LIKE_FEE: 1000, // 0.00001 LT (total, split 50/50)
    COMMENT_FEE: 1000, // 0.00001 LT (total, split 50/50)
    SHARE_FEE: 1000, // 0.00001 LT
    TRANSFER_FEE: 1000000, // 0.01 LT (default)

    // Airdrop
    INITIAL_AIRDROP: 625000, // 0.00625 LT

    // Fee split percentages
    FEE_TO_CREATOR_PERCENT: 50, // 50% to content creator/recipient
    FEE_TO_TREASURY_PERCENT: 50, // 50% to blockchain treasury
};

/**
 * Treasury wallet addresses
 */
export const TREASURY_ADDRESSES = {
    main: 'TREASURY_MAIN',
    reserve: 'TREASURY_RESERVE',
    development: 'TREASURY_DEV',
};

/**
 * Convert LT to smallest unit
 */
export function toSmallestUnit(amount: number): number {
    return Math.floor(amount * Math.pow(10, TOKEN_CONFIG.DECIMALS));
}

/**
 * Convert smallest unit to LT
 */
export function fromSmallestUnit(amount: number): number {
    return amount / Math.pow(10, TOKEN_CONFIG.DECIMALS);
}

/**
 * Format amount for display
 */
export function formatAmount(amount: number): string {
    return `${fromSmallestUnit(amount).toFixed(8)} ${TOKEN_CONFIG.SYMBOL}`;
}

// ===== Backward Compatibility Exports =====

/**
 * Transfer fee configuration (backward compatibility)
 */
export const TRANSFER_FEE_CONFIG = {
    feeRate: 0.01, // 1%
    minFee: 1000, // 0.00001 LT
};

/**
 * Social fees configuration (backward compatibility)
 */
export const SOCIAL_FEES = {
    like: {
        cost: TOKEN_CONFIG.LIKE_FEE,
        contentOwnerShare: TOKEN_CONFIG.FEE_TO_CREATOR_PERCENT / 100,
    },
    comment: {
        cost: TOKEN_CONFIG.COMMENT_FEE,
        contentOwnerShare: TOKEN_CONFIG.FEE_TO_CREATOR_PERCENT / 100,
    },
    message: {
        cost: TOKEN_CONFIG.MESSAGE_FEE,
    },
};

/**
 * Token distribution (backward compatibility)
 */
export const TOKEN_DISTRIBUTION = {
    initialSupply: TOKEN_CONFIG.TOTAL_SUPPLY,
    airdropAmount: TOKEN_CONFIG.INITIAL_AIRDROP,
    airdropPool: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.35), // 35% for airdrops
        distributed: 0,
        percentage: 35,
    },
    treasury: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.25), // 25% for treasury
        percentage: 25,
    },
    validatorRewards: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.20), // 20% for validators
        percentage: 20,
    },
    communityRewards: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.10), // 10% for community
        percentage: 10,
    },
    liquidityPool: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.05), // 5% for liquidity
        percentage: 5,
    },
    team: {
        allocated: Math.floor(TOKEN_CONFIG.TOTAL_SUPPLY * 0.05), // 5% for team
        percentage: 5,
        vestingPeriodMonths: 24,
    },
};

// Alias exports for backward compatibility
export const initialMarketCap = TOKEN_CONFIG.INITIAL_MARKET_CAP_USD;
export const totalSupply = TOKEN_CONFIG.TOTAL_SUPPLY;
export const initialPrice = TOKEN_CONFIG.INITIAL_PRICE_USD;

