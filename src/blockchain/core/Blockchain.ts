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

    // ... (existing methods)

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
        const stateUpdate = this.applyTransactions(transactions);
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
     * Calculate state root hash
     */
    private calculateStateRoot(transactions: Transaction[]): string {
        // Create a copy of current state
        const tempState = new Map(this.state);

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
     * Apply transactions to blockchain state
     */
    private applyTransactions(
        transactions: Transaction[]
    ): { success: boolean; error?: string } {
        for (const tx of transactions) {
            const result = this.applyTransactionToState(tx, this.state);
            if (!result.success) {
                return result;
            }
        }

        return { success: true };
    }

    /**
     * Apply a single transaction to state
     */
    private applyTransactionToState(
        tx: Transaction,
        state: Map<string, AccountState>
    ): { success: boolean; error?: string } {
        // Get or create accounts
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
            case 'MESSAGE_PAYMENT':
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

                break;

            case 'REWARD':
                // Rewards are created from nothing (coinbase)
                toAccount.balance += tx.amount;
                break;

            case 'POST_ACTION':
            case 'PROFILE_UPDATE':
            case 'LIKE':
            case 'FOLLOW':
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
    } {
        let totalTransactions = 0;
        for (const block of this.chain) {
            totalTransactions += block.transactions.length;
        }

        return {
            blockCount: this.chain.length,
            totalTransactions,
            accountCount: this.state.size,
            latestBlockHash: this.getLatestBlock().hash || '',
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
