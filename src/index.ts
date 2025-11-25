import dotenv from 'dotenv';
import http from 'http';
import { Blockchain } from './blockchain/core/Blockchain';
import { Mempool } from './node/Mempool';
import { WalletService } from './wallet/WalletService';
import { AirdropService } from './wallet/AirdropService';
import { ValidatorPool } from './consensus/ValidatorPool';
import { SignatureCoordinator } from './consensus/SignatureCoordinator';
import { BlockProducer } from './consensus/BlockProducer';
import { RewardDistributor, RewardConfig } from './consensus/RewardDistributor';
import { RPCServer } from './node/RPCServer';
import { WebSocketServer } from './node/WebSocketServer';

// Load environment variables
dotenv.config();

/**
 * Main blockchain node application
 */
class BlockchainNode {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private walletService: WalletService;
    private airdropService: AirdropService;
    private validatorPool: ValidatorPool;
    private signatureCoordinator: SignatureCoordinator;
    private blockProducer: BlockProducer;
    private rewardDistributor: RewardDistributor;
    private rpcServer: RPCServer;
    private wsServer: WebSocketServer;
    private httpServer: http.Server;

    constructor() {
        console.log('Initializing Blockchain Node...');

        // Initialize core components
        const genesisValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        this.blockchain = new Blockchain(genesisValidatorId);

        const maxMempoolSize = parseInt(process.env.MAX_MEMPOOL_SIZE || '10000', 10);
        this.mempool = new Mempool(maxMempoolSize);

        const encryptionKey = process.env.ENCRYPTION_KEY || 'default_encryption_key_change_in_production';
        this.walletService = new WalletService(encryptionKey);

        const airdropAmount = parseInt(process.env.INITIAL_AIRDROP_AMOUNT || '10000000000', 10);
        this.airdropService = new AirdropService(airdropAmount);

        const validatorOfflineTimeout = parseInt(process.env.VALIDATOR_OFFLINE_TIMEOUT || '60000', 10);
        this.validatorPool = new ValidatorPool(validatorOfflineTimeout);

        const thresholdPercent = parseInt(process.env.VALIDATOR_THRESHOLD_PERCENT || '66', 10);
        const validatorsPerTx = parseInt(process.env.VALIDATORS_PER_TRANSACTION || '7', 10);
        const signatureTimeout = parseInt(process.env.SIGNATURE_TIMEOUT_MS || '5000', 10);
        this.signatureCoordinator = new SignatureCoordinator(
            this.validatorPool,
            thresholdPercent,
            validatorsPerTx,
            signatureTimeout
        );

        const blockTime = parseInt(process.env.BLOCK_TIME_MS || '5000', 10);
        const maxTxPerBlock = parseInt(process.env.MAX_TRANSACTIONS_PER_BLOCK || '1000', 10);
        this.blockProducer = new BlockProducer(
            this.blockchain,
            this.validatorPool,
            this.mempool,
            blockTime,
            maxTxPerBlock
        );

        const rewardConfig: RewardConfig = {
            blockReward: parseInt(process.env.BLOCK_REWARD || '5000000000', 10),
            signatureReward: parseInt(process.env.SIGNATURE_REWARD || '100000000', 10),
            feeDistributionPercent: parseInt(process.env.FEE_DISTRIBUTION_PERCENT || '80', 10),
        };
        this.rewardDistributor = new RewardDistributor(this.blockchain, rewardConfig);

        const port = parseInt(process.env.PORT || '3000', 10);
        this.rpcServer = new RPCServer(
            this.blockchain,
            this.mempool,
            this.walletService,
            this.validatorPool,
            port
        );

        // Create HTTP server for WebSocket
        this.httpServer = http.createServer(this.rpcServer.getApp());

        this.wsServer = new WebSocketServer(
            this.httpServer,
            this.blockchain,
            this.mempool,
            this.validatorPool
        );

        this.setupEventHandlers();

        console.log('Blockchain Node initialized successfully');
    }

