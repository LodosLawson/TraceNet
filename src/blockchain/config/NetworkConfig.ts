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
 * TraceNet Network Configuration
 */
export const NETWORK_CONFIG: NetworkMetadata = {
    chainId: 'tracenet-mainnet-1',
    networkName: 'TraceNet',
    developer: 'LockTrace',
    version: '1.0.0',
    genesisTimestamp: Date.now(),
    maxSupply: 100_000_000, // 100 million TNN
    tokenSymbol: 'TNN', // TraceNet Network
    tokenDecimals: 8,
};

/**
 * Get network metadata for genesis block
 */
export function getGenesisMetadata(): NetworkMetadata {
    return {
        ...NETWORK_CONFIG,
        genesisTimestamp: Date.now(),
    };
}

/**
 * Validate chain ID
 */
export function isValidChainId(chainId: string): boolean {
    return chainId === NETWORK_CONFIG.chainId;
}
