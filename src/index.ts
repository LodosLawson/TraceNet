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
import { LocalDatabase } from './database/LocalDatabase';
import { P2PNetwork } from './node/P2PNetwork';
import { AutoUpdater } from './node/AutoUpdater';
import { CloudStorageBackup } from './database/CloudStorageBackup';
import { getBootstrapNodes } from './config/BootstrapNodes';
import { IMMUTABLE_CONSENSUS_RULES } from './config/ConsensusRules';


// Load environment variables
dotenv.config();

/**
 * Main blockchain node application
 */
class BlockchainNode {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private messagePool: any; // Type strictly in real implementation
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
    private localDb: LocalDatabase;
    private p2pNetwork: P2PNetwork;
    private autoUpdater: AutoUpdater;
    private cloudBackup: CloudStorageBackup;

    constructor() {
        console.log('[Startup] Initializing Blockchain Node...');
        console.log('[Startup] Environment:', {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            MAX_MEMPOOL_SIZE: process.env.MAX_MEMPOOL_SIZE
        });
        console.log('[Consensus] Immutable Rules:', {
            BLOCK_TIME: IMMUTABLE_CONSENSUS_RULES.BLOCK_TIME_MS + 'ms',
            MAX_BLOCK_SIZE: IMMUTABLE_CONSENSUS_RULES.MAX_BLOCK_SIZE + ' bytes',
            NETWORK_VERSION: IMMUTABLE_CONSENSUS_RULES.NETWORK_VERSION
        });

        // Initialize core components IN ORDER with correct parameters
        const maxMempoolSize = parseInt(process.env.MAX_MEMPOOL_SIZE || '10000', 10);
        const mempoolExpiration = parseInt(process.env.MEMPOOL_EXPIRATION_MS || '3600000', 10);
        this.mempool = new Mempool(maxMempoolSize, mempoolExpiration);

        // Initialize MessagePool
        // Import must be at top, using require here for simplicity in this edit block or I should add import
        const { MessagePool } = require('./node/MessagePool');
        this.messagePool = new MessagePool();

        const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.walletService = new WalletService(encryptionKey);

        // AirdropService initialized later after Blockchain
        const systemWalletId = 'SYSTEM';

        this.validatorPool = new ValidatorPool();

        // Register system validator
        const systemValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';

        // CRITICAL SECURITY: Validator key validation
        const sysPrivateKey = process.env.VALIDATOR_PRIVATE_KEY;
        if (!sysPrivateKey && process.env.NODE_ENV === 'production') {
            throw new Error('SECURITY ERROR: VALIDATOR_PRIVATE_KEY must be set in production!');
        }

        // Use a consistent private key for the System Validator so all nodes agree on signatures
        // Default key is ONLY for development
        const defaultSystemKey = '0000000000000000000000000000000000000000000000000000000000000001';
        const validatorKey = sysPrivateKey || defaultSystemKey;

        const sysKeyPair = KeyManager.getKeyPairFromPrivate(validatorKey);
        const sysUserId = 'system_user';

        this.validatorPool.registerValidator(systemValidatorId, sysUserId, sysKeyPair.publicKey);
        this.validatorPool.setOnline(systemValidatorId);
        console.log(`System Validator registered: ${systemValidatorId} (Public Key: ${sysKeyPair.publicKey.substring(0, 10)}...)`);

        // Initialize core components IN ORDER with correct parameters
        const genesisValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        this.blockchain = new Blockchain(genesisValidatorId, this.validatorPool);

        // Initialize Local Database and Restore Chain
        // Initialize Local Database (Moved to start())
        // this.localDb = new LocalDatabase();

        // Chain loading/restoration moved to start() for async support

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
        // Register local system validator key for signing
        this.blockProducer.registerLocalValidator(systemValidatorId, sysKeyPair.privateKey);

        // Initialize AirdropService with Blockchain and System Keys
        const airdropAmount = parseInt(process.env.AIRDROP_AMOUNT || '625000', 10);
        this.airdropService = new AirdropService(
            airdropAmount,
            systemWalletId,
            this.blockchain,
            { publicKey: sysKeyPair.publicKey, privateKey: sysKeyPair.privateKey }
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
            this.messagePool,
            this.walletService,
            this.validatorPool,
            port
        );

        // Create HTTP server for WebSocket
        this.httpServer = http.createServer(this.rpcServer.getApp());

        // SECURITY: Initialize rate limiter for DOS protection
        // 100 requests per minute per IP
        const { RateLimiter } = require('./middleware/RateLimiter');
        const rateLimiter = new RateLimiter(60000, 100);
        this.rpcServer.getApp().use('/api', rateLimiter.middleware());
        this.rpcServer.getApp().use('/rpc', rateLimiter.middleware());

        // CRITICAL SECURITY: JWT Secret validation
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret && process.env.NODE_ENV === 'production') {
            throw new Error('SECURITY ERROR: JWT_SECRET must be set in production!');
        }
        if (jwtSecret && jwtSecret.length < 32) {
            throw new Error('SECURITY ERROR: JWT_SECRET must be at least 32 characters');
        }
        const safeJwtSecret = jwtSecret || 'dev-random-' + Math.random().toString(36);
        this.authService = new AuthService(safeJwtSecret);

