"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidatorPool = void 0;
/**
 * Validator pool for DPoA consensus
 */
class ValidatorPool {
    constructor(offlineTimeout = 60000) {
        this.validators = new Map();
        this.onlineValidators = new Set();
        this.offlineTimeout = offlineTimeout;
        this.validatorWallets = new Map();
    }
    /**
     * Register a new validator
     */
    registerValidator(validatorId, userId, publicKey) {
        const validator = {
            validator_id: validatorId,
            user_id: userId,
            public_key: publicKey,
            is_online: false,
            last_active: Date.now(),
            last_seen_block_height: 0, // Initialize
            reputation: 100.0,
            total_blocks_produced: 0,
            total_signatures: 0,
        };
        this.validators.set(validatorId, validator);
    }
    /**
     * Mark validator as online
     */
    setOnline(validatorId) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.is_online = true;
            validator.last_active = Date.now();
            this.onlineValidators.add(validatorId);
            this.validators.set(validatorId, validator);
        }
    }
    /**
     * Mark validator as offline
     */
    setOffline(validatorId) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.is_online = false;
            this.onlineValidators.delete(validatorId);
            this.validators.set(validatorId, validator);
        }
    }
    /**
     * Update validator heartbeat
     */
    updateHeartbeat(validatorId, currentBlockHeight = 0) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.last_active = Date.now();
            // Only update height if greater than previous (monotonicity)
            if (currentBlockHeight > validator.last_seen_block_height) {
                validator.last_seen_block_height = currentBlockHeight;
            }
            validator.is_online = true;
            this.onlineValidators.add(validatorId);
            this.validators.set(validatorId, validator); // Map update? needed if object ref is same?
        }
    }
    /**
     * Get validators active since a specific block height
     * Used for Epoch rewards
     */
    getValidatorsActiveSinceBlock(minBlockHeight) {
        const activeValidators = [];
        for (const validator of this.validators.values()) {
            if (validator.last_seen_block_height >= minBlockHeight) {
                activeValidators.push(validator);
            }
        }
        return activeValidators;
    }
    /**
     * Get online validators
     */
    getOnlineValidators() {
        this.checkOfflineValidators();
        return Array.from(this.onlineValidators)
            .map((id) => this.validators.get(id))
            .filter((v) => v !== undefined);
    }
    /**
     * Select random validators for signing
     */
    selectValidators(count) {
        const online = this.getOnlineValidators();
        if (online.length === 0) {
            return [];
        }
        // If requested count is more than available, return all
        if (count >= online.length) {
            return online;
        }
        // Randomly select validators (weighted by reputation)
        const selected = [];
        const available = [...online];
        for (let i = 0; i < count; i++) {
            if (available.length === 0)
                break;
            // Weighted random selection based on reputation
            const totalReputation = available.reduce((sum, v) => sum + v.reputation, 0);
            let random = Math.random() * totalReputation;
            let selectedIndex = 0;
            for (let j = 0; j < available.length; j++) {
                random -= available[j].reputation;
                if (random <= 0) {
                    selectedIndex = j;
                    break;
                }
            }
            selected.push(available[selectedIndex]);
            available.splice(selectedIndex, 1);
        }
        return selected;
    }
    /**
     * Select block producer (round-robin or weighted)
     */
    /**
     * Select block producer (round-robin or weighted)
     * @param blockIndex Index of the block to be produced
     * @param previousBlockHash Hash of the previous block (for randomness)
     * @param round Round number (for fallback/soft-turn) - defaults to 0
     */
    selectBlockProducer(blockIndex, previousBlockHash, round = 0) {
        const online = this.getOnlineValidators();
        if (online.length === 0) {
            return null;
        }
        // Sort by validator_id for deterministic selection
        online.sort((a, b) => a.validator_id.localeCompare(b.validator_id));
        let index = 0;
        if (previousBlockHash) {
            const crypto = require('crypto');
            // Use hash of previous block hash + block index to select validator
            // This makes it deterministic but hard to predict far in advance without knowing previous block hashes
            const hash = crypto.createHash('sha256')
                .update(previousBlockHash + blockIndex.toString())
                .digest('hex');
            // Take last 8 chars of hash to convert to number
            const hashNum = parseInt(hash.substring(hash.length - 8), 16);
            index = hashNum % online.length;
        }
        else {
            // Fallback to round-robin based on block index
            index = blockIndex % online.length;
        }
        // Apply round rotation (fallback mechanism)
        // If round > 0, we shift to the next validator in the sorted list
        index = (index + round) % online.length;
        return online[index];
    }
    /**
     * Increment validator statistics
     */
    incrementBlocksProduced(validatorId) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.total_blocks_produced++;
            this.validators.set(validatorId, validator);
        }
    }
    /**
     * Increment signature count
     */
    incrementSignatures(validatorId) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.total_signatures++;
            this.validators.set(validatorId, validator);
        }
    }
    /**
     * Update validator reputation
     */
    updateReputation(validatorId, change) {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.reputation += change;
            // Cap reputation at 100
            if (validator.reputation > 100)
                validator.reputation = 100;
            // If reputation falls too low, set offline
            if (validator.reputation < 0) {
                validator.reputation = 0;
                this.setOffline(validatorId);
            }
            this.validators.set(validatorId, validator);
        }
    }
    // ... inside ValidatorPool class ...
    /**
     * Slash a validator for malicious behavior
     * Penalizes reputation and sets offline (jail)
     */
    slashValidator(evidence) {
        const validatorId = evidence.validatorId;
        const validator = this.validators.get(validatorId);
        if (validator) {
            console.warn(`🚨 SLASHING VALIDATOR ${validatorId}: ${evidence.reason}`);
            if (evidence.doubleSign) {
                console.warn(`   Evidence: Double signing at height ${evidence.doubleSign.blockHeight}`);
                console.warn(`   Hash A: ${evidence.doubleSign.blockHash1}`);
                console.warn(`   Hash B: ${evidence.doubleSign.blockHash2}`);
            }
            // Heavy reputation penalty
            this.updateReputation(validatorId, -50);
            // Immediate jail (offline)
            this.setOffline(validatorId);
            // log slashing event (in real system, would be a chain event)
            console.log(`Validator ${validatorId} has been slashed and jailed.`);
        }
    }
    /**
     * Get validator by ID
     * V3 UPDATE: Auto-register unknown validators (Soft Mode) to facilitate P2P sync
     */
    getValidator(validatorId) {
        let validator = this.validators.get(validatorId);
        // SOFT MODE FOR V3:
        // If validator is unknown, we dynamically register them as a "Guest Validator"
        // so the block doesn't get rejected by "Unknown Validator" error.
        // In a strict Mainnet, this would be disabled or require a staking tx.
        if (!validator) {
            console.log(`[ValidatorPool] ⚠️ SOFT MODE: Registering unknown validator ${validatorId.substring(0, 8)}... to allow sync.`);
            this.registerValidator(validatorId, 'unknown_user', 'unknown_key_' + validatorId // We don't have the pubkey here easily unless passed, but we need the object.
            );
            validator = this.validators.get(validatorId);
        }
        return validator;
    }
    /**
     * Get all validators
     */
    getAllValidators() {
        return Array.from(this.validators.values());
    }
    /**
     * Register wallet address for validator (for fee distribution)
     */
    registerWallet(validatorId, walletAddress) {
        this.validatorWallets.set(validatorId, walletAddress);
    }
    /**
     * Get registered wallet for validator
     */
    getWallet(validatorId) {
        return this.validatorWallets.get(validatorId);
    }
    /**
     * Get all wallet mappings
     */
    getAllWalletMappings() {
        return new Map(this.validatorWallets);
    }
    /**
     * Get online validator count
     */
    getOnlineCount() {
        this.checkOfflineValidators();
        return this.onlineValidators.size;
    }
    /**
     * Check and mark offline validators
     */
    checkOfflineValidators() {
        const now = Date.now();
        for (const validatorId of this.onlineValidators) {
            const validator = this.validators.get(validatorId);
            if (validator && now - validator.last_active > this.offlineTimeout) {
                this.setOffline(validatorId);
            }
        }
    }
    /**
     * Get validator statistics
     */
    getStats() {
        const validators = Array.from(this.validators.values());
        return {
            totalValidators: validators.length,
            onlineValidators: this.getOnlineCount(),
            avgReputation: validators.reduce((sum, v) => sum + v.reputation, 0) / validators.length || 0,
            totalBlocksProduced: validators.reduce((sum, v) => sum + v.total_blocks_produced, 0),
            totalSignatures: validators.reduce((sum, v) => sum + v.total_signatures, 0),
        };
    }
    /**
     * Export validators to JSON
     */
    toJSON() {
        return Array.from(this.validators.values());
    }
    /**
     * Import validators from JSON
     */
    loadFromJSON(data) {
        this.validators.clear();
        this.onlineValidators.clear();
        for (const validator of data) {
            this.validators.set(validator.validator_id, validator);
            if (validator.is_online) {
                this.onlineValidators.add(validator.validator_id);
            }
        }
    }
}
exports.ValidatorPool = ValidatorPool;
