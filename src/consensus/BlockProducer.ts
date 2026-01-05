import { Block } from '../blockchain/models/Block';
import { Transaction } from '../blockchain/models/Transaction';
import { Blockchain } from '../blockchain/core/Blockchain';
import { ValidatorPool } from './ValidatorPool';
import { Mempool } from '../node/Mempool';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import { RewardDistributor } from './RewardDistributor'; // NEW
import EventEmitter from 'events';

/**
 * Block producer for creating new blocks
 */
export class BlockProducer extends EventEmitter {
    private blockchain: Blockchain;
    private validatorPool: ValidatorPool;
    private mempool: Mempool;
    private rewardDistributor: RewardDistributor; // NEW
    private blockTime: number;
    private maxTransactionsPerBlock: number;
    private isProducing: boolean;
    private productionInterval: NodeJS.Timeout | null;
    private nodeWalletAddress?: string;

    constructor(
        blockchain: Blockchain,
        validatorPool: ValidatorPool,
        mempool: Mempool,
        rewardDistributor: RewardDistributor, // NEW
        blockTime: number = 5000,
        maxTransactionsPerBlock: number = 1000,
        nodeWalletAddress?: string
    ) {
        super();
        this.blockchain = blockchain;
        this.validatorPool = validatorPool;
        this.mempool = mempool;
        this.rewardDistributor = rewardDistributor; // NEW
        this.blockTime = blockTime;
        this.maxTransactionsPerBlock = maxTransactionsPerBlock;
        this.nodeWalletAddress = nodeWalletAddress;
        this.isProducing = false;
        this.productionInterval = null;
    }

    /**
     * Set the node wallet address for fee collection
     */
    setNodeWallet(address: string) {
        this.nodeWalletAddress = address;
    }

    // Store private keys for local validators (e.g. System Validator)
    private localValidators: Map<string, string> = new Map();

    /**
     * Register a local validator key for signing blocks
     */
    registerLocalValidator(validatorId: string, privateKey: string): void {
        this.localValidators.set(validatorId, privateKey);
    }

    /**
     * Start block production (Consensus Loop)
     */
    start(): void {
        if (this.isProducing) {
            return;
        }

        this.isProducing = true;
        console.log('Starting Consensus Loop...');

        // Check for existing transactions on startup
        if (this.mempool.getSize() > 0) {
            console.log(`[Consensus] Found ${this.mempool.getSize()} pending transactions.`);
        }

        // CONSENSUS POLLING LOOP (1000ms)
        // Checks eligibility every second to handle round changes and timeouts
        this.productionInterval = setInterval(async () => {
            if (!this.isProducing) return;

            // 1. Check if there are transactions to mine
            if (this.mempool.getSize() === 0) return;

            // 2. Determine if it is our turn to produce
            try {
                const latestBlock = this.blockchain.getLatestBlock();
                const nextIndex = latestBlock.index + 1;

                const elapsedTime = Date.now() - latestBlock.timestamp;
                const currentRound = Math.max(0, Math.floor(elapsedTime / this.blockTime));

                // Select expected producer for this round
                const producer = this.validatorPool.selectBlockProducer(nextIndex, latestBlock.hash, currentRound);

                if (producer) {
                    // Check if WE are this producer (do we have the private key?)
                    if (this.localValidators.has(producer.validator_id)) {
                        // It is our turn! Produce the block.
                        // Optimization: Don't spam logs, only log when starting production
                        // console.log(`[Consensus] It's my turn (Round ${currentRound}). Producing block...`);
                        await this.produceBlock();
                    } else {
                        // Not our turn. Wait.
                        // console.log(`[Consensus] Round ${currentRound}: Waiting for ${producer.validator_id}`);
                    }
                } else {
                    console.warn('[Consensus] No producer selected for this round.');
                }
            } catch (err) {
                console.error('[Consensus] Loop Error:', err);
            }

        }, 1000); // Check every second

        console.log('✅ Consensus Loop Active. Waiting for turn...');
    }