    /**
     * Setup event handlers between components
     */
    private setupEventHandlers(): void {
        // Handle new blocks
        this.blockProducer.on('newBlock', (data: any) => {
            console.log(`New block produced: ${data.block.index}`);

            // Broadcast via WebSocket
            this.wsServer.broadcastNewBlock(data.block, data.producer, data.transaction_count);

            // Distribute rewards
            const blockRewards = this.rewardDistributor.distributeBlockReward(
                data.block.index,
                data.producer
            );

            // Add reward transactions to mempool
            for (const rewardTx of blockRewards) {
                this.mempool.addTransaction(rewardTx.toJSON());
            }

            // Broadcast transaction confirmations
            for (const tx of data.block.transactions) {
                this.wsServer.broadcastTxConfirmed(tx.tx_id, data.block.index, data.block.hash);
            }
        });

        // Handle signature requests
        this.signatureCoordinator.on('signRequest', (data: any) => {
            this.wsServer.sendSignRequest([data.validator_id], data.tx_id, data.transaction);
        });

        // Handle signature completion
        this.signatureCoordinator.on('signatureComplete', (data: any) => {
            console.log(`Signatures collected for tx ${data.tx_id}: ${data.signature_count}`);

            // Distribute signature rewards
            const validators = data.transaction.signatures.map((s: any) => s.validator_id);
            const signatureRewards = this.rewardDistributor.distributeSignatureRewards(
                this.blockchain.getLatestBlock().index + 1,
                validators
            );

            // Add reward transactions to mempool
            for (const rewardTx of signatureRewards) {
                this.mempool.addTransaction(rewardTx.toJSON());
                this.wsServer.broadcastRewardPaid(
                    rewardTx.to_wallet,
                    rewardTx.amount,
                    'signature',
                    rewardTx.tx_id
                );
            }
        });

        // Handle signature timeout
        this.signatureCoordinator.on('signatureTimeout', (data: any) => {
            console.warn(`Signature timeout for tx ${data.tx_id}: ${data.collected}/${data.required}`);
        });

        // Handle wallet creation for airdrop
        // This would be triggered by the wallet service in a real implementation
    }

    /**
     * Start the blockchain node
     */
    start(): void {
        console.log('Starting Blockchain Node...');

        // Start block production
        this.blockProducer.start();

        // Start HTTP server (includes RPC and WebSocket)
        const port = parseInt(process.env.PORT || '3000', 10);
        this.httpServer.listen(port, () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 TraceNet Blockchain Node Started`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📡 RPC Server: http://localhost:${port}`);
            console.log(`🔌 WebSocket: ws://localhost:${port}`);
            console.log(`⛓️  Genesis Block: ${this.blockchain.getLatestBlock().hash}`);
            console.log(`🔐 Token: ${process.env.TOKEN_SYMBOL || 'TRN'}`);
            console.log(`💰 Airdrop Amount: ${this.airdropService['airdropAmount']} (${process.env.TOKEN_DECIMALS || 8} decimals)`);
            console.log(`⏱️  Block Time: ${process.env.BLOCK_TIME_MS || 5000}ms`);
            console.log(`👥 Validator Threshold: ${process.env.VALIDATOR_THRESHOLD_PERCENT || 66}%`);
            console.log(`${'='.repeat(60)}\n`);
        });

        // Periodic cleanup
        setInterval(() => {
            this.mempool.clearExpired();
            this.signatureCoordinator.clearOldCollections();
        }, 60000); // Every minute
    }

    /**
     * Stop the blockchain node
     */
    stop(): void {
        console.log('Stopping Blockchain Node...');

        this.blockProducer.stop();
        this.httpServer.close();

        console.log('Blockchain Node stopped');
    }

    /**
     * Get node statistics
     */
    getStats(): any {
        return {
            blockchain: this.blockchain.getStats(),
            mempool: this.mempool.getStats(),
            validators: this.validatorPool.getStats(),
            blockProducer: this.blockProducer.getStats(),
            rewards: this.rewardDistributor.getStats(),
            websocket: this.wsServer.getStats(),
        };
    }
}

// Start the node if this is the main module
if (require.main === module) {
    const node = new BlockchainNode();
    node.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        node.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        node.stop();
        process.exit(0);
    });
}

export default BlockchainNode;
