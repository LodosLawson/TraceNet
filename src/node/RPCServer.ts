import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from './Mempool';
import { WalletService } from '../wallet/WalletService';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { TransactionModel, Transaction } from '../blockchain/models/Transaction';
import { KeyManager } from '../blockchain/crypto/KeyManager';

/**
 * RPC Server for blockchain node
 */
export class RPCServer {
    private app: express.Application;
    private blockchain: Blockchain;
    private mempool: Mempool;
    private walletService: WalletService;
    private validatorPool: ValidatorPool;
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
        this.app.get('/rpc/balance/:walletId', this.getBalance.bind(this));

        // Wallet API endpoints
        this.app.post('/api/wallet/create', this.createWallet.bind(this));
        this.app.get('/api/wallet/list/:userId', this.listWallets.bind(this));
        this.app.get('/api/wallet/:walletId', this.getWallet.bind(this));
        this.app.post('/api/wallet/sign', this.signTransaction.bind(this));

        // Validator endpoints
        this.app.post('/api/validator/register', this.registerValidator.bind(this));
        this.app.post('/api/validator/heartbeat', this.validatorHeartbeat.bind(this));
        this.app.get('/api/validator/list', this.listValidators.bind(this));

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

            res.json({
                blockchain: blockchainStats,
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
     * Get wallet balance
     */
    private async getBalance(req: Request, res: Response): Promise<void> {
        try {
            const { walletId } = req.params;

            const balance = this.blockchain.getBalance(walletId);

            res.json({
                wallet_id: walletId,
                balance,
                timestamp: Date.now(),
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
            const { user_id } = req.body;

            if (!user_id) {
                res.status(400).json({ error: 'user_id is required' });
                return;
            }

            const result = this.walletService.createWallet(user_id);

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
