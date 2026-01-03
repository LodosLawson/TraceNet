import { KeyManager, WalletKeys } from '../blockchain/crypto/KeyManager';
import crypto from 'crypto';

/**
 * Wallet data structure
 */
export interface Wallet {
    wallet_id: string;
    user_id: string;
    public_key: string;               // Ed25519 signing public key
    encryption_public_key: string;    // Curve25519 encryption public key
    encrypted_private_key: string;
    mnemonic_encrypted?: string;
    created_at: number;
    is_first_wallet: boolean;
}

/**
 * Wallet service for multi-wallet management
 */
export class WalletService {
    private wallets: Map<string, Wallet>;
    private userWallets: Map<string, string[]>; // user_id -> wallet_ids[]
    private encryptionKey: string;

    constructor(encryptionKey: string) {
        this.wallets = new Map();
        this.userWallets = new Map();
        this.encryptionKey = encryptionKey;
    }

    /**
     * Create a new wallet (optionally for a user)
     */
    createWallet(userId?: string): {
        wallet: Wallet;
        mnemonic: string;
        privateKey: string;
        encryptionPublicKey: string;
        encryptionPrivateKey: string;
    } {
        // Generate wallet keys
        const walletKeys: WalletKeys = KeyManager.generateWalletFromMnemonic();

        // Determine user ID (use provided ID or wallet address)
        const effectiveUserId = userId || walletKeys.address;

        // Check if this is the first wallet for the user
        const userWalletList = this.userWallets.get(effectiveUserId) || [];
        const isFirstWallet = userWalletList.length === 0;

        // Encrypt private key and mnemonic
        const encryptedPrivateKey = KeyManager.encrypt(
            walletKeys.privateKey,
            this.encryptionKey
        );
        const encryptedMnemonic = KeyManager.encrypt(
            walletKeys.mnemonic,
            this.encryptionKey
        );

        // Create wallet object
        const wallet: Wallet = {
            wallet_id: walletKeys.address,
            user_id: effectiveUserId,
            public_key: walletKeys.publicKey,
            encryption_public_key: walletKeys.encryptionPublicKey,
            encrypted_private_key: encryptedPrivateKey,
            mnemonic_encrypted: encryptedMnemonic,
            created_at: Date.now(),
            is_first_wallet: isFirstWallet,
        };

        // Store wallet
        this.wallets.set(wallet.wallet_id, wallet);

        // Update user wallet list
        userWalletList.push(wallet.wallet_id);
        this.userWallets.set(effectiveUserId, userWalletList);

        return {
            wallet,
            mnemonic: walletKeys.mnemonic,
            privateKey: walletKeys.privateKey,
            encryptionPublicKey: walletKeys.encryptionPublicKey,
            encryptionPrivateKey: walletKeys.encryptionPrivateKey,
        };
    }

    /**
     * Import wallet from mnemonic
     */
    importWallet(
        userId: string,
        mnemonic: string
    ): {
        wallet: Wallet;
        privateKey: string;
    } {
        // Generate wallet from mnemonic
        const walletKeys: WalletKeys = KeyManager.generateWalletFromMnemonic(mnemonic);

        // Check if wallet already exists
        if (this.wallets.has(walletKeys.address)) {
            throw new Error('Wallet already exists');
        }

        // Check if this is the first wallet for the user
        const userWalletList = this.userWallets.get(userId) || [];
        const isFirstWallet = userWalletList.length === 0;

        // Encrypt private key and mnemonic
        const encryptedPrivateKey = KeyManager.encrypt(
            walletKeys.privateKey,
            this.encryptionKey
        );
        const encryptedMnemonic = KeyManager.encrypt(
            walletKeys.mnemonic,
            this.encryptionKey
        );

        // Create wallet object
        const wallet: Wallet = {
            wallet_id: walletKeys.address,
            user_id: userId,
            public_key: walletKeys.publicKey,
            encryption_public_key: walletKeys.encryptionPublicKey,
            encrypted_private_key: encryptedPrivateKey,
            mnemonic_encrypted: encryptedMnemonic,
            created_at: Date.now(),
            is_first_wallet: isFirstWallet,
        };

        // Store wallet
        this.wallets.set(wallet.wallet_id, wallet);

        // Update user wallet list
        userWalletList.push(wallet.wallet_id);
        this.userWallets.set(userId, userWalletList);

        return {
            wallet,
            privateKey: walletKeys.privateKey,
        };
    }

    /**
     * List all wallets for a user
     */
    listWallets(userId: string): Wallet[] {
        const walletIds = this.userWallets.get(userId) || [];
        return walletIds
            .map((id) => this.wallets.get(id))
            .filter((w): w is Wallet => w !== undefined);
    }

    /**
     * Get wallet by ID
     */
    getWallet(walletId: string): Wallet | undefined {
        return this.wallets.get(walletId);
    }

    /**
     * Get private key for a wallet (decrypted)
     */
    getPrivateKey(walletId: string): string | undefined {
        const wallet = this.wallets.get(walletId);
        if (!wallet) {
            return undefined;
        }

        try {
            return KeyManager.decrypt(wallet.encrypted_private_key, this.encryptionKey);
        } catch (error) {
            console.error('Failed to decrypt private key:', error);
            return undefined;
        }
    }

    /**
     * Get mnemonic for a wallet (decrypted)
     */
    getMnemonic(walletId: string): string | undefined {
        const wallet = this.wallets.get(walletId);
        if (!wallet || !wallet.mnemonic_encrypted) {
            return undefined;
        }

        try {
            return KeyManager.decrypt(wallet.mnemonic_encrypted, this.encryptionKey);
        } catch (error) {
            console.error('Failed to decrypt mnemonic:', error);
            return undefined;
        }
    }

    /**
     * Sign data with wallet's private key
     */
    signData(walletId: string, data: string): string | undefined {
        const privateKey = this.getPrivateKey(walletId);
        if (!privateKey) {
            return undefined;
        }

        return KeyManager.sign(data, privateKey);
    }

    /**
     * Verify signature
     */
    verifySignature(walletId: string, data: string, signature: string): boolean {
        const wallet = this.wallets.get(walletId);
        if (!wallet) {
            return false;
        }

        return KeyManager.verify(data, signature, wallet.public_key);
    }

    /**
     * Check if wallet belongs to user
     */
    isWalletOwnedByUser(walletId: string, userId: string): boolean {
        const wallet = this.wallets.get(walletId);
        return wallet?.user_id === userId;
    }

    /**
     * Get first wallet for user (for airdrop detection)
     */
    getFirstWallet(userId: string): Wallet | undefined {
        const wallets = this.listWallets(userId);
        return wallets.find((w) => w.is_first_wallet);
    }

    /**
     * Export wallets to JSON
     */
    toJSON(): Wallet[] {
        return Array.from(this.wallets.values());
    }

    /**
     * Import wallets from JSON
     */
    loadFromJSON(data: Wallet[]): void {
        this.wallets.clear();
        this.userWallets.clear();

        for (const wallet of data) {
            this.wallets.set(wallet.wallet_id, wallet);

            const userWalletList = this.userWallets.get(wallet.user_id) || [];
            userWalletList.push(wallet.wallet_id);
            this.userWallets.set(wallet.user_id, userWalletList);
        }
    }
    /**
     * Delete mnemonic (Crypto-Shredding)
     * CAUTION: Irreversible. Removes backup capability.
     */
    deleteMnemonic(walletId: string): void {
        const wallet = this.wallets.get(walletId);
        if (wallet) {
            wallet.mnemonic_encrypted = undefined;
            this.wallets.set(walletId, wallet);
        }
    }
}
