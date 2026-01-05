import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from './Mempool';
import { WalletService } from '../wallet/WalletService';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { TransactionModel, Transaction, InnerTransaction, TransactionType } from '../blockchain/models/Transaction';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import { UserService } from '../services/user/UserService';
import { ContentService } from '../services/ContentService';
import { SocialService } from '../services/SocialService';
import { BlockProducer } from '../consensus/BlockProducer';





import { TOKEN_CONFIG } from '../economy/TokenConfig';


/**
 * RPC Server for blockchain node
 */
export class RPCServer {
    private app: express.Application;
    private blockchain: Blockchain;
    private mempool: Mempool;
    private messagePool: any; // MessagePool type
    private walletService: WalletService;
    private validatorPool: ValidatorPool;
    private blockProducer?: BlockProducer;
    private userService?: UserService;
    private contentService?: ContentService;
    private socialService?: SocialService;
    private p2pNetwork?: any; // P2PNetwork
    private port: number;

    constructor(
        blockchain: Blockchain,
        mempool: Mempool,
        messagePool: any, // MessagePool
        walletService: WalletService,
        validatorPool: ValidatorPool,
        port: number = 3000
    ) {
        this.app = express();

        // Trust the first proxy (required for Cloud Run / ngrok / rate-limiting)
        this.app.set('trust proxy', 1);

        this.blockchain = blockchain;
        this.mempool = mempool;
        this.messagePool = messagePool;
        this.walletService = walletService;
        this.validatorPool = validatorPool;
        this.port = port;

        this.setupMiddleware();
        this.setupRoutes();

        // Setup simple health check for Cloud Run
        this.app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });

        this.setupBlockchainListeners();
    }

    /**
     * Listen for blockchain events
     */
    private setupBlockchainListeners(): void {
        this.blockchain.on('blockAdded', (block) => {
            const minedIds: string[] = [];

            for (const tx of block.transactions) {
                // Check for BATCH transactions
                if (tx.type === 'BATCH' || tx.type === 'CONVERSATION_BATCH') {
                    if (tx.payload && Array.isArray(tx.payload.transactions)) {
                        for (const innerTx of tx.payload.transactions) {
                            // Construct ID: from_wallet:nonce
                            const id = `${innerTx.from_wallet}:${innerTx.nonce}`;
                            minedIds.push(id);
                        }
                    }
                }
            }

            if (minedIds.length > 0) {
                console.log(`[RPC] Removing ${minedIds.length} mined messages from MessagePool`);
                this.messagePool.removeMessages(minedIds);
            }
        });
    }

    /**
     * Setup middleware
     */
    private setupMiddleware(): void {
        // Disable CSP for now to allow inline scripts in index.html
        this.app.use(helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false
        }));

        // Allow all CORS
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
        }));

        this.app.use(express.json());

        // Security: Rate Limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5000, // INCREASED: limit each IP to 5000 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Too many requests from this IP, please try again later.' }
        });

        // Apply to all RPC/API routes
        this.app.use('/rpc', limiter);
        this.app.use('/api', limiter);

        // Detailed Request logging
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
            next();
        });
    }

    /**
     * Setup routes
     */
    private setupRoutes(): void {
        // Serve static files from public directory
        this.app.use(express.static('public'));

        // Root route - serve documentation
        this.app.get('/', (req: Request, res: Response) => {
            res.sendFile('index.html', { root: 'public' });
        });

        // Explorer route
        this.app.get('/explorer', (req: Request, res: Response) => {
            res.sendFile('explorer.html', { root: 'public' });
        });

        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ status: 'ok', timestamp: Date.now() });
        });

        // Chain endpoint (full chain)
        this.app.get('/chain', (req: Request, res: Response) => {
            try {
                const chain = this.blockchain.getChain();
                res.json({
                    length: chain.length,
                    chain: chain.map(block => block.toJSON())
                });
            } catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
            }
        });

        // RPC endpoints
        this.app.post('/rpc/sendRawTx', this.sendRawTransaction.bind(this));
        this.app.get('/rpc/status', this.getStatus.bind(this));
        this.app.get('/rpc/blocks', this.getBlocks.bind(this));
        this.app.get('/rpc/block/:indexOrHash', this.getBlock.bind(this));
        this.app.get('/rpc/transaction/:txId', this.getTransaction.bind(this));
        this.app.get('/rpc/transaction/:txId', this.getTransaction.bind(this));
        this.app.get('/rpc/balance/:walletId', this.getBalance.bind(this));
        this.app.get('/rpc/accounts', this.getAllAccounts.bind(this));

        // Network endpoints
        this.app.get('/rpc/peers', this.getPeers.bind(this));
        this.app.get('/api/nodes/discover', this.discoverNodes.bind(this));

        // Dynamic transfer fee endpoints
        this.app.post('/rpc/calculateTransferFee', this.calculateTransferFee.bind(this));
        this.app.post('/rpc/transfer', this.sendTransfer.bind(this));
        // Alias for frontend compatibility
        this.app.post('/api/users/transaction', this.sendTransfer.bind(this));

        // Mining endpoint
        this.app.post('/rpc/mine', this.triggerMining.bind(this));

        // Legacy mining endpoints for compatibility (TraceNetExplorer support)
        this.app.get('/mine_block', this.triggerMining.bind(this));
        this.app.get('/mine', this.triggerMining.bind(this));
        this.app.post('/mine', this.triggerMining.bind(this));
        this.app.get('/api/mine', this.triggerMining.bind(this));
        this.app.post('/api/mine', this.triggerMining.bind(this));

        // Debug endpoints
        this.app.get('/api/debug/pool-dump', this.debugDumpPool.bind(this));

        // Wallet API endpoints
        this.app.post('/api/wallet/create', this.createWallet.bind(this));
        this.app.get('/api/wallet/list/:userId', this.listWallets.bind(this));
        this.app.get('/api/wallet/:walletId', this.getWallet.bind(this));
        this.app.post('/api/wallet/sign', this.signTransaction.bind(this));

        // User API endpoints
        this.app.post('/api/user/create', this.createUser.bind(this));
        this.app.get('/api/user/nickname/:nickname', this.getUserByNickname.bind(this));
        this.app.get('/api/user/:userId', this.getUserById.bind(this));
        this.app.get('/api/user/search', this.searchUsers.bind(this));
        this.app.get('/api/user/check-nickname/:nickname', this.checkNickname.bind(this));

        // Content API endpoints
        this.app.post('/api/content/create', this.createContent.bind(this));
        this.app.get('/api/content/feed', this.getContentFeed.bind(this));
        this.app.get('/api/content/user/:walletId', this.getUserContent.bind(this));
        this.app.get('/api/content/:contentId', this.getContentById.bind(this));

        // Social API endpoints
        this.app.post('/api/social/like', this.likeContent.bind(this));
        this.app.post('/api/social/comment', this.commentContent.bind(this));
        this.app.post('/api/social/follow', this.followUser.bind(this));
        this.app.post('/api/social/unfollow', this.unfollowUser.bind(this));
        this.app.get('/api/social/likes/:contentId', this.getContentLikes.bind(this));
        this.app.get('/api/social/comments/:contentId', this.getContentComments.bind(this));
        this.app.get('/api/social/followers/:walletId', this.getUserFollowers.bind(this));
        this.app.get('/api/social/following/:walletId', this.getUserFollowing.bind(this));

        // Validator endpoints
        this.app.post('/api/validator/register', this.registerValidator.bind(this));
        this.app.post('/api/validator/heartbeat', this.validatorHeartbeat.bind(this));
        this.app.get('/api/validator/list', this.listValidators.bind(this));
        this.app.post('/api/validator/:validatorId/wallet', this.registerValidatorWallet.bind(this));
        this.app.get('/api/validator/:validatorId/wallet', this.getValidatorWallet.bind(this));

        this.app.post('/api/user/privacy', this.updateMessagingPrivacy.bind(this));
        this.app.post('/api/user/rotate-key', this.rotateEncryptionKey.bind(this));

        // Messaging endpoints
        this.app.post('/api/messaging/send', this.sendPrivateMessage.bind(this));

        // NEW: Message Pool Endpoints (Optimized Batching)
        this.app.post('/api/messaging/pool', this.submitToMessagePool.bind(this));
        this.app.get('/api/messaging/pool', this.getMessagePoolMessages.bind(this)); // Added GET
        this.app.get('/api/validator/messages', this.getMessagesForBatching.bind(this));

        this.app.get('/api/messaging/inbox/:walletId', this.getMessages.bind(this));
        this.app.post('/api/messaging/decrypt', this.decryptPrivateMessage.bind(this));

        // Encryption key endpoints  
        this.app.get('/api/user/encryption-key/:identifier', this.getEncryptionKey.bind(this));
        this.app.post('/api/user/:userId/messaging-privacy', this.updateMessagingPrivacy.bind(this));
        this.app.get('/api/user/:userId/qr-code', this.generateQRCode.bind(this));

        // Error handler
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    public setP2PNetwork(p2pNetwork: any): void {
        this.p2pNetwork = p2pNetwork;
    }

    /**
     * Get connected peers
     */
    private async getPeers(req: Request, res: Response): Promise<void> {
        try {
            if (!this.p2pNetwork) {
                res.json([]); // No P2P network linked yet
                return;
            }

            // Get connected peers with details
            const connectedPeers = this.p2pNetwork.getPeers().map((p: any) => ({
                id: p.id,
                url: p.url,
                status: 'connected',
                height: p.height,
                ip: p.ip,
                country: p.country,
                region: p.region,
                city: p.city
            }));

            // Get disconnected known peers
            const knownUrls = this.p2pNetwork.getKnownPeers();
            const disconnectedPeers = knownUrls
                .filter((url: string) => !connectedPeers.find((cp: any) => cp.url === url))
                .map((url: string) => ({
                    url: url,
                    status: 'disconnected', // Known but not currently connected
                    country: 'Unknown'
                }));

            // Combine and limit to 500
            const allPeers = [...connectedPeers, ...disconnectedPeers].slice(0, 500);

            res.json(allPeers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch peers' });
        }
    }

    /**
     * Node discovery endpoint for frontend auto-connect
     */
    private async discoverNodes(req: Request, res: Response): Promise<void> {
        try {
            const peers = this.p2pNetwork?.getPeers() || [];
            const nodes = [];

            // Helper: Check if URL is localhost/private
            const isLocalhost = (url: string): boolean => {
                if (!url || url === 'unknown') return true;
                return url.includes('localhost') ||
                    url.includes('127.0.0.1') ||
                    url.includes('192.168.') ||
                    url.includes('10.0.') ||
                    url.includes('172.16.');
            };

            // Add self ONLY if we have a public URL
            const publicHost = process.env.PUBLIC_HOST;
            if (publicHost && !isLocalhost(publicHost)) {
                nodes.push({
                    url: publicHost,
                    region: process.env.REGION || 'unknown',
                    country: 'US',
                    status: 'healthy',
                    lastSeen: Date.now(),
                    height: this.blockchain.getChainLength(),
                    latency: null,
                    capabilities: ['rpc', 'websocket', 'p2p']
                });
            }

            // Add healthy peers (filter localhost)
            for (const peer of peers) {
                if (peer.height > 0 && !isLocalhost(peer.url)) {
                    nodes.push({
                        url: peer.url,
                        region: peer.region || 'unknown',
                        country: peer.country || 'Unknown',
                        status: 'healthy',
                        lastSeen: Date.now(),
                        height: peer.height,
                        latency: null,
                        capabilities: ['rpc']
                    });
                }
            }

            res.json({
                nodes,
                recommended: null,
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({ error: 'Node discovery failed' });
        }
    }

    /**
     * Send raw transaction
     */
    private async sendRawTransaction(req: Request, res: Response): Promise<void> {
        try {
            const transaction: Transaction = req.body;

            // Validate transaction structure
            const txModel = new TransactionModel(transaction);
            const validation = txModel.validate();

            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }

            // CRITICAL: Verify Signature
            if (!transaction.sender_signature || !transaction.sender_public_key) {
                res.status(400).json({ error: 'Missing sender signature or public key' });
                return;
            }

            // Reconstruct signable data
            const signableData = txModel.getSignableData();
            const isValid = KeyManager.verify(signableData, transaction.sender_signature, transaction.sender_public_key);

            if (!isValid) {
                res.status(400).json({ error: 'Invalid signature' });
                return;
            }

            // Add to mempool
            const result = this.mempool.addTransaction(transaction);

            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }

            res.json({
                success: true,
                tx_id: transaction.tx_id,
                message: 'Transaction added to mempool',
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get node status
     */
    private async getStatus(req: Request, res: Response): Promise<void> {
        try {
            const blockchainStats = this.blockchain.getStats();
            const mempoolStats = this.mempool.getStats();
            const validatorStats = this.validatorPool.getStats();

            // Calculate total distributed coins (airdrops + rewards)
            const chain = this.blockchain.getChain();
            let totalDistributed = 0;
            for (const block of chain) {
                for (const tx of block.transactions) {
                    if (tx.type === 'REWARD') {
                        totalDistributed += tx.amount;
                    }
                }
            }

            res.json({
                blockchain: {
                    ...blockchainStats,
                    totalDistributedCoins: totalDistributed
                },
                mempool: mempoolStats,
                validators: validatorStats,
                timestamp: Date.now(),
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get block by index or hash
     */
    private async getBlock(req: Request, res: Response): Promise<void> {
        try {
            const { indexOrHash } = req.params;

            let block;

            // Check if it's a number (index) or hash
            if (/^\d+$/.test(indexOrHash)) {
                const index = parseInt(indexOrHash, 10);
                block = this.blockchain.getBlockByIndex(index);
            } else {
                block = this.blockchain.getBlockByHash(indexOrHash);
            }

            if (!block) {
                res.status(404).json({ error: 'Block not found' });
                return;
            }

            res.json(block.toJSON());
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get recent blocks (Paginated/Limited)
     */
    private async getBlocks(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string || '10', 10);
            const chain = this.blockchain.getChain();
            // Get last N blocks and reverse to show newest first
            const blocks = chain.slice(-limit).reverse();
            res.json(blocks.map(b => b.toJSON()));
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get transaction by ID
     */
    private async getTransaction(req: Request, res: Response): Promise<void> {
        try {
            const { txId } = req.params;

            // Check mempool first
            const mempoolTx = this.mempool.getTransaction(txId);
            if (mempoolTx) {
                res.json({
                    ...mempoolTx,
                    status: 'pending',
                    in_mempool: true,
                });
                return;
            }

            // Search in blockchain
            const chain = this.blockchain.getChain();
            for (const block of chain) {
                const tx = block.transactions.find((t) => t.tx_id === txId);
                if (tx) {
                    res.json({
                        ...tx,
                        status: 'confirmed',
                        block_index: block.index,
                        block_hash: block.hash,
                    });
                    return;
                }
            }

            res.status(404).json({ error: 'Transaction not found' });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }


    /**
     * Get balance for wallet
     */
    private async getBalance(req: Request, res: Response): Promise<void> {
        try {
            const { walletId } = req.params;
            const balance = this.blockchain.getBalance(walletId);
            res.json({ wallet_id: walletId, balance });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get all accounts
     */
    private async getAllAccounts(req: Request, res: Response): Promise<void> {
        try {
            const accounts = this.blockchain.getAllAccounts();
            res.json({
                accounts: accounts.map(acc => ({
                    address: acc.address,
                    balance: acc.balance,
                    nonce: acc.nonce
                })),
                count: accounts.length
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Calculate transfer fee
     */
    private async calculateTransferFee(req: Request, res: Response): Promise<void> {
        try {
            const { recipient_address, amount, priority } = req.body;

            if (!recipient_address || amount === undefined) {
                res.status(400).json({ error: 'recipient_address and amount are required' });
                return;
            }

            // Get recipient account state
            const recipientAccount = (this.blockchain as any).state.get(recipient_address) || {
                address: recipient_address,
                balance: 0,
                nonce: 0,
                incomingTransferCount: 0
            };

            // Calculate fee using blockchain's method
            const fee = (this.blockchain as any).calculateTransferFee(recipient_address, amount, priority || 'STANDARD');

            // Get fee breakdown
            const { TOKEN_CONFIG } = require('../economy/TokenConfig');
            const feeConfig = TOKEN_CONFIG.DYNAMIC_TRANSFER_FEES;
            const count = recipientAccount.incomingTransferCount || 0;

            let baseTier = 'TIER_0';
            if (count >= feeConfig.BASE.TIER_3.threshold) baseTier = 'TIER_3';
            else if (count >= feeConfig.BASE.TIER_2.threshold) baseTier = 'TIER_2';
            else if (count >= feeConfig.BASE.TIER_1.threshold) baseTier = 'TIER_1';

            res.json({
                recipient_address,
                amount,
                priority: priority || 'STANDARD',
                recipient_incoming_transfers: count,
                base_tier: baseTier,
                base_rate: feeConfig.BASE[baseTier].rate,
                priority_rate: feeConfig.PRIORITY[priority || 'STANDARD'],
                total_fee: fee,
                total_fee_readable: `${fee / 100000000} LT`
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Send transfer (convenience endpoint)
     */
    private async sendTransfer(req: Request, res: Response): Promise<void> {
        try {
            const { from_wallet, to_wallet, amount, priority, sender_public_key, sender_signature } = req.body;

            if (!from_wallet || !to_wallet || amount === undefined) {
                res.status(400).json({ error: 'from_wallet, to_wallet, and amount are required' });
                return;
            }

            // Get recipient account to calculate fee
            const recipientAccount = (this.blockchain as any).state.get(to_wallet) || {
                address: to_wallet,
                balance: 0,
                nonce: 0,
                incomingTransferCount: 0
            };

            // Calculate fee
            const fee = (this.blockchain as any).calculateTransferFee(recipientAccount, amount, priority || 'STANDARD');

            // Create transaction
            // Create transaction
            const tx = TransactionModel.create(
                from_wallet,
                to_wallet,
                'TRANSFER' as any,
                amount,
                fee,
                (Date.now() % 1000000), // Random Nonce
                { priority: priority || 'STANDARD' }
            );

            if (sender_public_key) tx.sender_public_key = sender_public_key;
            if (sender_signature) tx.sender_signature = sender_signature;

            // Validate
            const txModel = new TransactionModel(tx);
            const validation = txModel.validate();

            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }

            // Add to mempool
            const result = this.mempool.addTransaction(tx);

            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }

            res.json({
                success: true,
                tx_id: tx.tx_id,
                amount,
                fee,
                fee_readable: `${fee / 100000000} LT`,
                priority: priority || 'STANDARD',
                message: 'Transfer transaction added to mempool'
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Create wallet
     */
    private async createWallet(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.body;

            if (!userId) {
                res.status(400).json({ error: 'userId is required' });
                return;
            }

            const result = this.walletService.createWallet(userId);

            res.json({
                wallet: {
                    wallet_id: result.wallet.wallet_id,
                    user_id: result.wallet.user_id,
                    public_key: result.wallet.public_key,
                    is_first_wallet: result.wallet.is_first_wallet,
                    created_at: result.wallet.created_at,
                },
                mnemonic: result.mnemonic,
                // Note: In production, private key should not be returned in API response
                // It should be stored securely client-side
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * List wallets for user
     */
    private async listWallets(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const wallets = this.walletService.listWallets(userId);

            res.json({
                user_id: userId,
                wallets: wallets.map((w) => ({
                    wallet_id: w.wallet_id,
                    public_key: w.public_key,
                    is_first_wallet: w.is_first_wallet,
                    created_at: w.created_at,
                })),
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get wallet details
     */
    private async getWallet(req: Request, res: Response): Promise<void> {
        try {
            const { walletId } = req.params;

            const wallet = this.walletService.getWallet(walletId);

            if (!wallet) {
                res.status(404).json({ error: 'Wallet not found' });
                return;
            }

            const balance = this.blockchain.getBalance(walletId);

            res.json({
                wallet_id: wallet.wallet_id,
                user_id: wallet.user_id,
                public_key: wallet.public_key,
                balance,
                nonce: (this.blockchain.getAccountState(walletId) || { nonce: 0 }).nonce,
                is_first_wallet: wallet.is_first_wallet,
                created_at: wallet.created_at,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Sign transaction
     */
    private async signTransaction(req: Request, res: Response): Promise<void> {
        try {
            const { wallet_id, transaction_data } = req.body;

            if (!wallet_id || !transaction_data) {
                res.status(400).json({ error: 'wallet_id and transaction_data are required' });
                return;
            }

            const signature = this.walletService.signData(wallet_id, transaction_data);

            if (!signature) {
                res.status(404).json({ error: 'Wallet not found or unable to sign' });
                return;
            }

            res.json({
                wallet_id,
                signature,
                timestamp: Date.now(),
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Register validator
     */
    private async registerValidator(req: Request, res: Response): Promise<void> {
        try {
            const { validator_id, user_id, public_key } = req.body;

            if (!validator_id || !user_id || !public_key) {
                res.status(400).json({
                    error: 'validator_id, user_id, and public_key are required',
                });
                return;
            }

            this.validatorPool.registerValidator(validator_id, user_id, public_key);

            res.json({
                success: true,
                validator_id,
                message: 'Validator registered successfully',
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Validator heartbeat
     */
    private async validatorHeartbeat(req: Request, res: Response): Promise<void> {
        try {
            const { validator_id } = req.body;

            if (!validator_id) {
                res.status(400).json({ error: 'validator_id is required' });
                return;
            }

            this.validatorPool.updateHeartbeat(validator_id);

            res.json({
                success: true,
                validator_id,
                timestamp: Date.now(),
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * List validators
     */
    private async listValidators(req: Request, res: Response): Promise<void> {
        try {
            const onlineOnly = req.query.online === 'true';

            const validators = onlineOnly
                ? this.validatorPool.getOnlineValidators()
                : this.validatorPool.getAllValidators();

            res.json({
                validators: validators.map((v) => ({
                    validator_id: v.validator_id,
                    user_id: v.user_id,
                    is_online: v.is_online,
                    reputation: v.reputation,
                    total_blocks_produced: v.total_blocks_produced,
                    total_signatures: v.total_signatures,
                    last_active: v.last_active,
                })),
                count: validators.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Register wallet for validator (for fee distribution)
     */
    private async registerValidatorWallet(req: Request, res: Response): Promise<void> {
        try {
            const { validatorId } = req.params;
            const { wallet_address } = req.body;

            if (!wallet_address) {
                res.status(400).json({ error: 'wallet_address is required' });
                return;
            }

            // Validate wallet address format
            if (!wallet_address.startsWith('TRN')) {
                res.status(400).json({ error: 'Invalid wallet address format' });
                return;
            }

            // Check if validator exists
            const validator = this.validatorPool.getValidator(validatorId);
            if (!validator) {
                res.status(404).json({ error: 'Validator not found' });
                return;
            }

            // Register wallet
            this.validatorPool.registerWallet(validatorId, wallet_address);

            res.json({
                success: true,
                validator_id: validatorId,
                wallet_address,
                message: 'Wallet registered successfully for validator',
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get registered wallet for validator
     */
    private async getValidatorWallet(req: Request, res: Response): Promise<void> {
        try {
            const { validatorId } = req.params;

            const wallet = this.validatorPool.getWallet(validatorId);

            if (!wallet) {
                res.status(404).json({
                    validator_id: validatorId,
                    wallet_address: null,
                    message: 'No wallet registered for this validator'
                });
                return;
            }

            res.json({
                validator_id: validatorId,
                wallet_address: wallet,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get encryption public key for messaging
     */
    private async getEncryptionKey(req: Request, res: Response): Promise<void> {
        try {
            const { identifier } = req.params;

            if (!this.userService) {
                res.status(500).json({ error: 'User service not initialized' });
                return;
            }

            const keyInfo = this.userService.getEncryptionPublicKey(identifier);

            if (!keyInfo) {
                res.status(404).json({ error: 'User not found or encryption key not available' });
                return;
            }

            res.json(keyInfo);
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Generate QR code data for messaging
     */
    private async generateQRCode(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            if (!this.userService) {
                res.status(500).json({ error: 'User service not initialized' });
                return;
            }

            const qrData = this.userService.generateQRCodeData(userId);

            if (!qrData) {
                res.status(404).json({ error: 'User not found or encryption key not available' });
                return;
            }

            // Generate QR string format
            const qrString = `tracenet://msg?key=${qrData.encryption_public_key}&wallet=${qrData.wallet_id}&nick=${qrData.nickname}`;

            res.json({
                qr_data: qrData,
                qr_string: qrString
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Set user service (to be called after construction)
     */
    setUserService(userService: UserService): void {
        this.userService = userService;
    }

    /**
     * Create user with profile
     */
    private async createUser(req: Request, res: Response): Promise<void> {
        try {
            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const { nickname, email, name, surname, birth_date } = req.body;

            // No validation required - all fields are optional

            const result = await this.userService.createUser({
                nickname,
                email,
                first_name: name,
                last_name: surname,
                birthday: birth_date,
            });

            res.json({
                user: {
                    user_id: result.user.system_id,
                    nickname: result.user.nickname,
                    name: result.user.first_name,
                    surname: result.user.last_name,
                    created_at: result.user.created_at,
                    encryption_public_key: result.user.encryption_public_key,
                    messaging_privacy: result.user.messaging_privacy
                },
                wallet: {
                    wallet_id: result.wallet.wallet_id,
                    public_key: result.wallet.public_key,
                    created_at: result.wallet.created_at,
                    // Optimistic balance (atomic units)
                    balance: result.airdropAmount || 0
                },
                mnemonic: result.mnemonic,
                // Airdrop logic handled internally
                airdrop_amount: result.airdropAmount ? `${result.airdropAmount / 100000000} LT` : '0 LT',
                amount: result.airdropAmount || 0 // Atomic units for standard parsing
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user by nickname
     */
    private async getUserByNickname(req: Request, res: Response): Promise<void> {
        try {
            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const { nickname } = req.params;
            const user = this.userService.getUserByNickname(nickname);

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            const wallets = this.walletService.listWallets(user.system_id);
            const balance = user.wallet_ids.length > 0 ? this.blockchain.getBalance(user.wallet_ids[0]) : 0;

            res.json({
                user: {
                    user_id: user.system_id,
                    nickname: user.nickname,
                    name: user.first_name,
                    surname: user.last_name,
                    created_at: user.created_at,
                    encryption_public_key: user.encryption_public_key,
                    messaging_privacy: user.messaging_privacy
                },
                wallet_id: user.wallet_ids[0],
                balance,
                total_wallets: wallets.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user by ID
     */
    private async getUserById(req: Request, res: Response): Promise<void> {
        try {
            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const { userId } = req.params;
            const user = this.userService.getUser(userId);

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            const wallets = this.walletService.listWallets(user.system_id);
            const balance = user.wallet_ids.length > 0 ? this.blockchain.getBalance(user.wallet_ids[0]) : 0;

            res.json({
                user: {
                    user_id: user.system_id,
                    nickname: user.nickname,
                    name: user.first_name,
                    surname: user.last_name,
                    created_at: user.created_at,
                    encryption_public_key: user.encryption_public_key,
                    messaging_privacy: user.messaging_privacy
                },
                wallet_id: user.wallet_ids[0],
                balance,
                total_wallets: wallets.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Search users
     */
    private async searchUsers(req: Request, res: Response): Promise<void> {
        try {
            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const query = req.query.q as string;
            const limit = parseInt(req.query.limit as string) || 20;

            if (!query) {
                res.status(400).json({ error: 'Query parameter "q" is required' });
                return;
            }

            const users = this.userService.searchUsers(query, limit);

            res.json({
                users: users.map((u) => ({
                    user_id: u.system_id,
                    nickname: u.nickname,
                    name: u.first_name,
                    surname: u.last_name,
                    created_at: u.created_at,
                    encryption_public_key: u.encryption_public_key,
                    messaging_privacy: u.messaging_privacy
                })),
                count: users.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Check nickname availability
     */
    private async checkNickname(req: Request, res: Response): Promise<void> {
        try {
            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const { nickname } = req.params;
            const available = await this.userService.isNicknameAvailable(nickname);

            res.json({
                nickname,
                available,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * Set content service (to be called after construction)
     */
    setContentService(contentService: ContentService): void {
        this.contentService = contentService;
    }

    /**
     * Get messages for Batching (Validator API)
     * GET /api/validator/messages
     */
    private async getMessagesForBatching(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string || '50', 10);
            const minWaitTime = parseInt(req.query.minWaitTime as string || '0', 10);

            const messages = this.messagePool.getMessages(limit, minWaitTime);

            res.json({
                count: messages.length,
                messages
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Create content
     */
    private async createContent(req: Request, res: Response): Promise<void> {
        try {
            if (!this.contentService) {
                res.status(503).json({ error: 'Content service not available' });
                return;
            }

            const { wallet_id, content_type, title, description, content_url, media_type, duration, size, tags } =
                req.body;

            if (!wallet_id || !content_type) {
                res.status(400).json({ error: 'wallet_id and content_type are required' });
                return;
            }

            const result = this.contentService.createContent({
                wallet_id,
                content_type,
                title,
                description,
                content_url,
                media_type,
                duration,
                size,
                tags,
            });

            res.json({
                success: true,
                content: result.content,
                tx_id: result.tx_id,
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get content by ID
     */
    private async getContentById(req: Request, res: Response): Promise<void> {
        try {
            if (!this.contentService) {
                res.status(503).json({ error: 'Content service not available' });
                return;
            }

            const { contentId } = req.params;
            const content = this.contentService.getContent(contentId);

            if (!content) {
                res.status(404).json({ error: 'Content not found' });
                return;
            }

            res.json({
                success: true,
                content,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user's content
     */
    private async getUserContent(req: Request, res: Response): Promise<void> {
        try {
            if (!this.contentService) {
                res.status(503).json({ error: 'Content service not available' });
                return;
            }

            const { walletId } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;

            const contents = this.contentService.getUserContent(walletId, limit);

            res.json({
                success: true,
                wallet_id: walletId,
                contents,
                count: contents.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get content feed
     */
    private async getContentFeed(req: Request, res: Response): Promise<void> {
        try {
            if (!this.contentService) {
                res.status(503).json({ error: 'Content service not available' });
                return;
            }

            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            const result = this.contentService.getContentFeed(limit, offset);

            res.json({
                success: true,
                contents: result.contents,
                total: result.total,
                limit,
                offset,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Set social service (to be called after construction)
     */
    setSocialService(socialService: SocialService): void {
        this.socialService = socialService;
    }

    /**
     * Like content (0.00001 LT - 50% to creator, 50% to treasury)
     */
    private async likeContent(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { wallet_id, content_id } = req.body;

            if (!wallet_id || !content_id) {
                res.status(400).json({ error: 'wallet_id and content_id are required' });
                return;
            }

            const result = this.socialService.likeContent({
                wallet_id,
                content_id,
            });

            res.json({
                success: true,
                tx_id: result.tx_id,
                fee_breakdown: {
                    total_fee: result.fee_paid,
                    creator_received: result.creator_received,
                    treasury_received: result.treasury_received,
                    fee_split: '50% creator / 50% treasury',
                },
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Comment on content (0.00001 LT - 50% to creator, 50% to treasury)
     */
    private async commentContent(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { wallet_id, content_id, comment_text, parent_comment_id } = req.body;

            if (!wallet_id || !content_id || !comment_text) {
                res.status(400).json({ error: 'wallet_id, content_id, and comment_text are required' });
                return;
            }

            const result = this.socialService.commentOnContent({
                wallet_id,
                content_id,
                comment_text,
                parent_comment_id,
            });

            res.json({
                success: true,
                tx_id: result.tx_id,
                fee_breakdown: {
                    total_fee: result.fee_paid,
                    creator_received: result.creator_received,
                    treasury_received: result.treasury_received,
                    fee_split: '50% creator / 50% treasury',
                },
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Follow user (FREE - no fee)
     */
    private async followUser(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { wallet_id, target_wallet_id } = req.body;

            if (!wallet_id || !target_wallet_id) {
                res.status(400).json({ error: 'wallet_id and target_wallet_id are required' });
                return;
            }

            const result = this.socialService.followUser({
                wallet_id,
                target_wallet_id,
            });

            res.json({
                success: true,
                tx_id: result.tx_id,
                message: 'Following user (FREE - no fee)',
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Unfollow user (FREE - no fee)
     */
    private async unfollowUser(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { wallet_id, target_wallet_id } = req.body;

            if (!wallet_id || !target_wallet_id) {
                res.status(400).json({ error: 'wallet_id and target_wallet_id are required' });
                return;
            }

            const result = this.socialService.unfollowUser({
                wallet_id,
                target_wallet_id,
            });

            res.json({
                success: true,
                tx_id: result.tx_id,
                message: 'Unfollowed user',
            });
        } catch (error) {
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get content likes
     */
    private async getContentLikes(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { contentId } = req.params;
            const likes = this.socialService.getContentLikes(contentId);

            res.json({
                success: true,
                content_id: contentId,
                likes,
                count: likes.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get content comments
     */
    private async getContentComments(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { contentId } = req.params;
            const comments = this.socialService.getContentComments(contentId);

            res.json({
                success: true,
                content_id: contentId,
                comments,
                count: comments.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get user followers
     */
    private async getUserFollowers(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { walletId } = req.params;
            const followers = this.socialService.getUserFollowers(walletId);

            res.json({
                success: true,
                wallet_id: walletId,
                followers,
                count: followers.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get who user is following
     */
    private async getUserFollowing(req: Request, res: Response): Promise<void> {
        try {
            if (!this.socialService) {
                res.status(503).json({ error: 'Social service not available' });
                return;
            }

            const { walletId } = req.params;
            const following = this.socialService.getUserFollowing(walletId);

            res.json({
                success: true,
                wallet_id: walletId,
                following,
                count: following.length,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Send encrypted private message
     */
    private async sendPrivateMessage(req: Request, res: Response): Promise<void> {
        try {
            const { from_wallet, to_wallet, encrypted_message, sender_public_key, sender_signature, sender_encryption_key } = req.body;

            if (!from_wallet || !to_wallet || !encrypted_message) {
                res.status(400).json({
                    error: 'from_wallet, to_wallet, and encrypted_message are required. Message must be encrypted client-side.',
                });
                return;
            }

            // Check if recipient accepts messages from sender
            if (this.userService) {
                // Find recipient user by wallet
                const recipient = this.userService.getUserByWallet(to_wallet);
                if (recipient) {
                    const canReceive = this.userService.canReceiveMessageFrom(recipient.system_id, from_wallet);
                    if (!canReceive) {
                        res.status(403).json({
                            error: 'Recipient does not accept messages from you due to privacy settings'
                        });
                        return;
                    }
                }
            }

            // NO SERVER-SIDE ENCRYPTION - Message must already be encrypted by client
            // Client should use KeyManager.encryptForUser() before sending

            // Create transaction with pre-encrypted message
            const { TOKEN_CONFIG } = require('../economy/TokenConfig');
            const tx = TransactionModel.create(
                from_wallet,
                to_wallet,
                'PRIVATE_MESSAGE' as any,
                0, // No amount transfer
                TOKEN_CONFIG.MESSAGE_FEE, // Use configured fee (0.000001 LT)
                (Date.now() % 1000000), // Random Nonce
                {
                    message: encrypted_message,
                    encrypted: true,
                    sender_encryption_key: sender_encryption_key // Curve25519 public key for decryption
                }
            );

            // Add signatures if provided
            if (sender_public_key) tx.sender_public_key = sender_public_key;
            if (sender_signature) tx.sender_signature = sender_signature;

            // Validate transaction
            const txModel = new TransactionModel(tx);
            const validation = txModel.validate();

            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }

            // Add to mempool
            const result = this.mempool.addTransaction(tx);

            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }

            res.json({
                success: true,
                tx_id: tx.tx_id,
                message: 'Encrypted private message sent to blockchain',
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get messages for a wallet (Inbox)
     */
    private async getMessages(req: Request, res: Response): Promise<void> {
        // console.log(`[InboxDebug] getMessages called for ${req.params.walletId}`); // Removed for performance
        try {
            const { walletId } = req.params;
            const limit = Number(req.query.limit) || 50;
            const offset = Number(req.query.offset) || 0;

            if (!walletId) {
                res.status(400).json({ error: 'Wallet ID is required' });
                return;
            }

            const chain = this.blockchain.getChain();
            const messages: any[] = [];
            const targetCount = limit + offset;

            // Iterate backwards to get latest messages first
            // OPTIMIZATION: Stop once we have enough messages
            for (let i = chain.length - 1; i >= 0; i--) {
                if (messages.length >= targetCount) break; // Early Exit

                const block = chain[i];
                for (const tx of block.transactions) {
                    if (tx.type === 'BATCH') {
                        const innerTxs: any[] = tx.payload?.transactions || [];
                        for (const inner of innerTxs) {
                            if (inner.type === 'PRIVATE_MESSAGE' && inner.to_wallet === walletId) {
                                messages.push({
                                    tx_id: tx.tx_id, // Use Batch ID as container
                                    from: inner.from_wallet,
                                    timestamp: inner.timestamp || tx.timestamp,
                                    encrypted_content: inner.payload.content || inner.payload.message || inner.payload.encrypted_content,
                                    sender_public_key: (inner as any).sender_public_key,
                                    sender_encryption_key: inner.payload.sender_encryption_key
                                });
                            }
                        }
                    }

                    if (tx.type === 'PRIVATE_MESSAGE' && tx.to_wallet === walletId) {
                        messages.push({
                            tx_id: tx.tx_id,
                            from: tx.from_wallet,
                            timestamp: tx.timestamp,
                            encrypted_content: tx.payload.message || tx.payload.encrypted_content, // Support both formats
                            sender_public_key: tx.sender_public_key,
                            sender_encryption_key: tx.payload.sender_encryption_key
                        });
                    }
                }
            }

            // Apply pagination efficiently
            // We collected 'offset + limit' messages (latest first).
            // So we just take the slice from 'offset'.
            const paginatedMessages = messages.slice(offset, offset + limit);

            res.json({
                success: true,
                wallet_id: walletId,
                messages: paginatedMessages,
                total: messages.length + (messages.length === targetCount ? "..." : "") // Approx total indication if truncated
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Decrypt received private message
     * @deprecated This endpoint is deprecated for security reasons.
     * Decryption MUST be done client-side using KeyManager.decryptFromUser()
     */
    private async decryptPrivateMessage(req: Request, res: Response): Promise<void> {
        res.status(410).json({
            error: 'This endpoint is deprecated for security reasons.',
            message: 'Private messages must be decrypted CLIENT-SIDE using your private key.',
            documentation: 'Use KeyManager.decryptFromUser(encryptedMessage, recipientEncryptionPrivateKey, senderEncryptionPublicKey)',
            reason: 'Never send your private key to the server. Client-side decryption ensures end-to-end encryption.'
        });
    }

    /**
     * Generate new key pair for auth
     */
    private async generateKeys(req: Request, res: Response): Promise<void> {
        try {
            const keyPair = KeyManager.generateKeyPair();
            res.json({
                public_key: keyPair.publicKey,
                // SECURITY: Never return private keys in API responses!
                // Users must store private keys securely on their own devices
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Login with public key and signature
     */
    private async login(req: Request, res: Response): Promise<void> {
        try {
            const { public_key, signature, timestamp } = req.body;

            if (!public_key || !signature || !timestamp) {
                res.status(400).json({ error: 'public_key, signature, and timestamp are required' });
                return;
            }

            // Verify timestamp to prevent replay attacks (allow 5 minute window)
            const now = Date.now();
            if (Math.abs(now - timestamp) > 300000) {
                res.status(400).json({ error: 'Timestamp out of range' });
                return;
            }

            // Verify signature
            // The message signed should be the timestamp (as string)
            const isValid = KeyManager.verify(timestamp.toString(), signature, public_key);

            if (!isValid) {
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }

            // In a real app, we would issue a JWT here.
            // For now, we just return success.
            res.json({
                success: true,
                message: 'Login successful',
                user_id: KeyManager.deriveAddress(public_key) // Use address as user ID for now
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
    * Update messaging privacy settings
    */
    private async updateMessagingPrivacy(req: Request, res: Response): Promise<void> {
        try {
            const { system_id, privacy } = req.body;

            if (!system_id || !privacy) {
                res.status(400).json({ error: 'system_id and privacy are required' });
                return;
            }

            if (!['public', 'followers', 'private'].includes(privacy)) {
                res.status(400).json({ error: 'Invalid privacy setting. Must be public, followers, or private' });
                return;
            }

            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const success = this.userService.updateMessagingPrivacy(system_id, privacy);

            if (!success) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            res.json({
                success: true,
                message: `Messaging privacy updated to ${privacy}`,
                fee: '0.000005 LT'
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Rotate encryption key
     */
    private async rotateEncryptionKey(req: Request, res: Response): Promise<void> {
        try {
            const { system_id, shredHistory, public_key } = req.body;

            if (!system_id) {
                res.status(400).json({ error: 'system_id is required' });
                return;
            }

            if (!this.userService) {
                res.status(503).json({ error: 'User service not available' });
                return;
            }

            const result = this.userService.rotateEncryptionKey(system_id, shredHistory, public_key);

            if (!result.success) {
                res.status(400).json({ error: result.error || 'Failed to rotate key' });
                return;
            }

            res.json({
                success: true,
                message: 'Encryption key rotated successfully',
                new_public_key: result.newPublicKey,
                // SECURITY: Private keys must never be transmitted
                fee: '0.00001 LT'
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Start server
     */
    start(): void {
        this.app.listen(this.port, () => {
            console.log(`RPC Server listening on port ${this.port}`);

            // Background Mining Loop for Batched Messages
            console.log("Starting background mining loop (60s interval)...");
            setInterval(() => {
                this.processMiningCycle().catch(e => console.error("Background mining error:", e));
            }, 60000); // Check every minute
        });
    }

    /**
     * Get Express app instance
     */
    getApp(): express.Application {
        return this.app;
    }

    /**
     * Set block producer (to be called after construction)
     */
    setBlockProducer(blockProducer: BlockProducer): void {
        this.blockProducer = blockProducer;
    }

    /**
     * Manually trigger mining (for dev/testing)
     */
    private async triggerMining(req: Request, res: Response): Promise<void> {
        try {
            const result = await this.processMiningCycle();

            if (result.success) {
                res.json(result);
            } else {
                res.status(400).json(result);
            }
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
                message: 'Mining trigger failed'
            });
        }
    }

    /**
     * Core Mining Cycle Logic (Refactored for reuse)
     */
    public async processMiningCycle(): Promise<any> {
        if (!this.blockProducer) {
            return {
                success: false,
                error: 'Block producer not available',
                message: 'Mining system not initialized'
            };
        }

        // AUTO-BATCHING: Promote waiting messages to Mempool before mining
        const promoteResult = this.promotePendingMessagesToMempool();

        const result = await this.blockProducer.triggerBlockProduction();

        if (result.success && result.block) {
            return {
                success: true,
                block: {
                    index: result.block.index,
                    hash: result.block.hash,
                    transaction_count: result.block.transactions.length
                },
                message: 'Block mined successfully',
                promotion: promoteResult
            };
        } else {
            // Treat empty mempool or all-waiting as success (idempotent mining)
            if (result.error === 'No transactions in mempool' ||
                (result.error && result.error.includes('No valid transactions'))) {
                return {
                    success: true,
                    message: 'Mining cycle completed. No ready transactions to mine (transactions may be time-locked).',
                    promotion: promoteResult
                };
            } else {
                return {
                    success: false,
                    error: result.error || 'Mining failed',
                    message: 'Unable to mine block'
                };
            }
        }
    }

    /**
     * Helper: Promote pending messages to Mempool as BATCH transactions
     */
    private promotePendingMessagesToMempool(priorityFilter: 'FAST' | 'ALL' = 'ALL'): { count: number; error?: string; txId?: string } {
        const candidates = this.messagePool.getMessages(priorityFilter === 'FAST' ? 50 : 200);
        console.log(`[RPC] promotePendingMessagesToMempool Candidate Count: ${candidates.length} (Filter: ${priorityFilter})`);

        const now = Date.now();

        const toBatch = candidates.filter((msg: InnerTransaction) => {
            // FAST logic
            if (msg.amount >= TOKEN_CONFIG.FEE_TIERS.FAST) {
                console.log(`[RPC] Candidate MATCHED Fast Lane: ${msg.amount}`);
                return true;
            }

            // BATCH logic: Always promote ready-made batches from pool
            if (msg.type === TransactionType.BATCH || msg.type === TransactionType.CONVERSATION_BATCH) {
                console.log(`[RPC] Promoting READY BATCH: ${(msg as any).tx_id}`);
                return true;
            }

            // If we are only looking for FAST, skip others
            if (priorityFilter === 'FAST') return false;

            // NORMAL/SLOW logic
            const age = now - (msg.timestamp || now);
            // If fee >= NORMAL (but < FAST), wait 10 mins
            if (msg.amount >= TOKEN_CONFIG.FEE_TIERS.NORMAL) return age >= 10 * 60 * 1000;

            // Otherwise (Low fee), wait 1 hour
            return age >= 60 * 60 * 1000;
        });

        if (toBatch.length > 0) {
            console.log(`[RPC] Promoting ${toBatch.length} messages (${priorityFilter}) to Mempool...`);

            // 1. Create a temporary "Relayer" wallet
            const relayerKeys = KeyManager.generateKeyPair();
            const relayerId = KeyManager.deriveAddress(relayerKeys.publicKey);

            // 2. Fund the relayer (Dev Hack)
            this.blockchain.forceSetAccountState(relayerId, {
                address: relayerId,
                balance: 100000000,
                nonce: 0,
                incomingTransferCount: 0
            });

            // 3. Create BATCH Transaction
            const batchTx = TransactionModel.create(
                relayerId,
                relayerId,
                'BATCH' as any,
                0,
                0.00001,
                1,
                { transactions: toBatch },
                relayerKeys.publicKey
            );

            // 4. Sign Batch TX
            const signableData = batchTx.getSignableData();
            batchTx.sender_signature = KeyManager.sign(signableData, relayerKeys.privateKey);

            // 5. Add to Mempool
            const result = this.mempool.addTransaction(batchTx.toJSON());
            if (result.success) {
                console.log(`[RPC] Auto-batched into TX: ${batchTx.tx_id}`);
                // Remove from pool immediately to prevent double batching
                const idsToRemove = toBatch.map((m: InnerTransaction) => `${m.from_wallet}:${m.nonce}`);
                this.messagePool.removeMessages(idsToRemove);
                return { count: toBatch.length, txId: batchTx.tx_id };
            } else {
                console.error(`[RPC] Failed to auto-batch: ${result.error}`);
                return { count: toBatch.length, error: result.error };
            }
        }

        return { count: 0 };
    }

    /**
     * Submit inner message to pool
     */
    private async submitToMessagePool(req: Request, res: Response): Promise<void> {
        try {
            const innerTx: InnerTransaction = req.body;

            // Validate inner transaction
            if (!innerTx.signature || !innerTx.from_wallet || !innerTx.payload) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            // Verify inner signature
            const rawData = {
                amount: innerTx.amount,
                from_wallet: innerTx.from_wallet,
                max_wait_time: innerTx.max_wait_time,
                nonce: innerTx.nonce,
                payload: innerTx.payload,
                sender_public_key: innerTx.sender_public_key, // Include in signable data to match client signing
                timestamp: innerTx.timestamp,
                to_wallet: innerTx.to_wallet,
                type: innerTx.type
            };

            const sortedData = this.sortObject(rawData);
            const dataToVerify = JSON.stringify(sortedData);

            if (!innerTx.sender_public_key) {
                res.status(400).json({ error: 'Missing sender_public_key' });
                return;
            }

            const isValid = KeyManager.verify(dataToVerify, innerTx.signature, innerTx.sender_public_key);

            if (!isValid) {
                console.error(`[RPC] Signature Verification Failed!`);
                res.status(400).json({
                    error: 'Invalid signature',
                    details: 'Server verification failed',
                    server_string: dataToVerify
                });
                return;
            }

            // Submit to pool
            const result = this.messagePool.addMessage(innerTx);

            if (result.success) {
                res.json({ success: true, message: 'Message added to pool', pool_id: result.messageId });

                // OPTIMIZATION: Instant Mining for FAST messages
                // If fee is high enough (FAST_LANE), trigger batching & mining immediately
                if (innerTx.amount >= TOKEN_CONFIG.FEE_TIERS.FAST) {
                    console.log(`[RPC] Fast Message detected (Fee: ${innerTx.amount} >= ${TOKEN_CONFIG.FEE_TIERS.FAST}). Promoting...`);

                    // 1. Promote to Mempool immediately
                    this.promotePendingMessagesToMempool('FAST');

                    // 2. Trigger Mining (optional, but requested by user for "instant" feel)
                    this.processMiningCycle()
                        .then(res => console.log(`[RPC] Instant mining result: ${res.success} - ${res.message || 'No msg'}`))
                        .catch(err => console.error("[RPC] Instant mining failed:", err));
                } else {
                    console.log(`[RPC] Standard Message (Fee: ${innerTx.amount} < ${TOKEN_CONFIG.FEE_TIERS.FAST}). Waiting in pool.`);
                }

            } else {
                res.status(400).json({ error: result.error });
            }

        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get messages in pool (for debugging)
     */
    private async getMessagePoolMessages(req: Request, res: Response): Promise<void> {
        try {
            const stats = this.messagePool.getStats();
            const messages = this.messagePool.getMessages(100); // Limit to 100 for view

            res.json({
                success: true,
                stats,
                messages
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * DEBUG: Dump entire pool state
     */
    private async debugDumpPool(req: Request, res: Response): Promise<void> {
        try {
            const allMessages = this.messagePool.getMessages(1000, 0);
            res.json({
                count: allMessages.length,
                fast_threshold: TOKEN_CONFIG.FEE_TIERS.FAST,
                messages: allMessages.map((m: any) => ({
                    id: `${m.from_wallet}:${m.nonce}`,
                    amount: m.amount,
                    is_fast: m.amount >= TOKEN_CONFIG.FEE_TIERS.FAST,
                    age_ms: Date.now() - m.timestamp
                }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Debug dump failed' });
        }
    }

    /**
     * Start Auto-Miner for Single-Node / Dev Environments
     */
    public startAutoMiner(): void {
        console.log('[AutoMiner] Checking if Auto-Miner is required...');

        // Check validator count directly from pool
        const stats = this.validatorPool.getStats();
        const shouldAutoMine = stats.totalValidators <= 1;

        if (shouldAutoMine) {
            console.log(`[AutoMiner] Single node detected (${stats.totalValidators} validator). Starting Auto-Miner Service 🛠️`);

            setInterval(async () => {
                try {
                    // Check if there is anything to mine
                    const pendingMsgs = this.messagePool.getMessages().length;
                    const mempoolSize = this.mempool.getSize();

                    if (pendingMsgs > 0 || mempoolSize > 0) {
                        console.log(`[AutoMiner] Details - Pending Msg: ${pendingMsgs}, Mempool: ${mempoolSize}`);
                        console.log('[AutoMiner] Triggering mining cycle...');

                        const result = await this.processMiningCycle();
                        if (result.success) {
                            if (result.block) {
                                console.log(`[AutoMiner] ✅ Block Mined! Hash: ${result.block.hash}`);
                            } else {
                                console.log(`[AutoMiner] ℹ️  Mining cycle completed (No block produced).`);
                            }
                        } else {
                            console.error(`[AutoMiner] ❌ Mining failed: ${result.error}`);
                        }
                    }
                } catch (err) {
                    console.error('[AutoMiner] Error in loop:', err);
                }
            }, 600000); // Check every 10 minutes (batch processing)
        } else {
            console.log(`[AutoMiner] Multiple validators detected (${stats.totalValidators}). Auto-Miner DISABLED.`);
        }
    }

    /**
     * Helper to sort object keys recursively for canonical JSON
     */
    private sortObject(obj: any): any {
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
            return obj;
        }
        return Object.keys(obj)
            .sort()
            .reduce((result: any, key) => {
                result[key] = this.sortObject(obj[key]);
                return result;
            }, {});
    }
}
