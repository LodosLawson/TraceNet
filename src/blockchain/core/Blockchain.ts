import { Block, IBlock } from '../models/Block';
import { Transaction, TransactionModel } from '../models/Transaction';
import { KeyManager } from '../crypto/KeyManager';

/**
 * Account state for balance tracking
 */
export interface AccountState {
    address: string;
    balance: number;
    nonce: number;
    // Transfer tracking for dynamic fees
    incomingTransferCount?: number;  // Incoming transfers in current year
    lastYearReset?: number;          // Timestamp of last annual reset (ms)
}

/**
 * Blockchain state
 */
export interface BlockchainState {
    accounts: Map<string, AccountState>;
    stateRoot: string;
}

/**
 * Core blockchain implementation
 */
import { EventEmitter } from 'events';

/**
 * Core blockchain implementation
 */
export class Blockchain extends EventEmitter {
    private chain: Block[];
    private state: Map<string, AccountState>;
    private genesisValidatorId: string;

    constructor(genesisValidatorId: string) {
        super();
        this.chain = [];
        this.state = new Map();
        this.genesisValidatorId = genesisValidatorId;
        this.initializeGenesis();
    }

    /**
     * Initialize genesis block
     */
    private initializeGenesis(): void {
        // Import network config
        const { getGenesisMetadata } = require('../config/NetworkConfig');
        const networkMetadata = getGenesisMetadata();

        const genesisBlock = Block.createGenesis(this.genesisValidatorId, networkMetadata);
        this.chain.push(genesisBlock);
    }

    /**
     * Get the latest block
     */
    getLatestBlock(): Block {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Get block by index
     */
    getBlockByIndex(index: number): Block | undefined {
        return this.chain[index];
    }

    /**
     * Get block by hash
     */
    getBlockByHash(hash: string): Block | undefined {
        return this.chain.find((block) => block.hash === hash);
    }

    /**
     * Get entire chain
     */
    getChain(): Block[] {
        return [...this.chain];
    }

    /**
     * Get chain length
     */
    getChainLength(): number {
        return this.chain.length;
    }

    /**
     * Add a new block to the chain
     */
    addBlock(
        transactions: Transaction[],
        validatorId: string,
        signature: string
    ): { success: boolean; error?: string; block?: Block } {
        const latestBlock = this.getLatestBlock();
        const newIndex = latestBlock.index + 1;

        // Calculate new state root after applying transactions
        const newStateRoot = this.calculateStateRoot(transactions);

        // Create new block
        const newBlock = Block.create(
            newIndex,
            latestBlock.hash!,
            transactions,
            validatorId,
            newStateRoot
        );

        // Set signature
        newBlock.setSignature(signature);

        // Validate block
        const validation = this.validateBlock(newBlock, latestBlock);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        // Apply transactions to state
        const stateUpdate = this.applyTransactions(transactions, validatorId);
        if (!stateUpdate.success) {
            return { success: false, error: stateUpdate.error };
        }

        // Add block to chain
        this.chain.push(newBlock);

        // Emit event
        this.emit('blockAdded', newBlock);

        return { success: true, block: newBlock };
    }

    /**
     * Validate a block
     */
    validateBlock(
        block: Block,
        previousBlock: Block
    ): { valid: boolean; error?: string } {
        // Validate block structure
        const structureValidation = block.validate();
        if (!structureValidation.valid) {
            return structureValidation;
        }

        // Check index
        if (block.index !== previousBlock.index + 1) {
            return { valid: false, error: 'Invalid block index' };
        }

        // Check previous hash
        if (block.previous_hash !== previousBlock.hash) {
            return { valid: false, error: 'Previous hash mismatch' };
        }

        // Check timestamp (must be after previous block)
        if (block.timestamp <= previousBlock.timestamp) {
            return { valid: false, error: 'Invalid timestamp' };
        }

        // Verify validator signature
        const signableData = block.getSignableData();
        // Note: Actual signature verification would require validator's public key
        // This will be implemented in the consensus module

        return { valid: true };
    }

    /**
     * Validate entire chain
     */
    validateChain(): { valid: boolean; error?: string } {
        // Check genesis block
        if (this.chain.length === 0) {
            return { valid: false, error: 'Empty chain' };
        }

        const genesisBlock = this.chain[0];
        if (genesisBlock.index !== 0) {
            return { valid: false, error: 'Invalid genesis block' };
        }

        // Validate each block
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            const validation = this.validateBlock(currentBlock, previousBlock);
            if (!validation.valid) {
                return {
                    valid: false,
                    error: `Block ${i} validation failed: ${validation.error}`,
                };
            }
        }

        return { valid: true };
    }

