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
    tokenSymbol: 'TRN';
    tokenDecimals: number;
    MAX_KNOWN_PEERS: number;
    MIN_PEERS: number;
    BOOTSTRAP_NODES: string[];
    GENESIS_VALIDATOR_PUBLIC_KEY?: string; // Optional if not always present
    initialValidators: string[];
}

/**
 * TraceNet V3.0 Network Configuration
 */
export const NETWORK_CONFIG: NetworkMetadata = {
    chainId: 'tracenet-mainnet-v3',
    networkName: 'TraceNet',
    developer: 'LodosLawson - M.S',  // Creator initials
    version: '3.0.1',
    genesisTimestamp: 1735689600000, // 2025-01-01T00:00:00.000Z (V3.0 launch)
    maxSupply: 100_000_000, // 100 million TRN
    tokenSymbol: 'TRN', // TraceNet (changed from TNN)
    tokenDecimals: 8,
    MAX_KNOWN_PEERS: 500,
    MIN_PEERS: 3,
    BOOTSTRAP_NODES: [
        'https://tracenet-blockchain-136028201808.us-central1.run.app', // Active US Mainnet
        'https://tracenet-node-1.run.app',
        'https://tracenet-node-2.run.app',
        'https://tracenet-mainnet-seed.herokuapp.com'
    ],
    initialValidators: [
        '25b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7', // Genesis Validator (System)
        'cd00b064e18f0326eff90e1802c92d8c4bc759148ab3a77af9097d6c79e02073'  // User Home Node Validator
    ]
};

export const GENESIS_VALIDATOR_PUBLIC_KEY = '25b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7';

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
