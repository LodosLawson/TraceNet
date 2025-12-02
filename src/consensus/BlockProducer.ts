import { Block } from '../blockchain/models/Block';
import { Transaction } from '../blockchain/models/Transaction';
import { Blockchain } from '../blockchain/core/Blockchain';
import { ValidatorPool } from './ValidatorPool';
import { Mempool } from '../node/Mempool';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import EventEmitter from 'events';

/**
 * Block producer for creating new blocks
 */
export class BlockProducer extends EventEmitter {
    private blockchain: Blockchain;
    private validatorPool: ValidatorPool;
    private mempool: Mempool;
    private blockTime: number;
    private maxTransactionsPerBlock: number;
    private isProducing: boolean;
    private productionInterval: NodeJS.Timeout | null;

    constructor(
        blockchain: Blockchain,
        validatorPool: ValidatorPool,
        mempool: Mempool,
        blockTime: number = 5000,
        maxTransactionsPerBlock: number = 1000
    ) {
        super();
        this.blockchain = blockchain;
        this.validatorPool = validatorPool;
        this.mempool = mempool;
        this.blockTime = blockTime;
        this.maxTransactionsPerBlock = maxTransactionsPerBlock;
        this.isProducing = false;
        this.productionInterval = null;
    }

    /**
     * Start block production (event-driven)
     */
    start(): void {
        if (this.isProducing) {
            return;
        }

        this.isProducing = true;

        // Check for existing transactions in mempool at startup
        const existingTxCount = this.mempool.getSize();
        if (existingTxCount > 0) {
            console.log(`Found ${existingTxCount} existing transaction(s) in mempool, scheduling initial block production...`);
            // Schedule initial block production with small delay
            setTimeout(() => {
                if (this.isProducing) {
                    this.produceBlock();
                }
            }, 1000);
        }

        // Listen for new transactions in mempool
        this.mempool.on('transactionAdded', () => {
            // Use a small delay to batch multiple transactions into one block
            if (this.productionInterval) {
                clearTimeout(this.productionInterval);
            }

            this.productionInterval = setTimeout(() => {
                this.produceBlock();
            }, 2000); // 2 second delay to batch transactions
        });

        console.log('Block production started (event-driven mode)');
    }

    /**
     * Stop block production
     */
    stop(): void {
        if (!this.isProducing) {
            return;
        }

        this.isProducing = false;

        // Remove event listener
        this.mempool.removeAllListeners('transactionAdded');

        if (this.productionInterval) {
            clearTimeout(this.productionInterval);
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
            const producer = this.validatorPool.selectBlockProducer(nextIndex);

            if (!producer) {
                console.warn('No validator available for block production');
                return;
            }

            // Calculate state root (will be done by blockchain)
            const stateRoot = '0'.repeat(64); // Placeholder, blockchain will calculate

            // Create new block
            const newBlock = Block.create(
                nextIndex,
                latestBlock.hash!,
                transactions,
                producer.validator_id,
                stateRoot
            );

            // Sign block (in production, this would use the producer's private key)
            // For now, we'll create a placeholder signature
            const blockData = newBlock.getSignableData();
            const signature = this.createBlockSignature(blockData, producer.validator_id);

            // Add block to blockchain
            const result = this.blockchain.addBlock(
                transactions,
                producer.validator_id,
                signature
            );

            if (result.success && result.block) {
                // Remove transactions from mempool
                for (const tx of transactions) {
                    this.mempool.removeTransaction(tx.tx_id);
                }

                // Update validator stats
                this.validatorPool.incrementBlocksProduced(producer.validator_id);

                // Emit new block event
                this.emit('newBlock', {
                    block: result.block,
                    producer: producer.validator_id,
                    transaction_count: transactions.length,
                });

                console.log(
                    `Block ${result.block.index} produced by ${producer.validator_id} with ${transactions.length} transactions`
                );
            } else {
                console.error('Failed to add block:', result.error);
            }
        } catch (error) {
            console.error('Error producing block:', error);
        }
    }

    /**
     * Create block signature (placeholder - in production use actual private key)
     */
    private createBlockSignature(blockData: string, validatorId: string): string {
        // In production, this would use the validator's private key
        // For now, create a deterministic signature based on block data
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
            const producer = this.validatorPool.selectBlockProducer(nextIndex);

            if (!producer) {
                const allValidators = this.validatorPool.getAllValidators();
                const onlineValidators = allValidators.filter(v => v.is_online);
                return {
                    success: false,
                    error: `No validator available for block production (${onlineValidators.length}/${allValidators.length} validators online)`
                };
            }

            const stateRoot = '0'.repeat(64);

            const newBlock = Block.create(
                nextIndex,
                latestBlock.hash!,
                transactions,
                producer.validator_id,
                stateRoot
            );

            const blockData = newBlock.getSignableData();
            const signature = this.createBlockSignature(blockData, producer.validator_id);

            const result = this.blockchain.addBlock(
                transactions,
                producer.validator_id,
                signature
            );

            if (result.success && result.block) {
                for (const tx of transactions) {
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
