"use strict";
/**
 * TraceNet Network Configuration
 * Developed by LockTrace
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENESIS_VALIDATOR_PUBLIC_KEY = exports.NETWORK_CONFIG = void 0;
exports.getGenesisMetadata = getGenesisMetadata;
exports.isValidChainId = isValidChainId;
/**
 * TraceNet V3.0 Network Configuration
 */
exports.NETWORK_CONFIG = {
    chainId: 'tracenet-mainnet-v3',
    networkName: 'TraceNet',
    developer: 'LodosLawson - M.S', // Creator initials
    version: '3.0.1',
    genesisTimestamp: 1735689600000, // 2025-01-01T00:00:00.000Z (V3.0 launch)
    maxSupply: 100000000, // 100 million TRN
    tokenSymbol: 'TRN', // TraceNet (changed from TNN)
    tokenDecimals: 8,
    MAX_KNOWN_PEERS: 500,
    MIN_PEERS: 3,
    BOOTSTRAP_NODES: [
        ...(process.env.BOOTSTRAP_NODES ? process.env.BOOTSTRAP_NODES.split(',') : []),
        'https://tracenet-blockchain-136028201808.us-central1.run.app', // Active US Mainnet
        'https://tracenet-blockchain-nodeeu-136028201808.europe-west1.run.app', // Europe Mainnet
        'https://rotundly-symphysial-sharonda.ngrok-free.dev', // Local Developer Node
        'https://tracenet-node-1.run.app',
        'https://tracenet-node-2.run.app',
        'https://tracenet-mainnet-seed.herokuapp.com'
    ],
    initialValidators: [
        '25b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7', // Genesis Validator (System)
        'cd00b064e18f0326eff90e1802c92d8c4bc759148ab3a77af9097d6c79e02073', // User Home Node Validator
        '16f82568' // US Mainnet Validator (Added for Sync compatibility)
    ]
};
exports.GENESIS_VALIDATOR_PUBLIC_KEY = '25b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7';
/**
 * Get network metadata for genesis block
 */
function getGenesisMetadata() {
    return {
        ...exports.NETWORK_CONFIG
    };
}
/**
 * Validate chain ID
 */
function isValidChainId(chainId) {
    return chainId === exports.NETWORK_CONFIG.chainId;
}