    /**
     * Replace chain with a longer valid chain
     */
    replaceChain(newChain: Block[]): { success: boolean; error?: string } {
        if (newChain.length <= this.chain.length) {
            return { success: false, error: 'New chain is not longer' };
        }

        // Validate new chain
        const tempBlockchain = new Blockchain(this.genesisValidatorId);
        tempBlockchain.chain = newChain;

        const validation = tempBlockchain.validateChain();
        if (!validation.valid) {
            return { success: false, error: `Invalid chain: ${validation.error}` };
        }

        // Replace chain and rebuild state
        this.chain = newChain;
        this.rebuildState();

        return { success: true };
    }

    /**
     * Get account balance
     */
    getBalance(address: string): number {
        const account = this.state.get(address);
        return account ? account.balance : 0;
    }

    /**
     * Get account state
     */
    getAccountState(address: string): AccountState | undefined {
        return this.state.get(address);
    }

    /**
     * Get all accounts
     */
    getAllAccounts(): AccountState[] {
        return Array.from(this.state.values());
    }

    /**
     * Calculate state root hash
     */
    private calculateStateRoot(transactions: Transaction[]): string {
        // Create a DEEP copy of current state to avoid modifying the actual state
        // AccountState objects are mutable, so we must clone them
        const tempState = new Map<string, AccountState>();

        for (const [address, account] of this.state.entries()) {
            tempState.set(address, { ...account });
        }

        // Apply transactions to temp state
        for (const tx of transactions) {
            this.applyTransactionToState(tx, tempState);
        }

        // Calculate hash of state
        const stateArray = Array.from(tempState.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([address, account]) => `${address}:${account.balance}:${account.nonce}`);

        const stateString = stateArray.join('|');
        return KeyManager.hash(stateString);
    }

    /**
     * Calculate transfer fee based on recipient's activity and priority
     */
    private calculateTransferFee(recipientAccount: AccountState, amount: number, priority: string = 'STANDARD'): number {
        const { TOKEN_CONFIG } = require('../../economy/TokenConfig');
        const feeConfig = TOKEN_CONFIG.DYNAMIC_TRANSFER_FEES;

        // Determine base fee tier based on recipient's incoming transfer count
        const count = recipientAccount.incomingTransferCount || 0;
        let baseRate = feeConfig.BASE.TIER_0.rate;

        if (count >= feeConfig.BASE.TIER_3.threshold) {
            baseRate = feeConfig.BASE.TIER_3.rate;
        } else if (count >= feeConfig.BASE.TIER_2.threshold) {
            baseRate = feeConfig.BASE.TIER_2.rate;
        } else if (count >= feeConfig.BASE.TIER_1.threshold) {
            baseRate = feeConfig.BASE.TIER_1.rate;
        }

        // Add priority fee
        const priorityRate = feeConfig.PRIORITY[priority] || 0;
        const totalRate = baseRate + priorityRate;

        // Calculate fee
        return Math.ceil(amount * totalRate);
    }

    /**
     * Apply transactions to blockchain state
     */
    private applyTransactions(
        transactions: Transaction[],
        validatorId?: string // Optional for backward compatibility or simulation
    ): { success: boolean; error?: string } {
        for (const tx of transactions) {
            const result = this.applyTransactionToState(tx, this.state, validatorId);
            if (!result.success) {
                return result;
            }
        }
        return { success: true };
    }

