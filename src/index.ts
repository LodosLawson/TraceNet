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
import { TreasuryManager } from './economy/TreasuryManager';
import { TokenPriceCalculator } from './economy/PriceCalculator';
import { FeeHandler } from './economy/FeeHandler';
import { EconomyAPI } from './economy/EconomyAPI';
import { TREASURY_ADDRESSES } from './economy/TokenConfig';
import { AuthService } from './services/auth/AuthService';
import { UserService } from './services/user/UserService';

import { ContentService } from './services/ContentService';
import { SocialService } from './services/SocialService';
import { KeyManager } from './blockchain/crypto/KeyManager';
import crypto from 'crypto';
import express from 'express';
import path from 'path';


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
    private treasuryManager: TreasuryManager;
    private priceCalculator: TokenPriceCalculator;
    private feeHandler: FeeHandler;
    private economyAPI: EconomyAPI;
    private authService: AuthService;
    private userService: UserService;
    private contentService: ContentService;
    private socialService: SocialService;

    constructor() {
        console.log('Initializing Blockchain Node...');

        // Initialize core components IN ORDER with correct parameters
        const genesisValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        this.blockchain = new Blockchain(genesisValidatorId);

        const maxMempoolSize = parseInt(process.env.MAX_MEMPOOL_SIZE || '10000', 10);
        const mempoolExpiration = parseInt(process.env.MEMPOOL_EXPIRATION_MS || '3600000', 10);
        this.mempool = new Mempool(maxMempoolSize, mempoolExpiration);

        const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.walletService = new WalletService(encryptionKey);

        const airdropAmount = parseInt(process.env.AIRDROP_AMOUNT || '625000', 10);
        const systemWalletId = 'SYSTEM';
        this.airdropService = new AirdropService(airdropAmount, systemWalletId);

        this.validatorPool = new ValidatorPool();

        // Register system validator
        const systemValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        // In a real setup, we would load keys from secure storage. For dev/test, we generate a deterministic one or random.
        // For now, let's generate a random one to ensure it works.
        const sysKeyPair = KeyManager.generateKeyPair();
        const sysUserId = 'system_user';
        this.validatorPool.registerValidator(systemValidatorId, sysUserId, sysKeyPair.publicKey);
        this.validatorPool.setOnline(systemValidatorId);
        console.log(`System Validator registered and online: ${systemValidatorId}`);

        // Keep system validator online
        setInterval(() => {
            this.validatorPool.updateHeartbeat(systemValidatorId);
        }, 10000);

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
            blockReward: parseInt(process.env.BLOCK_REWARD || '0', 10), // Disabled - only airdrops count
            signatureReward: parseInt(process.env.SIGNATURE_REWARD || '0', 10), // Disabled
            feeDistributionPercent: parseInt(process.env.FEE_DISTRIBUTION_PERCENT || '80', 10),
        };
        this.rewardDistributor = new RewardDistributor(this.blockchain, rewardConfig);

        // Initialize economy modules
        this.treasuryManager = new TreasuryManager(TREASURY_ADDRESSES.main);
        this.priceCalculator = new TokenPriceCalculator();
        this.feeHandler = new FeeHandler(this.treasuryManager);
        this.economyAPI = new EconomyAPI(
            this.priceCalculator,
            this.treasuryManager,
            this.feeHandler
        );

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

        // Initialize auth service
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
        this.authService = new AuthService(jwtSecret);

        // Initialize user service (no auth service needed - no passwords!)
        this.userService = new UserService(this.walletService, this.airdropService);
        this.rpcServer.setUserService(this.userService);

        // Initialize content service
        this.contentService = new ContentService(this.blockchain, this.mempool);
        this.contentService.setUserService(this.userService);
        this.rpcServer.setContentService(this.contentService);

        // Initialize social service
        this.socialService = new SocialService(this.blockchain, this.mempool);
        this.socialService.setContentService(this.contentService);
        this.rpcServer.setSocialService(this.socialService);

        // Inject BlockProducer into RPCServer for manual mining
        this.rpcServer.setBlockProducer(this.blockProducer);

        // Add economy API routes
        this.rpcServer.getApp().use('/economy', this.economyAPI.getRouter());

        // Setup Express app for static files and clean URLs
        const app = this.rpcServer.getApp();

        // Serve static files from public directory
        app.use(express.static(path.join(__dirname, '../public')));

        // Clean URL routes (without .html extension)
        app.get('/explorer', (req: any, res: any) => {
            res.sendFile(path.join(__dirname, '../public/explorer.html'));
        });

        app.get('/examples', (req: any, res: any) => {
            res.sendFile(path.join(__dirname, '../public/examples.html'));
        });

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

            // Distribute rewards (system transactions, not added to mempool)
            const blockRewards = this.rewardDistributor.distributeBlockReward(
                data.block.index,
                data.producer
            );

            // Note: Reward transactions are NOT added to mempool
            // They are system-generated and should not trigger new blocks

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

            // Distribute signature rewards (system transactions, not added to mempool)
            const validators = data.transaction.signatures.map((s: any) => s.validator_id);
            const signatureRewards = this.rewardDistributor.distributeSignatureRewards(
                this.blockchain.getLatestBlock().index + 1,
                validators
            );

            // Note: Signature reward transactions are NOT added to mempool
            // They are system-generated and should not trigger new blocks
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

        //  Verify system validator is online before starting block production
        const systemValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        const systemValidator = this.validatorPool.getValidator(systemValidatorId);

        if (!systemValidator) {
            console.error(`❌ CRITICAL: System validator '${systemValidatorId}' not found!`);
            console.error('Block production cannot start without a validator.');
        } else if (!systemValidator.is_online) {
            console.warn(`⚠️  WARNING: System validator '${systemValidatorId}' registered but not online`);
            console.warn('Setting validator online now...');
            this.validatorPool.setOnline(systemValidatorId);
        } else {
            console.log(`✅ System validator '${systemValidatorId}' is ready and online`);
        }

        // Start block production
        this.blockProducer.start();

        // Start HTTP server (includes RPC and WebSocket)
        const port = parseInt(process.env.PORT || '3000', 10);
        const host = '0.0.0.0'; // Bind to all interfaces for Cloud Run

        this.httpServer.listen(port, host, () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 TraceNet Blockchain Node Started`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📡 RPC Server: http://${host}:${port}`);
            console.log(`🔌 WebSocket: ws://${host}:${port}`);
            console.log(`⛓️  Genesis Block: ${this.blockchain.getLatestBlock().hash}`);
            console.log(`🔐 Token: ${process.env.TOKEN_SYMBOL || 'TRN'}`);
            console.log(`💰 Airdrop Amount: ${this.airdropService['airdropAmount']} (${process.env.TOKEN_DECIMALS || 8} decimals)`);
            console.log(`⏱️  Block Time: ${process.env.BLOCK_TIME_MS || 5000}ms`);
            console.log(`👥 Validator Threshold: ${process.env.VALIDATOR_THRESHOLD_PERCENT || 66}%`);
            console.log(`${'='.repeat(60)}\n`);
            console.log(`✅ Server is ready to accept connections on port ${port}`);
        });

        // Handle server errors
        this.httpServer.on('error', (error: any) => {
            console.error('❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
                process.exit(1);
            }
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