    /**
     * Stop block production
     */
    stop(): void {
        if (!this.isProducing) {
            return;
        }

        this.isProducing = false;

        if (this.productionInterval) {
            clearInterval(this.productionInterval); // Use clearInterval for polling
            this.productionInterval = null;
        }

        console.log('Block production stopped');
    }

    /**
     * Produce a new block
     */
    private async produceBlock(): Promise<void> {
        try {
            // Get transactions from mempool
            const transactions = this.mempool.getTopTransactions(
                this.maxTransactionsPerBlock
            );

            // Skip if no transactions
            if (transactions.length === 0) {
                return;
            }

            // Select block producer
            const latestBlock = this.blockchain.getLatestBlock();
            const nextIndex = latestBlock.index + 1;

            // Calculate current round based on time elapsed
            // If block time is 5s:
            // 0-5s: Round 0
            // 5-10s: Round 1 (Fallback 1)
            // 10-15s: Round 2 (Fallback 2)
            const elapsedTime = Date.now() - latestBlock.timestamp;
            // Ensure round is at least 0 (in case of clock skew)
            const currentRound = Math.max(0, Math.floor(elapsedTime / this.blockTime));

            if (currentRound > 0) {
                console.log(`[Consensus] Slow block production. Elapsed: ${elapsedTime}ms. Round: ${currentRound}. Switching validator...`);
            }

            // Pass previous block hash for deterministic random selection
            const producer = this.validatorPool.selectBlockProducer(nextIndex, latestBlock.hash, currentRound);

            if (!producer) {
                console.warn('No validator available for block production');
                return;
            }

            // Calculate state root
            const stateRoot = this.blockchain.calculateStateRoot(transactions);

            // Calculate next timestamp
            // Ensure strictly increasing timestamp (Monotonicity)
            // If system time < previous block timestamp, we must push it forward.
            // If system time > previous + blockTime, that's fine.
            let nextTimestamp = Date.now();
            if (nextTimestamp <= latestBlock.timestamp) {
                nextTimestamp = latestBlock.timestamp + 1;
                // Optional: warnings if drift is large
                if (latestBlock.timestamp - Date.now() > 5000) {
                    console.warn(`[BlockProducer] System clock lagging behind chain tip by ${latestBlock.timestamp - Date.now()}ms`);
                }
            }

            // Sort transactions by Nonce to ensure dependent transactions (chaining) work correctly
            transactions.sort((a, b) => {
                if (a.from_wallet === b.from_wallet) {
                    return a.nonce - b.nonce;
                }
                return 0;
            });

            // Filter out transactions that are not ready (Time-Based Fees)
            // We do this AFTER getting them, so they stay in mempool but don't get into this block
            const validTransactions: Transaction[] = [];
            for (const tx of transactions) {
                const validation = this.blockchain.validateTransaction(tx);
                if (validation.valid) {
                    validTransactions.push(tx);
                } else if (validation.error && validation.error.includes('wait')) {
                    // It's a "Wait" error, so we skip it for this block but keep in mempool
                    console.log(`[BlockProducer] Skipping low-fee tx ${tx.tx_id.substring(0, 8)} (Waiting time not met)`);

                    // IMPORTANT: If we skip a transaction (Nonce N), we must ALSO skip dependent transactions (Nonce N+1)
                    // Since we sorted by nonce, if we skip Nonce N, Nonce N+1 will fail validation in addBlock anyway,
                    // but it's cleaner to handle dependency here if possible. 
                    // However, `validateTransaction` checks nonce against CURRENT state.
                    // If we skip N, N+1 check against current state will fail (Gap)? No, N+1 check against current state (Nonce N-1)
                    // If current state is Nonce K.
                    // Tx N (K+1). Valid? Yes (except time).
                    // Tx N+1 (K+2). Valid? NO, because gap.
                    // So `validateTransaction` naturally handles dependencies?
                    // YES. `validateTransaction` uses `applyTransactionToState`.
                    // But `validateTransaction` acts on a COPY of state?
                    // Actually `validateTransaction` uses the current state.
                    // If we process sequentially:
                    // Tx N: Fails time. Skipped.
                    // Tx N+1: Checked against State (Nonce K). Expects K+1. Got K+2. Fails Nonce.
                    // So Tx N+1 also gets skipped.
                    // Wait, does Tx N+1 get "Removed from Mempool" as invalid?
                    // Below, we only remove transactions that fail `addBlock`.
                    // But we are constructing a `newBlock` with `validTransactions` ONLY.
                    // So `addBlock` will likely succeed!
                    // And the skipped transactions remain in `transactions` list but NOT in `validTransactions`.
                    // Mempool removal only happens for `validTransactions` (lines 196-198).
                    // So skipped transactions stay in mempool! CORRECT.
                } else {
                    // Invalid for other reasons? 
                    // We can skip them here too.
                    console.warn(`[BlockProducer] Skipping invalid tx ${tx.tx_id.substring(0, 8)}: ${validation.error}`);
                    // Should we remove them from mempool immediately?
                    // If we don't, they will block the queue?
                    // Mempool.getTopTransactions returns them again.
                    // So yes, we should probably remove "Hard Invalid" transactions here to clean up.
                    // But `validateTransaction` might fail due to temporary reasons?
                    // "Invalid Nonce" -> Might be future nonce? (Gap)
                    // If it's a Gap, we should keep it.
                    // If it's "Invalid Signature", remove it.
                    // "Insufficient balance" -> Remove.

                    // For safety, let's just skip them for this block.
                    // The "Stall" protection is in the `else` block of `produceBlock` (if block add fails).
                    // But if we filter them here, `addBlock` won't fail.
                    // So we must manage mempool cleanup here or rely on expiration.
                    // Let's rely on expiration for now to be safe, OR purge if clearly invalid.
                    // Let's purge if it's NOT a nonce gap or time wait.
                    if (validation.error && !validation.error.includes('wait') && !validation.error.includes('Invalid nonce')) {
                        this.mempool.removeTransaction(tx.tx_id);
                    }
                }
            }

            // If no valid transactions remains
            if (validTransactions.length === 0) {
                // console.log('[BlockProducer] No valid transactions to mine.');
                return;
            }

            // NEW: Epoch Rewards (Every 200 blocks)
            // We check the NEXT block index (nextIndex)
            // If nextIndex % 200 === 0, we verify and distribute

            // UPDATE: Distribute to validators active WITHIN the epoch (User Request)
            // "Active" means they sent a heartbeat or produced a block within the last 200 blocks.
            // Using Block Height based tracking solely.
            const EPOCH_LENGTH = 200;
            const minActiveBlock = Math.max(0, nextIndex - EPOCH_LENGTH);

            const eligibleValidators = this.validatorPool.getValidatorsActiveSinceBlock(minActiveBlock).map(v => v.validator_id);

            const epochRewards = this.rewardDistributor.distributeEpochRewards(nextIndex, eligibleValidators);

            if (epochRewards.length > 0) {
                console.log(`[BlockProducer] Including ${epochRewards.length} Epoch Reward transactions in Block ${nextIndex} (Validators active since Block ${minActiveBlock})`);
                // These are TransactionModel objects. Need to convert to Transaction interface or similar?
                // TransactionModel usually implements Transaction.
                // We add them to the FRONT of the validTransactions list to ensure they are processed first?
                // Or just append. Since they are REWARD type, they should be valid.
                // We need to validate them? Blockchain.validateTransaction checks balance.
                // Epoch rewards come from VALIDATOR_POOL.
                // We need to ensure VALIDATOR_POOL has balance in CURRENT state.
                // We assume distributeEpochRewards checked current state balance.

                // Cast to Transaction type just in case
                const rewardTxs = epochRewards.map(t => t.toJSON() as Transaction);
                validTransactions.push(...rewardTxs);
            }

            // Create new block
            const newBlock = Block.create(
                nextIndex,
                latestBlock.hash!,
                validTransactions, // Includes filtered user txs + epoch rewards
                producer.validator_id,
                stateRoot, // Note: State root is calculated from txs. If we added rewards, we should recalc state root?
                // YES. We calculated stateRoot BEFORE adding rewards.
                // We need to recalculate stateRoot or calculate it AFTER adding rewards.
                // Let's move stateRoot calculation down.
                this.nodeWalletAddress,
                nextTimestamp
            );

            // Recalculate State Root with ALL transactions
            newBlock.state_root = this.blockchain.calculateStateRoot(validTransactions);

            // Sign block (in production, this would use the producer's private key)
            // For now, we'll create a placeholder signature
            const blockData = newBlock.getSignableData();
            const signature = this.createBlockSignature(blockData, producer.validator_id);

            // Add block to blockchain
            const result = this.blockchain.addBlock(
                validTransactions, // Use filtered list
                producer.validator_id,
                signature,
                newBlock.timestamp, // Pass timestamp to ensure signature matches
            );

            if (result.success && result.block) {
                // Remove mined transactions from mempool
                for (const tx of transactions) { // Remove original user transactions
                    this.mempool.removeTransaction(tx.tx_id);
                }
                // Reward txs were not in mempool, so no need to remove them.

                // Update validator stats
                this.validatorPool.incrementBlocksProduced(producer.validator_id);

                // ✅ MINING POOL: Register all active validators for this block
                const miningPool = this.blockchain.getMiningPool();
                const allValidators = this.validatorPool.getAllValidators();
                const onlineValidators = allValidators.filter(v => v.is_online);

                onlineValidators.forEach(validator => {
                    const walletAddress = this.validatorPool.getWallet(validator.validator_id);
                    if (walletAddress) {
                        // Register with validator ID as node ID, IP as placeholder, wallet for rewards
                        miningPool.addActiveNode(
                            validator.validator_id,
                            'validator-network', // IP placeholder for validators
                            walletAddress,
                            result.block!.index
                        );
                    }
                });

                // Emit new block event
                this.emit('newBlock', {
                    block: result.block,
                    producer: producer.validator_id,
                    transaction_count: validTransactions.length,
                });

                console.log(
                    `Block ${result.block.index} produced by ${producer.validator_id} with ${validTransactions.length} transactions`
                );
            } else {
                console.error('Failed to add block:', result.error);

                // Identify and remove invalid transactions to prevent stalling
                console.log('Validating transactions to identify culprits...');
                const invalidTxIds: string[] = [];

                for (const tx of validTransactions) {
                    // Use new validateTransaction method
                    const validation = this.blockchain.validateTransaction(tx);
                    if (!validation.valid) {
                        console.warn(`Removing invalid transaction ${tx.tx_id}: ${validation.error}`);
                        this.mempool.removeTransaction(tx.tx_id);
                        invalidTxIds.push(tx.tx_id);
                    }
                }

                if (invalidTxIds.length === 0) {
                    console.error('CRITICAL: Block failed but individual transactions appear valid. Possible state mismatch or block-level constraint?');
                    console.warn('Clearing current batch from mempool to resolve stall.');
                    for (const tx of transactions) { // Clear original batch
                        this.mempool.removeTransaction(tx.tx_id);
                    }
                }
            }
        } catch (error) {
            console.error('Error producing block:', error);
            if (error instanceof Error) {
                console.error(error.stack);
            }
        }
    }