    /**
     * Apply single transaction to state
     */
    private applyTransactionToState(
        tx: Transaction,
        state: Map<string, AccountState>,
        validatorId?: string
    ): { success: boolean; error?: string } {
        const fromAccount = state.get(tx.from_wallet) || {
            address: tx.from_wallet,
            balance: 0,
            nonce: 0,
        };

        const toAccount = state.get(tx.to_wallet) || {
            address: tx.to_wallet,
            balance: 0,
            nonce: 0,
        };

        // Handle different transaction types
        switch (tx.type) {
            case 'TRANSFER':
                // Reset recipient's year counter if needed
                const now = Date.now();
                if (!toAccount.lastYearReset || (now - toAccount.lastYearReset) > 365 * 24 * 60 * 60 * 1000) {
                    toAccount.incomingTransferCount = 0;
                    toAccount.lastYearReset = now;
                }

                // Calculate required fee based on recipient's incoming transfer count
                const priority = tx.payload?.priority || 'STANDARD';
                const requiredFee = this.calculateTransferFee(toAccount, tx.amount, priority);

                // Validate fee
                if (tx.fee < requiredFee) {
                    return {
                        success: false,
                        error: `Insufficient fee. Required: ${requiredFee}, Provided: ${tx.fee}`
                    };
                }

                // Check sufficient balance
                const totalCost = tx.amount + tx.fee;
                if (fromAccount.balance < totalCost) {
                    return { success: false, error: 'Insufficient balance' };
                }

                // Deduct from sender
                fromAccount.balance -= totalCost;
                fromAccount.nonce++;

                // Add to receiver
                toAccount.balance += tx.amount;

                // Increment recipient's incoming transfer count
                toAccount.incomingTransferCount = (toAccount.incomingTransferCount || 0) + 1;

                break;

            case 'MESSAGE_PAYMENT':
                // Check sufficient balance
                const messageTotalCost = tx.amount + tx.fee;
                if (fromAccount.balance < messageTotalCost) {
                    return { success: false, error: 'Insufficient balance' };
                }

                // Deduct from sender
                fromAccount.balance -= messageTotalCost;
                fromAccount.nonce++;

                // Add to receiver
                toAccount.balance += tx.amount;

                break;

            case 'REWARD':
                // Rewards are created from nothing (coinbase)
                toAccount.balance += tx.amount;
                break;

            case 'POST_ACTION':
            case 'PROFILE_UPDATE':
            case 'LIKE':
            case 'FOLLOW':
            case 'POST_CONTENT':
            case 'COMMENT':
            case 'SHARE':
            case 'UNFOLLOW':
            case 'PRIVATE_MESSAGE':
                // These may have fees or rewards
                if (tx.fee > 0) {
                    if (fromAccount.balance < tx.fee) {
                        return { success: false, error: 'Insufficient balance for fee' };
                    }
                    fromAccount.balance -= tx.fee;
                    fromAccount.nonce++;
                }

                if (tx.amount > 0) {
                    toAccount.balance += tx.amount;
                }
                break;

            default:
                return { success: false, error: 'Unknown transaction type' };
        }

        // Update state
        state.set(tx.from_wallet, fromAccount);
        state.set(tx.to_wallet, toAccount);

        // Credit fee to validator (Block Producer)
        if (tx.fee > 0 && validatorId) {
            // If validatorId is a wallet address (starts with TRN), credit directly
            // If it's a node ID, we might need a mapping. For now, we assume validatorId IS the wallet address
            // or we fallback to a system address if it's not a valid address format.

            const feeRecipient = validatorId.startsWith('TRN') ? validatorId : 'TREASURY_MAIN';

            const validatorAccount = state.get(feeRecipient) || {
                address: feeRecipient,
                balance: 0,
                nonce: 0,
            };
            validatorAccount.balance += tx.fee;
            state.set(feeRecipient, validatorAccount);
        } else if (tx.fee > 0) {
            // Fallback if no validator specified (e.g. simulation) -> Burn or Treasury
            const treasuryAddress = 'TREASURY_MAIN';
            const treasuryAccount = state.get(treasuryAddress) || {
                address: treasuryAddress,
                balance: 0,
                nonce: 0,
            };
            treasuryAccount.balance += tx.fee;
            state.set(treasuryAddress, treasuryAccount);
        }

        return { success: true };
    }

    /**
     * Rebuild state from chain
     */
    private rebuildState(): void {
        this.state.clear();

        // Replay all transactions
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                this.applyTransactionToState(tx, this.state);
            }
        }
    }

    /**
     * Get blockchain statistics
     */
    getStats(): {
        blockCount: number;
        totalTransactions: number;
        accountCount: number;
        latestBlockHash: string;
        state_root: string;
    } {
        let totalTransactions = 0;
        for (const block of this.chain) {
            totalTransactions += block.transactions.length;
        }

        const latestBlock = this.getLatestBlock();

        return {
            blockCount: this.chain.length,
            totalTransactions,
            accountCount: this.state.size,
            latestBlockHash: latestBlock.hash || '',
            state_root: latestBlock.state_root || '',
        };
    }

    /**
     * Export chain to JSON
     */
    toJSON(): IBlock[] {
        return this.chain.map((block) => block.toJSON());
    }

    /**
     * Import chain from JSON
     */
    static fromJSON(data: IBlock[], genesisValidatorId: string): Blockchain {
        const blockchain = new Blockchain(genesisValidatorId);
        blockchain.chain = data.map((blockData) => new Block(blockData));
        blockchain.rebuildState();
        return blockchain;
    }
}