        // Initialize user service (no auth service needed - no passwords!)
        this.userService = new UserService(this.walletService, this.airdropService, this.mempool);
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

        // Initialize P2P Network
        this.p2pNetwork = new P2PNetwork(
            this.blockchain,
            this.mempool,
            this.validatorPool,
            this.wsServer.getIO(),
            port
        );

        // Connect to peers from env
        if (process.env.PEERS) {
            const peers = process.env.PEERS.split(',');
            for (const peer of peers) {
                if (peer.trim()) {
                    this.p2pNetwork.connectToPeer(peer.trim());
                }
            }
        }

        // Auto-connect to bootstrap nodes (if not already in PEERS)
        const bootstrapNodes = getBootstrapNodes(process.env.PUBLIC_HOST);
        console.log('[P2P] Auto-connecting to bootstrap nodes:', bootstrapNodes);
        for (const node of bootstrapNodes) {
            this.p2pNetwork.connectToPeer(node);
        }

        // Connect RPC to P2P
        this.rpcServer.setP2PNetwork(this.p2pNetwork);

        // Initialize Auto Updater
        this.autoUpdater = new AutoUpdater();
        this.autoUpdater.start();

        // Initialize Cloud Storage Backup
        this.cloudBackup = new CloudStorageBackup();

        // Setup Event Handlers (Moved to start())
        // this.setupEventHandlers();

