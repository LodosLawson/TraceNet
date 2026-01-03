/**
 * TraceNet Token Unit Conversion
 * 
 * Similar to Ethereum's Wei system:
 * 1 TNN = 100,000,000 units (8 decimals)
 * 
 * This allows blockchain to use integers while frontend shows decimals
 */

export const TOKEN_DECIMALS = 8;
export const UNITS_PER_TOKEN = Math.pow(10, TOKEN_DECIMALS); // 100,000,000

/**
 * Convert TNN (decimal) to units (integer)
 * Example: 0.00625 TNN → 625000 units
 */
export function tnnToUnits(tnn: number): number {
    return Math.floor(tnn * UNITS_PER_TOKEN);
}

/**
 * Convert units (integer) to TNN (decimal)
 * Example: 625000 units → 0.00625 TNN
 */
export function unitsToTNN(units: number): number {
    return units / UNITS_PER_TOKEN;
}

/**
 * Format units for display
 * Example: 625000 → "0.00625 TNN"
 */
export function formatTNN(units: number, decimals: number = 8): string {
    const tnn = unitsToTNN(units);
    return `${tnn.toFixed(decimals)} TNN`;
}

/**
 * Parse TNN string to units
 * Example: "0.00625" → 625000
 */
export function parseTNN(tnnString: string): number {
    const tnn = parseFloat(tnnString);
    if (isNaN(tnn)) {
        throw new Error('Invalid TNN amount');
    }
    return tnnToUnits(tnn);
}

// Fee constants in UNITS (not TNN)
export const FEES = {
    // Social Actions (Minimum)
    MIN_LIKE_FEE: tnnToUnits(0.00001),      // 1,000 units
    MIN_COMMENT_FEE: tnnToUnits(0.00002),   // 2,000 units
    MIN_FOLLOW_FEE: tnnToUnits(0.00001),    // 1,000 units

    // Messaging (Time-based)
    MESSAGE_FAST: tnnToUnits(0.00001),      // 1,000 units
    MESSAGE_STANDARD: tnnToUnits(0.0000001), // 10 units
    MESSAGE_LOW: tnnToUnits(0.00000001),    // 1 unit


    // Rewards (ONLY wallet creation gives initial coins)
    WALLET_CREATION_REWARD: tnnToUnits(0.00625),  // 625,000 units (ONLY initial reward)

    // Note: Users earn additional coins from:
    // - Receiving likes on their posts (50% of like fee)
    // - Receiving comments on their posts (50% of comment fee)
    // - Receiving likes on their comments (50% of like fee)
};

// Examples
console.log('=== TraceNet Unit Conversion Examples ===');
console.log(`1 TNN = ${UNITS_PER_TOKEN.toLocaleString()} units`);
console.log(`0.00625 TNN = ${tnnToUnits(0.00625).toLocaleString()} units`);
console.log(`625000 units = ${unitsToTNN(625000)} TNN`);
console.log(`Wallet Creation Reward: ${formatTNN(FEES.WALLET_CREATION_REWARD)}`);
