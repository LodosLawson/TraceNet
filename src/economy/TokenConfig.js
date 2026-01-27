"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialPrice = exports.totalSupply = exports.initialMarketCap = exports.TOKEN_DISTRIBUTION = exports.SOCIAL_FEES = exports.TRANSFER_FEE_CONFIG = exports.TREASURY_ADDRESSES = exports.TOKEN_CONFIG = void 0;
exports.toSmallestUnit = toSmallestUnit;
exports.fromSmallestUnit = fromSmallestUnit;
exports.formatAmount = formatAmount;
/**
 * Token configuration for TraceNet blockchain
 */
exports.TOKEN_CONFIG = {
    SYMBOL: 'TRN',
    NAME: 'TraceNet Token',
    DECIMALS: 8,
    TOTAL_SUPPLY: 10000000000000000, // 100,000,000 LT (in smallest unit)
    INITIAL_MARKET_CAP_USD: 1000,
    INITIAL_PRICE_USD: 0.00001, // $1000 / 100M
    // Fee Tiers (in LT)
    // FAST: Instant Mining (Individual)
    // NORMAL: 10 Minute Batch
    // LOW: 1 Hour Batch
    FEE_TIERS: {
        FAST: 0.00001, // 1000 units
        NORMAL: 0.0000001, // 10 units
        LOW: 0.00000001 // 1 unit
    },
    // Fees - Node wallet gets 50% if registered, remaining split varies by transaction type
    // Transfer: 50% node, 50% treasury
    // Social (like/comment/follow): 50% node, 25% content owner, 25% treasury
    MESSAGE_FEE: 200, // 0.000002 LT (Normal Tier)
    LIKE_FEE: 500, // 0.000005 LT (Normal Tier - was 2000/Fast)
    COMMENT_FEE: 500, // 0.000005 LT (Normal Tier - was 2000/Fast)
    SHARE_FEE: 500, // 0.000005 LT (Normal Tier - was 2000/Fast)
    FOLLOW_FEE: 100, // 0.000001 LT (half of message fee)
    UNFOLLOW_FEE: 100, // 0.000001 LT (half of message fee)
    PRIVACY_UPDATE_FEE: 500, // 0.000005 LT
    KEY_ROTATION_FEE: 1000, // 0.00001 LT
    // Dynamic Transfer Fees
    DYNAMIC_TRANSFER_FEES: {
        // Base fee based on recipient's incoming transfer count (past year)
        BASE: {
            TIER_0: { threshold: 0, rate: 0.0001 }, // 0-49 transfers: 0.01%
            TIER_1: { threshold: 50, rate: 0.00025 }, // 50-99 transfers: 0.025%
            TIER_2: { threshold: 100, rate: 0.0005 }, // 100-199 transfers: 0.05%
            TIER_3: { threshold: 200, rate: 0.001 } // 200+ transfers: 0.10%
        },
        // Priority fee for faster processing (additive)
        PRIORITY: {
            STANDARD: 0, // No priority
            LOW: 0.002, // +0.20%
            MEDIUM: 0.006, // +0.60%
            HIGH: 0.01 // +1%
        }
    },
    // Airdrop
    INITIAL_AIRDROP: 625000, // 0.00625 LT
    // Fee split percentages
    // Fee split percentages
    FEE_TO_PRIMARY_PERCENT: 40, // 40% (Content Creator - Reduced from 50%)
    FEE_TO_POOL_PERCENT: 37, // 37% (Validator Pool - Reduced from 40%)
    FEE_TO_DEV_PERCENT: 8, // 8% (Treasury - Reduced from 10%)
    FEE_TO_RECYCLE_PERCENT: 15, // 15% (Returns to Total Supply/Recycle System)
    // Deprecated but kept for compatibility until full refactor
    FEE_TO_NODE_OWNER_PERCENT: 45,
    FEE_TO_CREATOR_PERCENT: 45,
    FEE_TO_TREASURY_PERCENT: 25, // No longer accurate in new model
};
/**
 * Treasury wallet addresses
 */
exports.TREASURY_ADDRESSES = {
    main: 'TREASURY_MAIN',
    reserve: 'TREASURY_RESERVE',
    development: 'TREASURY_DEV',
    validator_pool: 'VALIDATOR_POOL', // Accumulates 40% of fees for Epoch distribution
    recycle: 'TREASURY_RECYCLE', // Accumulates recycled fees (15%) to be returned to supply
};
/**
 * Convert LT to smallest unit
 */
function toSmallestUnit(amount) {
    return Math.floor(amount * Math.pow(10, exports.TOKEN_CONFIG.DECIMALS));
}
/**
 * Convert smallest unit to LT
 */
function fromSmallestUnit(amount) {
    return amount / Math.pow(10, exports.TOKEN_CONFIG.DECIMALS);
}
/**
 * Format amount for display
 */
function formatAmount(amount) {
    return `${fromSmallestUnit(amount).toFixed(8)} ${exports.TOKEN_CONFIG.SYMBOL}`;
}
// ===== Backward Compatibility Exports =====
/**
 * Transfer fee configuration (backward compatibility)
 */
exports.TRANSFER_FEE_CONFIG = {
    feeRate: 0.01, // 1%
    minFee: 1000, // 0.00001 LT
};
/**
 * Social fees configuration (backward compatibility)
 */
exports.SOCIAL_FEES = {
    like: {
        cost: exports.TOKEN_CONFIG.LIKE_FEE,
        contentOwnerShare: exports.TOKEN_CONFIG.FEE_TO_CREATOR_PERCENT / 100,
    },
    comment: {
        cost: exports.TOKEN_CONFIG.COMMENT_FEE,
        contentOwnerShare: exports.TOKEN_CONFIG.FEE_TO_CREATOR_PERCENT / 100,
    },
    message: {
        cost: exports.TOKEN_CONFIG.MESSAGE_FEE,
    },
    follow: {
        cost: exports.TOKEN_CONFIG.FOLLOW_FEE,
    },
    unfollow: {
        cost: exports.TOKEN_CONFIG.UNFOLLOW_FEE,
    },
};
/**
 * Token distribution (backward compatibility)
 */
exports.TOKEN_DISTRIBUTION = {
    initialSupply: exports.TOKEN_CONFIG.TOTAL_SUPPLY,
    airdropAmount: exports.TOKEN_CONFIG.INITIAL_AIRDROP,
    airdropPool: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.35), // 35% for airdrops
        distributed: 0,
        percentage: 35,
    },
    treasury: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.25), // 25% for treasury
        percentage: 25,
    },
    validatorRewards: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.20), // 20% for validators
        percentage: 20,
    },
    communityRewards: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.10), // 10% for community
        percentage: 10,
    },
    liquidityPool: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.05), // 5% for liquidity
        percentage: 5,
    },
    team: {
        allocated: Math.floor(exports.TOKEN_CONFIG.TOTAL_SUPPLY * 0.05), // 5% for team
        percentage: 5,
        vestingPeriodMonths: 24,
    },
};
// Alias exports for backward compatibility
exports.initialMarketCap = exports.TOKEN_CONFIG.INITIAL_MARKET_CAP_USD;
exports.totalSupply = exports.TOKEN_CONFIG.TOTAL_SUPPLY;
exports.initialPrice = exports.TOKEN_CONFIG.INITIAL_PRICE_USD;