        console.log('Blockchain Node initialized successfully');
    }

    /**
     * Setup event handlers between components
     */
    private setupEventHandlers(): void {
        // Handle new blocks
        this.blockProducer.on('newBlock', (data: any) => {
            console.log(`New block produced: ${data.block.index}`);

            // Persist chain to local database
            // Note: In production we'd append, but for prototype saving full chain is safer/easier
            this.localDb.saveChain(this.blockchain.getChain()).catch(console.error);

            // ✅ NEW: Auto-backup to Google Cloud Storage (Cloud Run persistence)
            this.cloudBackup.backup(this.blockchain.getChain()).catch((err) => {
                console.warn('[GCS] Backup failed (non-critical):', err.message);
            });

            // Broadcast via WebSocket
            this.wsServer.broadcastNewBlock(data.block, data.producer, data.transaction_count);

            // Broadcast via P2P
            this.p2pNetwork.broadcastBlock(data.block);

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
    async start(): Promise<void> {
        console.log('Starting Blockchain Node...');

        // 1. Start HTTP Server IMMEDIATELY to pass Cloud Run health checks
        // We bind early, even if chain is not fully loaded yet.
        const port = parseInt(process.env.PORT || '3000', 10);
        const host = '0.0.0.0'; // Bind to all interfaces for Cloud Run

        this.httpServer.listen(port, host, () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 TraceNet Blockchain Node V2.5 Started`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📡 RPC Server: http://${host}:${port}`);
            console.log(`🔌 WebSocket: ws://${host}:${port}`);
            if (process.env.PUBLIC_HOST) {
                console.log(`🌍 Public Host: ${process.env.PUBLIC_HOST}`);
            }
            console.log(`🔗 P2P Network: Active (Max Peers: 50)`);
            console.log(`🔐 Token: ${process.env.TOKEN_SYMBOL || 'TNN'}`);
            console.log(`⏱️  Block Time: ${process.env.BLOCK_TIME_MS || 5000}ms`);
            console.log(`${'='.repeat(60)}\n`);
            console.log(`✅ Server is ready to accept connections on port ${port}`);

            // Start Auto-Miner if needed (will check validator status internally)
            this.rpcServer.startAutoMiner();
        });

        // Handle server errors
        this.httpServer.on('error', (error: any) => {
            console.error('❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
                process.exit(1);
            }
        });

        // 2. Initialize DB and Restore chain (Async)
        console.log('[Startup] Initializing Database...');
        try {
            // Initialize Local Database here to protect against crashes
            this.localDb = new LocalDatabase();

            // Setup consumers/producers once DB is potentially ready (or at least mapped)
            this.setupEventHandlers();

            console.log('[Startup] Loading chain from database...');
            // Race between DB load and 5-second timeout
            const dbLoadPromise = this.localDb.loadChain();
            const timeoutPromise = new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error('Database load timed out')), 5000)
            );

            const savedChain = await Promise.race([dbLoadPromise, timeoutPromise]);

            console.log('[Startup] Database load complete.');

            // Try GCS restore first (Cloud Run)
            console.log('[GCS] Checking for cloud backup...');
            const gcsChain = await this.cloudBackup.restore();

            if (gcsChain && gcsChain.length > savedChain.length) {
                console.log(`[GCS] ✅ Restoring from cloud: ${gcsChain.length} blocks`);
                const success = this.blockchain.restoreChain(gcsChain);
                if (success) {
                    console.log(`⛓️  Chain restored from GCS`);
                } else {
                    console.error('[GCS] Failed to restore from cloud, using local DB');
                }
            } else if (savedChain && savedChain.length > 0) {
                console.log(`[Persistence] Found saved chain with ${savedChain.length} blocks.`);
                const success = this.blockchain.restoreChain(savedChain);
                if (success) {
                    console.log('[Persistence] Chain successfully restored to height', this.blockchain.getChainLength());
                } else {
                    console.warn('[Persistence] Failed to restore chain. Starting from Genesis.');
                }
            } else {
                console.log('[Persistence] No saved chain found. Starting fresh.');
            }
        } catch (error) {
            console.error('⚠️ [Startup] Database load failed or timed out:', error);
            console.warn('⚠️ [Startup] Starting with EMPTY chain. Node will sync from peers.');
        }

        //  Verify system validator is online before starting block production
        const systemValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        const systemValidator = this.validatorPool.getValidator(systemValidatorId);

        if (!systemValidator) {
            console.error(`❌ CRITICAL: System validator '${systemValidatorId}' not found!`);
        } else if (!systemValidator.is_online) {
            console.warn(`⚠️  WARNING: System validator '${systemValidatorId}' registered but not online`);
            console.warn('Setting validator online now...');
            this.validatorPool.setOnline(systemValidatorId);
        } else {
            console.log(`✅ System validator '${systemValidatorId}' is ready and online`);
        }

        // Start block production
        this.blockProducer.start();

        // Check if genesis block info can be logged now or needs delay (safe to log simplified)
        console.log(`⛓️  Genesis Block Hash: ${this.blockchain.getLatestBlock().hash.substring(0, 16)}...`);

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
// Start the node if this is the main module
if (require.main === module) {
    // Global error handlers to prevent crash without logging
    process.on('uncaughtException', (err) => {
        console.error('❌ FATAL UNCAUGHT EXCEPTION:', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ FATAL UNHANDLED REJECTION:', reason);
    });

    try {
        console.log('[Boot] Process starting...');
        const node = new BlockchainNode();
        node.start().catch(err => {
            console.error('❌ CRITICAL: Failed to start Blockchain Node:', err);
            process.exit(1);
        });

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
    } catch (error) {
        console.error('❌ CRITICAL: Error during node initialization:', error);
        process.exit(1);
    }
}

export default BlockchainNode;
