import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from './Mempool';
import { WalletService } from '../wallet/WalletService';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { TransactionModel, Transaction } from '../blockchain/models/Transaction';
import { KeyManager } from '../blockchain/crypto/KeyManager';
import { UserService } from '../services/UserService';
import { ContentService } from '../services/ContentService';
import { SocialService } from '../services/SocialService';

/**
 * RPC Server for blockchain node
 */
export class RPCServer {
    private app: express.Application;
    private blockchain: Blockchain;
    private mempool: Mempool;
    private walletService: WalletService;
    private validatorPool: ValidatorPool;
    private userService?: UserService;
    private contentService?: ContentService;
    private socialService?: SocialService;
    private port: number;

    constructor(
        blockchain: Blockchain,
        mempool: Mempool,
        walletService: WalletService,
        validatorPool: ValidatorPool,
        port: number = 3000
    ) {
        this.app = express();
        this.blockchain = blockchain;
        this.mempool = mempool;
        this.walletService = walletService;
        this.validatorPool = validatorPool;
        this.port = port;

        this.setupMiddleware();
        this.setupRoutes();
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
        this.app.get('/rpc/block/:indexOrHash', this.getBlock.bind(this));
        this.app.get('/rpc/transaction/:txId', this.getTransaction.bind(this));
        this.app.get('/rpc/transaction/:txId', this.getTransaction.bind(this));
        this.app.get('/rpc/balance/:walletId', this.getBalance.bind(this));
        this.app.get('/rpc/accounts', this.getAllAccounts.bind(this));

        // Dynamic transfer fee endpoints
        this.app.post('/rpc/calculateTransferFee', this.calculateTransferFee.bind(this));
        this.app.post('/rpc/transfer', this.sendTransfer.bind(this));

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

        // Messaging endpoints
        this.app.post('/api/messaging/send', this.sendPrivateMessage.bind(this));
        this.app.post('/api/messaging/decrypt', this.decryptPrivateMessage.bind(this));

        // Error handler
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error('Error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
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
            const fee = (this.blockchain as any).calculateTransferFee(recipientAccount, amount, priority || 'STANDARD');

            // Get fee breakdown
            const { TOKEN_CONFIG } = require('../../economy/TokenConfig');
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
            const tx = TransactionModel.create(
                from_wallet,
                to_wallet,
                'TRANSFER' as any,
                amount,
                fee,
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

            const { nickname, name, surname, birth_date } = req.body;

            if (!nickname) {
                res.status(400).json({ error: 'Nickname is required' });
                return;
            }

            const result = this.userService.createUser({
                nickname,
                name,
                surname,
                birth_date,
            });

            res.json({
                user: {
                    user_id: result.user.user_id,
                    nickname: result.user.nickname,
                    name: result.user.name,
                    surname: result.user.surname,
                    created_at: result.user.created_at,
                },
                wallet: {
                    wallet_id: result.wallet.wallet_id,
                    public_key: result.wallet.public_key,
                    created_at: result.wallet.created_at,
                },
                mnemonic: result.mnemonic,
                airdrop_tx_id: result.airdrop_tx_id,
                airdrop_amount: '0.00625 LT',
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

            const wallets = this.walletService.listWallets(user.user_id);
            const balance = this.blockchain.getBalance(user.wallet_id);

            res.json({
                user: {
                    user_id: user.user_id,
                    nickname: user.nickname,
                    name: user.name,
                    surname: user.surname,
                    created_at: user.created_at,
                },
                wallet_id: user.wallet_id,
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

            const wallets = this.walletService.listWallets(user.user_id);
            const balance = this.blockchain.getBalance(user.wallet_id);

            res.json({
                user: {
                    user_id: user.user_id,
                    nickname: user.nickname,
                    name: user.name,
                    surname: user.surname,
                    created_at: user.created_at,
                },
                wallet_id: user.wallet_id,
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
                    user_id: u.user_id,
                    nickname: u.nickname,
                    name: u.name,
                    surname: u.surname,
                    created_at: u.created_at,
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
            const available = this.userService.isNicknameAvailable(nickname);

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
            const { from_wallet, to_wallet, message, sender_private_key, recipient_public_key } = req.body;

            if (!from_wallet || !to_wallet || !message || !sender_private_key || !recipient_public_key) {
                res.status(400).json({
                    error: 'from_wallet, to_wallet, message, sender_private_key, and recipient_public_key are required',
                });
                return;
            }

            // Encrypt message
            const { MessageEncryption } = require('../blockchain/crypto/MessageEncryption');
            const encryptedMessage = MessageEncryption.encryptMessage(
                message,
                recipient_public_key,
                sender_private_key
            );

            // Create transaction
            const { TransactionModel, TransactionType } = require('../blockchain/models/Transaction');
            const tx = TransactionModel.create(
                from_wallet,
                to_wallet,
                TransactionType.PRIVATE_MESSAGE,
                0, // No amount transfer
                0.00001, // Small fee
                {
                    encrypted_content: encryptedMessage.encrypted_content,
                    nonce: encryptedMessage.nonce,
                    ephemeral_public_key: encryptedMessage.ephemeral_public_key,
                    recipient_public_key,
                }
            );

            // Add to mempool
            const result = this.mempool.addTransaction(tx.toJSON());

            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }

            res.json({
                success: true,
                tx_id: tx.tx_id,
                message: 'Private message sent (encrypted)',
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Decrypt received private message
     */
    private async decryptPrivateMessage(req: Request, res: Response): Promise<void> {
        try {
            const { encrypted_content, nonce, ephemeral_public_key, private_key } = req.body;

            if (!encrypted_content || !nonce || !ephemeral_public_key || !private_key) {
                res.status(400).json({
                    error: 'encrypted_content, nonce, ephemeral_public_key, and private_key are required',
                });
                return;
            }

            // Decrypt message
            const { MessageEncryption } = require('../blockchain/crypto/MessageEncryption');
            const decrypted = MessageEncryption.decryptMessage(
                {
                    encrypted_content,
                    nonce,
                    ephemeral_public_key,
                },
                private_key
            );

            if (!decrypted) {
                res.status(400).json({ error: 'Failed to decrypt message' });
                return;
            }

            res.json({
                success: true,
                decrypted_message: decrypted,
            });
        } catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Generate new key pair for auth
     */
    private async generateKeys(req: Request, res: Response): Promise<void> {
        try {
            const keyPair = KeyManager.generateKeyPair();
            res.json({
                public_key: keyPair.publicKey,
                private_key: keyPair.privateKey
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
     * Start server
     */
    start(): void {
        this.app.listen(this.port, () => {
            console.log(`RPC Server listening on port ${this.port}`);
        });
    }

    /**
     * Get Express app instance
     */
    getApp(): express.Application {
        return this.app;
    }
}
