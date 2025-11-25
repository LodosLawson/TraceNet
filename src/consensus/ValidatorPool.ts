/**
 * Validator information
 */
export interface Validator {
    validator_id: string;
    user_id: string;
    public_key: string;
    is_online: boolean;
    last_active: number;
    reputation: number;
    total_blocks_produced: number;
    total_signatures: number;
}

/**
 * Validator pool for DPoA consensus
 */
export class ValidatorPool {
    private validators: Map<string, Validator>;
    private onlineValidators: Set<string>;
    private offlineTimeout: number; // milliseconds

    constructor(offlineTimeout: number = 60000) {
        this.validators = new Map();
        this.onlineValidators = new Set();
        this.offlineTimeout = offlineTimeout;
    }

    /**
     * Register a new validator
     */
    registerValidator(
        validatorId: string,
        userId: string,
        publicKey: string
    ): void {
        const validator: Validator = {
            validator_id: validatorId,
            user_id: userId,
            public_key: publicKey,
            is_online: false,
            last_active: Date.now(),
            reputation: 100.0,
            total_blocks_produced: 0,
            total_signatures: 0,
        };

        this.validators.set(validatorId, validator);
    }

    /**
     * Mark validator as online
     */
    setOnline(validatorId: string): void {
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
    setOffline(validatorId: string): void {
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
    updateHeartbeat(validatorId: string): void {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.last_active = Date.now();
            validator.is_online = true;
            this.onlineValidators.add(validatorId);
            this.validators.set(validatorId, validator);
        }
    }

    /**
     * Get online validators
     */
    getOnlineValidators(): Validator[] {
        this.checkOfflineValidators();
        return Array.from(this.onlineValidators)
            .map((id) => this.validators.get(id))
            .filter((v): v is Validator => v !== undefined);
    }

    /**
     * Select random validators for signing
     */
    selectValidators(count: number): Validator[] {
        const online = this.getOnlineValidators();

        if (online.length === 0) {
            return [];
        }

        // If requested count is more than available, return all
        if (count >= online.length) {
            return online;
        }

        // Randomly select validators (weighted by reputation)
        const selected: Validator[] = [];
        const available = [...online];

        for (let i = 0; i < count; i++) {
            if (available.length === 0) break;

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
    selectBlockProducer(blockIndex: number): Validator | null {
        const online = this.getOnlineValidators();

        if (online.length === 0) {
            return null;
        }

        // Sort by validator_id for deterministic selection
        online.sort((a, b) => a.validator_id.localeCompare(b.validator_id));

        // Round-robin based on block index
        const index = blockIndex % online.length;
        return online[index];
    }

    /**
     * Increment validator statistics
     */
    incrementBlocksProduced(validatorId: string): void {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.total_blocks_produced++;
            this.validators.set(validatorId, validator);
        }
    }

    /**
     * Increment signature count
     */
    incrementSignatures(validatorId: string): void {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.total_signatures++;
            this.validators.set(validatorId, validator);
        }
    }

    /**
     * Update validator reputation
     */
    updateReputation(validatorId: string, change: number): void {
        const validator = this.validators.get(validatorId);
        if (validator) {
            validator.reputation = Math.max(0, Math.min(100, validator.reputation + change));
            this.validators.set(validatorId, validator);
        }
    }

    /**
     * Get validator by ID
     */
    getValidator(validatorId: string): Validator | undefined {
        return this.validators.get(validatorId);
    }

    /**
     * Get all validators
     */
    getAllValidators(): Validator[] {
        return Array.from(this.validators.values());
    }

    /**
     * Get online validator count
     */
    getOnlineCount(): number {
        this.checkOfflineValidators();
        return this.onlineValidators.size;
    }

    /**
     * Check and mark offline validators
     */
    private checkOfflineValidators(): void {
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
    getStats(): {
        totalValidators: number;
        onlineValidators: number;
        avgReputation: number;
        totalBlocksProduced: number;
        totalSignatures: number;
    } {
        const validators = Array.from(this.validators.values());

        return {
            totalValidators: validators.length,
            onlineValidators: this.getOnlineCount(),
            avgReputation:
                validators.reduce((sum, v) => sum + v.reputation, 0) / validators.length || 0,
            totalBlocksProduced: validators.reduce((sum, v) => sum + v.total_blocks_produced, 0),
            totalSignatures: validators.reduce((sum, v) => sum + v.total_signatures, 0),
        };
    }

    /**
     * Export validators to JSON
     */
    toJSON(): Validator[] {
        return Array.from(this.validators.values());
    }

    /**
     * Import validators from JSON
     */
    loadFromJSON(data: Validator[]): void {
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
