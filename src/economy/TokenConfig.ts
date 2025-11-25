/**
 * Token Configuration Constants
 */
export const TOKEN_CONFIG = {
    name: 'LT Token',
    symbol: 'LT',
    decimals: 8,
    totalSupply: 100_000_000,      // 100 million tokens
    initialMarketCap: 1000,        // $1,000 USD
    initialPrice: 0.00001,         // $0.00001 per token
};

/**
 * Airdrop Configuration
 */
export const AIRDROP_CONFIG = {
    amount: 5 * 100_000_000,       // 5 LT with 8 decimals
    maxRecipients: 2_000_000,      // 2 million users
    poolAddress: 'LT_AIRDROP_POOL',
    isFirstWalletOnly: true,
};

/**
 * Transfer Fee Configuration
 */
export const TRANSFER_FEE_CONFIG = {
    feeRate: 0.0002,               // 0.02%
    treasuryShare: 1.0,            // 100% to treasury
};

/**
 * Social Interaction Fees
 */
export const SOCIAL_FEES = {
    like: {
        cost: 0.10 * 100_000_000,    // 10,000,000 smallest units
        contentOwnerShare: 0.70,     // 70%
        treasuryShare: 0.30,         // 30%
    },
    comment: {
        cost: 0.10 * 100_000_000,    // 10,000,000 smallest units
        contentOwnerShare: 0.70,
        treasuryShare: 0.30,
    },
    message: {
        cost: 0.001 * 100_000_000,   // 100,000 smallest units
        treasuryShare: 1.0,          // 100%
    },
};

/**
 * Token Distribution Allocation
 */
export const TOKEN_DISTRIBUTION = {
    airdropPool: {
        allocated: 10_000_000 * 100_000_000,
        percentage: 10,
    },
    treasury: {
        allocated: 30_000_000 * 100_000_000,
        percentage: 30,
    },
    validatorRewards: {
        allocated: 20_000_000 * 100_000_000,
        percentage: 20,
    },
    communityRewards: {
        allocated: 15_000_000 * 100_000_000,
        percentage: 15,
    },
    liquidityPool: {
        allocated: 15_000_000 * 100_000_000,
        percentage: 15,
    },
    team: {
        allocated: 10_000_000 * 100_000_000,
        percentage: 10,
        vestingPeriodMonths: 48,
    },
};

/**
 * Treasury Wallet Addresses
 */
export const TREASURY_ADDRESSES = {
    main: 'LT_TREASURY_RESERVE',
    airdrop: 'LT_AIRDROP_POOL',
    validators: 'LT_VALIDATOR_POOL',
    community: 'LT_COMMUNITY_POOL',
    liquidity: 'LT_LIQUIDITY_POOL',
    team: 'LT_TEAM_VESTING',
};
