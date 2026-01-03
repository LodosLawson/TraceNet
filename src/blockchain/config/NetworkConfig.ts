/**
 * TraceNet Network Configuration
 * Developed by LockTrace
 */

export interface NetworkMetadata {
    chainId: string;
    networkName: string;
    developer: string;
    version: string;
    genesisTimestamp: number;
    maxSupply: number;
    tokenSymbol: string;
    tokenDecimals: number;
}

/**
 * TraceNet V3.0 Network Configuration
 */
export const NETWORK_CONFIG: NetworkMetadata = {
    chainId: 'tracenet-mainnet-v3',
    networkName: 'TraceNet',
    developer: 'LodosLawson - M.S',  // Creator initials
    version: '3.0.0',
    genesisTimestamp: 1735689600000, // 2025-01-01T00:00:00.000Z (V3.0 launch)
    maxSupply: 100_000_000, // 100 million TRN
    tokenSymbol: 'TRN', // TraceNet (changed from TNN)
    tokenDecimals: 8,
};

/**
 * Get network metadata for genesis block
 */
export function getGenesisMetadata(): NetworkMetadata {
    return {
        ...NETWORK_CONFIG
    };
}

/**
 * Validate chain ID
 */
export function isValidChainId(chainId: string): boolean {
    return chainId === NETWORK_CONFIG.chainId;
}
