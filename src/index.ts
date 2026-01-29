import dotenv from 'dotenv';
import http from 'http';
import { Blockchain } from './blockchain/core/Blockchain';
import { Mempool } from './node/Mempool';
import { SocialPool } from './node/SocialPool';
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
import fs from 'fs';
import { LocalDatabase } from './database/LocalDatabase';
import { P2PNetwork } from './node/P2PNetwork';
import { AutoUpdater } from './node/AutoUpdater';
import { CloudStorageBackup } from './database/CloudStorageBackup';
import { getBootstrapNodes } from './config/BootstrapNodes';
import { IMMUTABLE_CONSENSUS_RULES } from './config/ConsensusRules';
import { Block } from './blockchain/models/Block';


import { NETWORK_CONFIG } from './blockchain/config/NetworkConfig';

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
    private socialPool: SocialPool;

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

        // Initialize SocialPool - MOVED DOWN
        // this.socialPool = new SocialPool(this.mempool);

        // Initialize MessagePool
        // Import must be at top, using require here for simplicity in this edit block or I should add import
        const { MessagePool } = require('./node/MessagePool');
        this.messagePool = new MessagePool();

        // 🔐 SECURITY: Load keys from Encrypted KeyStore
        const { KeyStore } = require('./blockchain/utils/KeyStore');
        const { SecureLogger } = require('./utils/SecureLogger'); // Import SecureLogger
        const keyStore = new KeyStore();

        // System Validator Setup
        const systemValidatorId = process.env.GENESIS_VALIDATOR_ID || 'SYSTEM';
        const GENESIS_VALIDATOR_PUBLIC_KEY = '25b86a85774d69db8af2a782f7fbf9c062054c48d4c2c3fac9ec4b10c54f43d7'; // Hardcoded for security

        // NODE ROLE CONFIGURATION
        const nodeRole = process.env.NODE_ROLE || 'full'; // 'full' | 'validator'
        SecureLogger.log(`[Config] Node Role: ${nodeRole.toUpperCase()}`);

        // 🔐 INTERACTIVE PASSWORD PROMPT (Production)
        let keystorePassword = process.env.KEYSTORE_PASSWORD;
        if (!keystorePassword && process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: KEYSTORE_PASSWORD missing in production!');
            console.warn('⚠️  Generating a temporary random password for this session.');
            console.warn('⚠️  Wallet keys saved this session will be LOST on restart unless you save them manually.');
            keystorePassword = crypto.randomBytes(32).toString('hex');
            // process.exit(1); // REMOVED: Allow startup for debugging
        }

        // Attempt to load private key from KeyStore first
        let sysPrivateKey = keyStore.loadKey('validator_key', keystorePassword || '');
        let myValidatorPublicKey: string | undefined;

        // Compatibility/Migration: Check env if not in KeyStore (Dev only)
        // Compatibility/Migration: Check env if not in KeyStore
        // MODIFICATION: Allow Env Var fallback in Production because Cloud Run may not have secrets/keystore.json (gitignored)
        if (!sysPrivateKey) {
            const rawSysKey = process.env.VALIDATOR_PRIVATE_KEY;
            if (rawSysKey) {
                try {
                    // Normalize to full 64-byte secret key
                    const keyPair = KeyManager.getKeyPairFromPrivate(rawSysKey);
                    sysPrivateKey = keyPair.privateKey;

                    if (process.env.NODE_ENV !== 'production') {
                        console.warn('[Security] ⚠️  Loaded validator key from .env (unsafe for production). Please migrate to KeyStore.');
                    } else {
                        console.log('[Security] ℹ️  Loaded validator key from Environment Variable (Cloud Run Mode).');
                    }
                } catch (err) {
                    console.error('[Config] ❌ Failed to load VALIDATOR_PRIVATE_KEY from env:', err);
                }
            }
        }

        if (nodeRole === 'validator' && !sysPrivateKey) {
            console.error('[Configuration] ❌ NODE_ROLE is set to validator, but no private key found!');
            if (process.env.NODE_ENV === 'production') {
                console.warn('[Configuration] ⚠️  Downgrading to READ-ONLY FULL NODE due to missing private key.');
            }
        }

        if (!sysPrivateKey && process.env.NODE_ENV === 'production') {
            SecureLogger.log('[Security] No validator private key found. Running as READ-ONLY Full Node.');
        }

        const sysUserId = 'system_user';
        this.validatorPool = new ValidatorPool();

        // 1. Register Genesis Validator (Public Spec)
        // Every node must know about the genesis validator to validate early blocks
        // 1. Register All Initial Validators (Public Spec)
        // This includes Genesis Validator AND any other whitelisted validators (like the User's Home Node)
        if (NETWORK_CONFIG.initialValidators) {
            NETWORK_CONFIG.initialValidators.forEach((pubKey, index) => {
                let vId = 'validator_' + pubKey.substring(0, 8);
                let uId = `initial_validator_${index}`;

                // Special case for Genesis Validator to keep ID consistent if needed
                if (pubKey === GENESIS_VALIDATOR_PUBLIC_KEY) {
                    vId = systemValidatorId;
                    uId = sysUserId;
                }

                this.validatorPool.registerValidator(vId, uId, pubKey);
                console.log(`[Consensus] 📜 Registered Initial Validator: ${vId}`);
            });
        } else {
            // Fallback for older configs
            this.validatorPool.registerValidator(systemValidatorId, sysUserId, GENESIS_VALIDATOR_PUBLIC_KEY);
        }

        // 2. Set Online Status CORRECTLY
        // Only set online if WE are that validator (have the private key)
        let myValidatorId = null;



        // Initialize core components IN ORDER with correct parameters
        this.blockchain = new Blockchain(systemValidatorId, this.validatorPool);

        const thresholdPercent = parseInt(process.env.VALIDATOR_THRESHOLD_PERCENT || '66', 10);
        const validatorsPerTx = parseInt(process.env.VALIDATORS_PER_TRANSACTION || '7', 10);
        const signatureTimeout = parseInt(process.env.SIGNATURE_TIMEOUT_MS || '5000', 10);
        this.signatureCoordinator = new SignatureCoordinator(
            this.validatorPool,
            thresholdPercent,
            validatorsPerTx,
            signatureTimeout
        );

        // NODE WALLET AUTOMATION (Secure)
        let nodeWalletPrivateKey = keyStore.loadKey('node_wallet', keystorePassword || '');
        let nodeWalletPublicKey: string;

        if (!nodeWalletPrivateKey) {
            if (process.env.NODE_WALLET_PRIVATE_KEY) {
                // Cloud Run / Env Fallback
                // Cloud Run / Env Fallback
                const rawNodeKey = process.env.NODE_WALLET_PRIVATE_KEY;
                const keyPair = KeyManager.getKeyPairFromPrivate(rawNodeKey);
                nodeWalletPrivateKey = keyPair.privateKey; // FIX: Use full 64-byte key
                nodeWalletPublicKey = keyPair.publicKey;

                if (process.env.NODE_ENV !== 'production') {
                    console.warn('[Security] ⚠️  Loaded node wallet from .env. Please migrate to KeyStore.');
                } else {
                    console.log('[Security] ℹ️  Loaded node wallet from Environment Variable (Cloud Run Mode).');
                }
            } else {
                SecureLogger.log('[Setup] No Node Wallet found. Generating new one...');
                // Use Mnemonic generation to give user access
                const walletData = KeyManager.generateWalletFromMnemonic();
                nodeWalletPrivateKey = walletData.privateKey;
                nodeWalletPublicKey = walletData.publicKey;

                // Save to KeyStore if available
                if (keystorePassword) {
                    keyStore.saveKey('node_wallet', nodeWalletPrivateKey, keystorePassword);
                    SecureLogger.log('[Setup] ✅ Generated and saved new Node Wallet to KeyStore');
                } else {
                    console.warn('[Setup] ⚠️  Generated temporary Node Wallet (No KeyStore password).');
                }

                // SAVE CREDENTIALS TO FILE (For User Access)
                try {
                    const credentials = `
===================================================================
             TRACENET NODE CREDENTIALS (DO NOT SHARE)
===================================================================
Thinking of this as your "Bank Account" for the Node.
These credentials grant full access to the funds earned by this node.

Generated: ${new Date().toISOString()}

ADDRESS:    ${walletData.publicKey}  (Use this to receive funds)
MNEMONIC:   ${walletData.mnemonic}   (12/24 Words - KEEP SAFE!)
PRIVATE KEY:${walletData.privateKey} (For programmatic access)

===================================================================
⚠️  WARNING: ANYONE WITH THIS FILE CAN ACCESS YOUR FUNDS.
    DELETE THIS FILE AFTER BACKING IT UP SECURELY!
===================================================================
`;
                    // Using require('fs') to avoid import issues if not present at top
                    require('fs').writeFileSync('./NODE_CREDENTIALS.txt', credentials);
                    console.log('\n[SECURITY] 🔑 Node credentials saved to NODE_CREDENTIALS.txt');
                    console.log('[SECURITY] ⚠️  PLEASE BACKUP AND DELETE THIS FILE IMMEDIATELY!\n');
                } catch (err) {
                    console.error('[Setup] Failed to save credentials file:', err);
                }
            }
        } else {
            const keyPair = KeyManager.getKeyPairFromPrivate(nodeWalletPrivateKey);
            nodeWalletPublicKey = keyPair.publicKey;
            SecureLogger.log('[Setup] Loaded Node Wallet from KeyStore');
        }

        // Initialize SocialPool (Late Init for Keys)
        this.socialPool = new SocialPool(this.mempool, nodeWalletPrivateKey, nodeWalletPublicKey);

        // ===================================
        // VALIDATOR SELF-REGISTRATION (MOVED)
        // ===================================
        if (!sysPrivateKey && nodeWalletPrivateKey) {
            sysPrivateKey = nodeWalletPrivateKey;
            console.log('[Consensus] 🔗 Using Node Wallet key as Validator Key (First Setup).');
        }

        if (sysPrivateKey) {
            // Check if our key matches Genesis Validator
            try {
                const keyPair = KeyManager.getKeyPairFromPrivate(sysPrivateKey);
                myValidatorPublicKey = keyPair.publicKey;
            } catch (err) {
                console.error('[Consensus] ❌ Invalid Private Key in configuration!');
                myValidatorPublicKey = 'invalid_key';
            }

            if (myValidatorPublicKey === GENESIS_VALIDATOR_PUBLIC_KEY) {
                // We are the System Validator
                myValidatorId = systemValidatorId;
                this.validatorPool.setOnline(systemValidatorId);
                SecureLogger.log(`[Consensus] 👑 We are the Genesis Validator (${systemValidatorId}). Online & Ready.`);
            } else {
                // We are a NEW Validator
                const myId = process.env.VALIDATOR_ID || 'validator_' + myValidatorPublicKey!.substring(0, 8);
                myValidatorId = myId;

                // Register ourselves
                this.validatorPool.registerValidator(myId, 'local_admin', myValidatorPublicKey!);
                this.validatorPool.setOnline(myId);
                SecureLogger.log(`[Consensus] 🛡️  Active Validator Registered: ${myId}`);
            }

            // Keep myself online
            if (myValidatorId) {
                setInterval(() => {
                    const currentHeight = this.blockchain.getLatestBlock().index;
                    this.validatorPool.updateHeartbeat(myValidatorId!, currentHeight);
                }, 10000);
            }
        } else {
            console.log('[Consensus] 👁️  Observer Mode: No validator keys loaded.');
        }

        const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.walletService = new WalletService(encryptionKey);

        SecureLogger.log(`[Setup] 💰 Node Wallet Address: ${nodeWalletPublicKey}`);

        const rewardConfig: RewardConfig = {
            blockReward: parseInt(process.env.BLOCK_REWARD || '0', 10),
            signatureReward: parseInt(process.env.SIGNATURE_REWARD || '0', 10),
            feeDistributionPercent: parseInt(process.env.FEE_DISTRIBUTION_PERCENT || '80', 10),
        };
        this.rewardDistributor = new RewardDistributor(this.blockchain, rewardConfig);

        const blockTime = parseInt(process.env.BLOCK_TIME_MS || '5000', 10);
        const maxTxPerBlock = parseInt(process.env.MAX_TRANSACTIONS_PER_BLOCK || '1000', 10);
        this.blockProducer = new BlockProducer(
            this.blockchain,
            this.validatorPool,
            this.mempool,
            this.rewardDistributor, // Injected dependency (Now initialized!)
            blockTime,
            maxTxPerBlock,
            nodeWalletPublicKey
        );

        // Register local system validator key only if we have it
        // Register local validator key
        if (sysPrivateKey && myValidatorId) {
            this.blockProducer.registerLocalValidator(myValidatorId, sysPrivateKey);
            console.log(`[Consensus] 🔐 Registered private key for BlockProducer: ${myValidatorId}`);
        }

        // Initialize AirdropService
        // ✅ SECURITY FIX: Use Node Wallet key instead of Validator Key for airdrops
        // Validator key should ONLY be used for consensus signatures.
        const systemWalletId = 'SYSTEM';
        const airdropAmount = parseInt(process.env.AIRDROP_AMOUNT || '625000', 10);
        this.airdropService = new AirdropService(
            airdropAmount,
            systemWalletId,
            this.blockchain,
            { publicKey: nodeWalletPublicKey, privateKey: nodeWalletPrivateKey || '' } // Using Node Wallet
        );

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

        // HTTP Server
        this.httpServer = http.createServer(this.rpcServer.getApp());

        // 🛡️ SECURITY MIDDLEWARE

        // 1. Strict CORS
        const cors = require('cors');
        const corsOptions = {
            origin: (origin: any, callback: any) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);

                // CRITICAL: Explicitly allow frontend domains
                const defaultAllowed = [
                    'https://netra.locktraceapp.com',
                    'https://tracenet.locktraceapp.com',
                    'http://localhost:5173',
                    'http://localhost:3000'
                ];

                // Allow if in dev, or explicitly allowed, or configured in env
                const envAllowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];

                if (process.env.NODE_ENV !== 'production' ||
                    envAllowed.includes('*') ||
                    defaultAllowed.includes(origin) ||
                    envAllowed.includes(origin)) {
                    callback(null, true);
                } else {
                    console.warn(`[CORS] Blocked request from: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning'],
            credentials: true,
            maxAge: 86400 // 24 hours
        };
        this.rpcServer.getApp().use(cors(corsOptions));

        // 2. Rate Limiting (Global)
        const { RateLimiter } = require('./middleware/RateLimiter');
        const rateLimiter = new RateLimiter(60000, 100);
        this.rpcServer.getApp().use(rateLimiter.middleware());

        // CRITICAL SECURITY: JWT Secret validation
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret && process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: JWT_SECRET must be set in production!');
            console.warn('⚠️  Using random secret (Auth tokens will be invalid after restart).');
            // throw new Error('SECURITY ERROR: JWT_SECRET must be set in production!'); // REMOVED
        }
        if (jwtSecret && jwtSecret.length < 32 && process.env.NODE_ENV === 'production') {
            throw new Error('SECURITY ERROR: JWT_SECRET must be at least 32 characters');
        }
        const safeJwtSecret = jwtSecret || 'dev-random-' + Math.random().toString(36);
        this.authService = new AuthService(safeJwtSecret);

        // Initialize user service
        this.userService = new UserService(this.walletService, this.airdropService, this.mempool);
        this.rpcServer.setUserService(this.userService);

        // Initialize content service
        this.contentService = new ContentService(this.blockchain, this.mempool);
        this.contentService.setUserService(this.userService);
        this.rpcServer.setContentService(this.contentService);

        // Initialize social service
        this.socialService = new SocialService(this.blockchain, this.mempool, this.socialPool);
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

        // Initialize Peer Store properly
        const { PeerStore } = require('./node/PeerStore');
        const peerStore = new PeerStore();

        // Initialize P2P Network
        this.p2pNetwork = new P2PNetwork(
            this.blockchain,
            this.mempool,
            this.validatorPool,
            this.wsServer.getIO(),
            port,
            this.localDb, // ✅ Inject DB
            peerStore,    // ✅ Inject PeerStore
            myValidatorPublicKey,
            sysPrivateKey
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
        // Initialize Auto Updater (Disable in production for security)
        this.autoUpdater = new AutoUpdater();
        if (process.env.NODE_ENV !== 'production') {
            this.autoUpdater.start();
            console.log('[AutoUpdater] Active (Dev Mode)');
        } else {
            console.log('[AutoUpdater] Disabled (Production Mode)');
        }

        // Initialize Cloud Storage Backup
        this.cloudBackup = new CloudStorageBackup();

        // Setup Event Handlers (Moved to start())
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

            // Persist chain to local database
            this.localDb.saveChain(this.blockchain.getChain()).catch(console.error);

            // ✅ NEW: Auto-backup to Google Cloud Storage (Cloud Run persistence)
            this.cloudBackup.backup(this.blockchain.getChain()).catch((err: any) => {
                console.warn('[GCS] Backup failed (non-critical):', err.message);
            });

            // Broadcast via WebSocket
            this.wsServer.broadcastNewBlock(data.block, data.producer, data.transaction_count);

            // Broadcast via P2P
            this.p2pNetwork.broadcastBlock(data.block);

            // ✅ Update UserService with new block
            this.userService.processBlock(data.block);

            // Distribute rewards (system transactions)
            const blockRewards = this.rewardDistributor.distributeBlockReward(
                data.block.index,
                data.producer
            );

            // Broadcast transaction confirmations
            for (const tx of data.block.transactions) {
                this.wsServer.broadcastTxConfirmed(tx.tx_id, data.block.index, data.block.hash);
            }
        });

        // --- CONSENSUS EVENTS ---

        // 1. Handle Block Proposal (Producer -> Network)
        this.blockProducer.on('blockProposed', (block: Block) => {
            this.p2pNetwork.broadcastProposal(block);
        });

        // 2. Handle Signature Reception (Network -> Producer)
        this.p2pNetwork.on('blockSignatureReceived', (data: any) => {
            this.blockProducer.addSignature(data.validatorId, data.signature);
        });

        // Handle signature requests (Old Logic? Or kept for InnerTransaction?)
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
            console.log(`🔐 Token: ${NETWORK_CONFIG.tokenSymbol} (${process.env.TOKEN_SYMBOL || 'Default'})`);
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

            if (gcsChain && gcsChain.length > (savedChain ? savedChain.length : 0)) {
                // GENESIS HASH CHECK FOR GCS
                const loadedGenesisHash = gcsChain[0].hash;
                const currentGenesisHash = this.blockchain.getChain()[0].hash;

                if (loadedGenesisHash !== currentGenesisHash) {
                    console.error('🚨 [GCS] Genesis Hash Mismatch in Cloud Backup!');
                    console.error(`   Expected: ${currentGenesisHash}`);
                    console.error(`   Found:    ${loadedGenesisHash}`);
                    console.warn('[Startup] 🧹 Wiping database to sync with correct network...');
                    await this.localDb.clear();
                    console.log('[Startup] Database wiped. Starting fresh (Ignoring incompatible GCS backup).');
                } else {
                    console.log(`[GCS] ✅ Restoring from cloud: ${gcsChain.length} blocks`);
                    const success = this.blockchain.restoreChain(gcsChain);
                    if (success) {
                        console.log(`⛓️  Chain restored from GCS`);
                    } else {
                        console.error('[GCS] Failed to restore from cloud, using local DB');
                    }
                }
            } else if (savedChain && savedChain.length > 0) {
                // GENESIS HASH CHECK
                const loadedGenesisHash = savedChain[0].hash;
                const currentGenesisHash = this.blockchain.getChain()[0].hash;

                if (loadedGenesisHash !== currentGenesisHash) {
                    console.error('🚨 [Startup] Genesis Hash Mismatch!');
                    console.error(`   Expected: ${currentGenesisHash}`);
                    console.error(`   Found:    ${loadedGenesisHash}`);
                    console.warn('[Startup] 🧹 Wiping database to sync with correct network...');

                    await this.localDb.clear();
                    // Don't restore the chain, let it start fresh with the in-memory genesis
                    console.log('[Startup] Database wiped. Starting fresh.');
                } else {
                    console.log(`[Persistence] Found saved chain with ${savedChain.length} blocks.`);
                    const success = this.blockchain.restoreChain(savedChain);
                    if (success) {
                        console.log('[Persistence] Chain successfully restored to height', this.blockchain.getChainLength());
                    } else {
                        console.warn('[Persistence] Failed to restore chain. Starting from Genesis.');
                    }
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

        // ✅ RECOVERY: Sync User Service with Blockchain
        // This rebuilds the user database from the chain history
        await this.userService.syncWithBlockchain(this.blockchain);

        // Start block production
        this.blockProducer.start();

        // Check if genesis block info can be logged now or needs delay (safe to log simplified)
        console.log(`⛓️  Genesis Block Hash: ${this.blockchain.getChain()[0].hash.substring(0, 16)}...`);

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
    const { SecureLogger } = require('./utils/SecureLogger');
    process.on('uncaughtException', (err) => {
        SecureLogger.error('❌ FATAL UNCAUGHT EXCEPTION:', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
        SecureLogger.error('❌ FATAL UNHANDLED REJECTION:', reason);
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
