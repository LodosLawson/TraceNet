/**
 * IMMUTABLE CONSENSUS RULES
 * 
 * These rules define the core consensus parameters of the TraceNet blockchain.
 * They CANNOT be changed without forking the network.
 * Any node that violates these rules will be rejected by the network.
 */
export const IMMUTABLE_CONSENSUS_RULES = {
    /**
     * Block production time (milliseconds)
     * Cannot be changed - hardcoded to 5 seconds
     */
    BLOCK_TIME_MS: 5000,

    /**
     * Maximum block size (bytes)
     * Cannot exceed 1MB to prevent spam
     */
    MAX_BLOCK_SIZE: 1000000,

    /**
     * Maximum transactions per block
     */
    MAX_TRANSACTIONS_PER_BLOCK: 1000,

    /**
     * Minimum validator signature threshold (%)
     * Requires 66% of validators to sign each transaction
     */
    MIN_VALIDATOR_THRESHOLD: 66,

    /**
     * Genesis validator ID
     * The first validator that bootstraps the network
     */
    GENESIS_VALIDATOR: 'SYSTEM',

    /**
     * Proof type
     * DPoA = Delegated Proof of Activity
     */
    PROOF_TYPE: 'DPoA',

    /**
     * Network version
     * Used to prevent incompatible nodes from connecting
     */
    NETWORK_VERSION: '2.5',

    /**
     * Maximum chain reorg depth
     * Prevents deep reorganizations (security)
     */
    MAX_REORG_DEPTH: 100,
} as const;

/**
 * Validate if a block follows consensus rules
 */
export function validateConsensusRules(block: any): { valid: boolean; error?: string } {
    // Check block size
    const blockSize = JSON.stringify(block).length;
    if (blockSize > IMMUTABLE_CONSENSUS_RULES.MAX_BLOCK_SIZE) {
        return { valid: false, error: `Block size ${blockSize} exceeds max ${IMMUTABLE_CONSENSUS_RULES.MAX_BLOCK_SIZE}` };
    }

    // Check transaction count
    if (block.transactions && block.transactions.length > IMMUTABLE_CONSENSUS_RULES.MAX_TRANSACTIONS_PER_BLOCK) {
        return { valid: false, error: `Block has ${block.transactions.length} tx, max is ${IMMUTABLE_CONSENSUS_RULES.MAX_TRANSACTIONS_PER_BLOCK}` };
    }

    return { valid: true };
}