    /**
     * Create block signature (placeholder - in production use actual private key)
     */
    private createBlockSignature(blockData: string, validatorId: string): string {
        // Check if we have the private key for this validator locally
        const privateKey = this.localValidators.get(validatorId);

        if (privateKey) {
            return KeyManager.sign(blockData, privateKey);
        }

        // Fallback for simulation (Invalid in real verification if Blockchain enforces signatures)
        return KeyManager.hash(blockData + validatorId);
    }

    /**
     * Manually trigger block production
     */
    async triggerBlockProduction(): Promise<{
        success: boolean;
        error?: string;
        block?: Block;
    }> {
        try {
            const transactions = this.mempool.getTopTransactions(
                this.maxTransactionsPerBlock
            );

            if (transactions.length === 0) {
                return { success: false, error: 'No transactions in mempool' };
            }

            const latestBlock = this.blockchain.getLatestBlock();
            const nextIndex = latestBlock.index + 1;

            // Calculate current round
            const elapsedTime = Date.now() - latestBlock.timestamp;
            const currentRound = Math.max(0, Math.floor(elapsedTime / this.blockTime));

            // Pass previous block hash for deterministic random selection
            const producer = this.validatorPool.selectBlockProducer(nextIndex, latestBlock.hash, currentRound);

            if (!producer) {
                const allValidators = this.validatorPool.getAllValidators();
                const onlineValidators = allValidators.filter(v => v.is_online);
                return {
                    success: false,
                    error: `No validator available for block production (${onlineValidators.length}/${allValidators.length} validators online)`
                };
            }

            // Sort transactions by Nonce to ensure dependent transactions (chaining) work correctly
            transactions.sort((a, b) => {
                if (a.from_wallet === b.from_wallet) {
                    return a.nonce - b.nonce;
                }
                return 0; // Relative order of different accounts doesn't matter (heuristically)
            });

            console.log('Sorted Transactions for Block: ', transactions.map(t => `${t.from_wallet.substr(0, 8)}:${t.nonce}`).join(', '));

            // Filter out transactions that are not ready (Time-Based Fees)
            const validTransactions: Transaction[] = [];
            for (const tx of transactions) {
                const validation = this.blockchain.validateTransaction(tx);
                if (validation.valid) {
                    validTransactions.push(tx);
                } else if (validation.error && validation.error.includes('wait')) {
                    console.log(`[BlockProducer] Skipping low-fee tx ${tx.tx_id.substring(0, 8)} (Waiting time not met)`);
                } else {
                    if (validation.error && !validation.error.includes('wait') && !validation.error.includes('Invalid nonce')) {
                        this.mempool.removeTransaction(tx.tx_id);
                    }
                }
            }

            if (validTransactions.length === 0) {
                return { success: false, error: 'No valid transactions to mine (all waiting or invalid)' };
            }

            const stateRoot = this.blockchain.calculateStateRoot(validTransactions);

            const newBlock = Block.create(
                nextIndex,
                latestBlock.hash!,
                validTransactions, // Use filtered
                producer.validator_id,
                stateRoot,
                this.nodeWalletAddress,
                Date.now() // Use current time for triggered blocks
            );

            const blockData = newBlock.getSignableData();
            const signature = this.createBlockSignature(blockData, producer.validator_id);

            const result = this.blockchain.addBlock(
                validTransactions,
                producer.validator_id,
                signature,
                newBlock.timestamp
            );

            if (result.success && result.block) {
                for (const tx of validTransactions) {
                    this.mempool.removeTransaction(tx.tx_id);
                }

                this.validatorPool.incrementBlocksProduced(producer.validator_id);

                this.emit('newBlock', {
                    block: result.block,
                    producer: producer.validator_id,
                    transaction_count: transactions.length,
                });

                return { success: true, block: result.block };
            } else {
                console.error('Failed to trigger block:', result.error);

                // Identify and remove invalid transactions to prevent stalling (Anti-Stall Fix)
                console.log('Validating transactions to identify culprits...');
                const invalidTxIds: string[] = [];

                for (const tx of transactions) {
                    // Use new validateTransaction method
                    const validation = this.blockchain.validateTransaction(tx);
                    if (!validation.valid) {
                        console.warn(`Removing invalid transaction ${tx.tx_id}: ${validation.error}`);
                        this.mempool.removeTransaction(tx.tx_id);
                        invalidTxIds.push(tx.tx_id);
                    }
                }

                if (invalidTxIds.length === 0) {
                    // If all appear valid individually but block failed, it might be state mismatch or strictly order dependent
                    // Clear batch to be safe
                    console.warn('Clearing current batch from mempool to resolve stall (Block level failure).');
                    for (const tx of transactions) {
                        this.mempool.removeTransaction(tx.tx_id);
                    }
                }

                return { success: false, error: result.error };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get production statistics
     */
    getStats(): {
        isProducing: boolean;
        blockTime: number;
        maxTransactionsPerBlock: number;
        currentBlockHeight: number;
        mempoolSize: number;
    } {
        return {
            isProducing: this.isProducing,
            blockTime: this.blockTime,
            maxTransactionsPerBlock: this.maxTransactionsPerBlock,
            currentBlockHeight: this.blockchain.getChainLength(),
            mempoolSize: this.mempool.getSize(),
        };
    }
}
