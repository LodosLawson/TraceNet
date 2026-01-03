/**
 * Token configuration for TraceNet blockchain
 */
export const TOKEN_CONFIG = {
    SYMBOL: 'TRN',
    NAME: 'TraceNet Token',
    DECIMALS: 8,
    TOTAL_SUPPLY: 10000000000000000, // 100,000,000 LT (in smallest unit)
    INITIAL_MARKET_CAP_USD: 1000,
    INITIAL_PRICE_USD: 0.00001, // $1000 / 100M

    // Fees - Node wallet gets 50% if registered, remaining split varies by transaction type
    // Transfer: 50% node, 50% treasury
    // Social (like/comment/follow): 50% node, 25% content owner, 25% treasury
    MESSAGE_FEE: 200, // 0.000002 LT (doubled)
    LIKE_FEE: 2000, // 0.00002 LT (doubled)
    COMMENT_FEE: 2000, // 0.00002 LT (doubled)
    SHARE_FEE: 2000, // 0.00002 LT (doubled)
    FOLLOW_FEE: 100, // 0.000001 LT (half of message fee)
    UNFOLLOW_FEE: 100, // 0.000001 LT (half of message fee)
    PRIVACY_UPDATE_FEE: 500, // 0.000005 LT
    KEY_ROTATION_FEE: 1000, // 0.00001 LT

    // Dynamic Transfer Fees
    DYNAMIC_TRANSFER_FEES: {
        // Base fee based on recipient's incoming transfer count (past year)
        BASE: {
            TIER_0: { threshold: 0, rate: 0.0001 },    // 0-49 transfers: 0.01%
            TIER_1: { threshold: 50, rate: 0.00025 },  // 50-99 transfers: 0.025%
            TIER_2: { threshold: 100, rate: 0.0005 },  // 100-199 transfers: 0.05%
            TIER_3: { threshold: 200, rate: 0.001 }    // 200+ transfers: 0.10%
        },
        // Priority fee for faster processing (additive)
        PRIORITY: {
            STANDARD: 0,        // No priority
            LOW: 0.002,         // +0.20%
            MEDIUM: 0.006,      // +0.60%
            HIGH: 0.01          // +1%
        }
    },

    // Airdrop
    INITIAL_AIRDROP: 625000, // 0.00625 LT

    // Fee split percentages
    // Fee split percentages
    FEE_TO_PRIMARY_PERCENT: 45, // 45% (Node or Creator)
    FEE_TO_POOL_PERCENT: 30,    // 30% (Mining Pool)
    FEE_TO_RECYCLE_PERCENT: 20, // 20% (Recycle/Burn)
    FEE_TO_DEV_PERCENT: 5,      // 5% (Network Owner)

    // Deprecated but kept for compatibility until full refactor
    FEE_TO_NODE_OWNER_PERCENT: 45,
    FEE_TO_CREATOR_PERCENT: 45,
    FEE_TO_TREASURY_PERCENT: 25, // No longer accurate in new model
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
    follow: {
        cost: TOKEN_CONFIG.FOLLOW_FEE,
    },
    unfollow: {
        cost: TOKEN_CONFIG.UNFOLLOW_FEE,
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

