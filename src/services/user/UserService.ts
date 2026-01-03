import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserInput, UpdateUserInput, UserRole, UserStatus, MetadataEntry } from './models/User';
import { AuthService } from '../auth/AuthService';
import { WalletService } from '../../wallet/WalletService';
import { AirdropService } from '../../wallet/AirdropService';
import { Mempool } from '../../node/Mempool';
import { TransactionModel, TransactionType } from '../../blockchain/models/Transaction';

/**
 * User Service for managing user profiles and metadata
 */
export class UserService {
    private users: Map<string, User>;
    private emailIndex: Map<string, string>;      // email -> system_id
    private nicknameIndex: Map<string, string>;   // nickname -> system_id
    private walletService: WalletService;
    private airdropService: AirdropService;
    private mempool: Mempool;

    constructor(
        walletService: WalletService,
        airdropService: AirdropService,
        mempool: Mempool
    ) {
        this.users = new Map();
        this.emailIndex = new Map();
        this.nicknameIndex = new Map();
        this.walletService = walletService;
        this.airdropService = airdropService;
        this.mempool = mempool;
    }

    /**
     * Create new user with optional profile data
     * All fields are optional - user can provide as much or as little info as they want
     * System ID will be the wallet address
     */
    async createUser(input: CreateUserInput): Promise<{
        user: User;
        wallet: any;
        mnemonic: string;
        airdropAmount?: number;
    }> {
        // Optional validation: Check if nickname already exists (if provided)
        if (input.nickname && this.nicknameIndex.has(input.nickname)) {
            throw new Error('Nickname already taken');
        }

        // Optional validation: Check if email already exists (if provided)
        if (input.email && this.emailIndex.has(input.email)) {
            throw new Error('Email already registered');
        }

        // Create wallet first (24-word mnemonic)
        const walletResult = this.walletService.createWallet();

        // Use wallet address as system_id
        const system_id = walletResult.wallet.wallet_id;

        // Create user with optional fields
        const user: User = {
            system_id,                      // Wallet address (primary key)
            nickname: input.nickname,       // Optional
            email: input.email,             // Optional
            first_name: input.first_name,   // Optional
            last_name: input.last_name,     // Optional
            birthday: input.birthday,       // Optional
            encryption_public_key: walletResult.encryptionPublicKey,  // From wallet
            messaging_privacy: 'public',    // Default privacy setting
            metadata: [],
            status: UserStatus.OFFLINE,     // Default status
            roles: [UserRole.USER],         // Default role
            wallet_ids: [walletResult.wallet.wallet_id],
            created_at: new Date(),
            updated_at: new Date(),
        };

        // Store user
        this.users.set(system_id, user);

        // Index nickname if provided
        if (input.nickname) {
            this.nicknameIndex.set(input.nickname, system_id);
        }

        // Index email if provided
        if (input.email) {
            this.emailIndex.set(input.email, system_id);
        }

        // 🆕 CREATE PROFILE_UPDATE TRANSACTION FOR USER CREATION (BLOCKCHAIN RECORD)
        const profileCreationTx = TransactionModel.create(
            walletResult.wallet.wallet_id,
            walletResult.wallet.wallet_id,
            TransactionType.PROFILE_UPDATE,
            0,
            0, // No fee for initial profile creation
            1, // Nonce: Must be 1 for new user (Account Nonce 0 -> Expected 1)
            {
                action: 'USER_CREATED',
                public_key: walletResult.wallet.public_key, // 🆕 Add Public Key to State
                encryption_public_key: walletResult.encryptionPublicKey, // ← BLOCKCHAIN'DE!
                nickname: input.nickname,
                email: input.email,
                first_name: input.first_name,
                last_name: input.last_name,
                messaging_privacy: 'public',
                created_at: Date.now(),
            }
        );



        // Sign the transaction
        // Set public key BEFORE signing so it's included in signable data
        profileCreationTx.sender_public_key = walletResult.wallet.public_key;

        // Sign the transaction
        const signableData = profileCreationTx.getSignableData();
        const signature = this.walletService.signData(walletResult.wallet.wallet_id, signableData);

        if (signature) {
            profileCreationTx.sender_signature = signature;
        } else {
            console.warn(`Failed to sign profile creation transaction for ${walletResult.wallet.wallet_id}`);
        }

        // Add profile creation to mempool
        const profileResult = this.mempool.addTransaction(profileCreationTx);
        if (!profileResult.success) {
            console.error(`Failed to add profile creation transaction: ${profileResult.error}`);
        } else {
            console.log(`Profile creation transaction added: ${profileCreationTx.tx_id}`);
        }

        // Trigger airdrop for first wallet
        const airdropTx = this.airdropService.createAirdropTransaction(
            system_id,
            walletResult.wallet.wallet_id
        );

        // Add airdrop transaction to mempool to trigger block production
        if (airdropTx) {
            const result = this.mempool.addTransaction(airdropTx.toJSON());
            if (!result.success) {
                console.error(`Failed to add airdrop transaction to mempool: ${result.error}`);
            } else {
                console.log(`Airdrop transaction added to mempool: ${airdropTx.tx_id}`);
            }
        }

        return {
            user,
            wallet: walletResult.wallet,
            mnemonic: walletResult.mnemonic,
            airdropAmount: this.airdropService['airdropAmount'] // Access private property or add getter - strictly for this fix
        };
    }

    /**
     * Get user by system_id
     */
    getUser(system_id: string): User | undefined {
        return this.users.get(system_id);
    }

    /**
     * Get user by email
     */
    getUserByEmail(email: string): User | undefined {
        const system_id = this.emailIndex.get(email);
        return system_id ? this.users.get(system_id) : undefined;
    }

    /**
     * Get user by nickname
     */
    getUserByNickname(nickname: string): User | undefined {
        const system_id = this.nicknameIndex.get(nickname);
        return system_id ? this.users.get(system_id) : undefined;
    }

    /**
     * Get user by wallet ID
     */
    getUserByWallet(wallet_id: string): User | undefined {
        for (const user of this.users.values()) {
            if (user.wallet_ids.includes(wallet_id)) {
                return user;
            }
        }
        return undefined;
    }

    /**
     * Get user stats
     */
    getUserStats(): any {
        return {
            total_users: this.users.size,
            total_wallets: Array.from(this.users.values()).reduce((acc, u) => acc + u.wallet_ids.length, 0),
        };
    }

    /**
     * Get user count
     */
    getUserCount(): number {
        return this.users.size;
    }

    /**
     * Update user profile (creates on-chain PROFILE_UPDATE transaction)
     */
    async updateProfile(
        system_id: string,
        updates: UpdateUserInput
    ): Promise<{ user: User; tx_id?: string }> {
        const user = this.users.get(system_id);
        if (!user) {
            throw new Error('User not found');
        }

        // Check nickname uniqueness if updating
        if (updates.nickname && updates.nickname !== user.nickname) {
            if (this.nicknameIndex.has(updates.nickname)) {
                throw new Error('Nickname already taken');
            }

            // Update nickname index
            this.nicknameIndex.delete(user.nickname);
            this.nicknameIndex.set(updates.nickname, system_id);
        }

        // Apply updates
        const updatedUser: User = {
            ...user,
            ...updates,
            updated_at: new Date(),
        };

        this.users.set(system_id, updatedUser);

        // Create on-chain PROFILE_UPDATE transaction
        let tx_id: string | undefined;
        if (user.wallet_ids.length > 0) {
            const profileUpdateTx = TransactionModel.create(
                user.wallet_ids[0],
                user.wallet_ids[0],
                TransactionType.PROFILE_UPDATE,
                0,
                0,
                0, // Nonce
                {
                    updates,
                    timestamp: Date.now(),
                }
            );

            // Sign the transaction
            const signableData = profileUpdateTx.getSignableData();
            const signature = this.walletService.signData(user.wallet_ids[0], signableData);

            if (signature) {
                profileUpdateTx.sender_signature = signature;
                // We need to fetch the wallet to get the public key, or store it on user?
                // User model doesn't strictly store signing public key (only encryption public key).
                // But WalletService has it.
                const wallet = this.walletService.getWallet(user.wallet_ids[0]);
                if (wallet) {
                    profileUpdateTx.sender_public_key = wallet.public_key;
                }
            } else {
                console.warn(`Failed to sign profile update transaction for ${user.wallet_ids[0]}`);
            }

            tx_id = profileUpdateTx.tx_id;
            // In production, submit to blockchain node here
            const result = this.mempool.addTransaction(profileUpdateTx);
            if (!result.success) {
                console.error(`Failed to add profile update transaction: ${result.error}`);
            } else {
                console.log(`Profile update transaction added: ${profileUpdateTx.tx_id}`);
            }
        }

        return { user: updatedUser, tx_id };
    }

    /**
     * Update user metadata (versioned)
     */
    updateMetadata(
        system_id: string,
        key: string,
        value: any
    ): User | undefined {
        const user = this.users.get(system_id);
        if (!user) {
            return undefined;
        }

        // Find existing metadata entry
        const existingIndex = user.metadata.findIndex((m) => m.key === key);

        if (existingIndex >= 0) {
            // Update existing entry with new version
            const currentVersion = user.metadata[existingIndex].version;
            user.metadata[existingIndex] = {
                key,
                value,
                version: currentVersion + 1,
                updated_at: new Date(),
            };
        } else {
            // Add new metadata entry
            user.metadata.push({
                key,
                value,
                version: 1,
                updated_at: new Date(),
            });
        }

        user.updated_at = new Date();
        this.users.set(system_id, user);

        return user;
    }

    /**
     * Get metadata value
     */
    getMetadata(system_id: string, key: string): MetadataEntry | undefined {
        const user = this.users.get(system_id);
        if (!user) {
            return undefined;
        }

        return user.metadata.find((m) => m.key === key);
    }

    /**
     * Update user status
     */
    updateStatus(system_id: string, status: UserStatus): void {
        const user = this.users.get(system_id);
        if (user) {
            user.status = status;
            user.updated_at = new Date();
            this.users.set(system_id, user);
        }
    }

    /**
     * Add role to user
     */
    addRole(system_id: string, role: UserRole): void {
        const user = this.users.get(system_id);
        if (user && !user.roles.includes(role)) {
            user.roles.push(role);
            user.updated_at = new Date();
            this.users.set(system_id, user);
        }
    }

    /**
     * Remove role from user
     */
    removeRole(system_id: string, role: UserRole): void {
        const user = this.users.get(system_id);
        if (user) {
            user.roles = user.roles.filter((r) => r !== role);
            user.updated_at = new Date();
            this.users.set(system_id, user);
        }
    }

    /**
     * Search users by nickname
     */
    searchUsers(query: string, limit: number = 20): User[] {
        const results: User[] = [];
        const lowerQuery = query.toLowerCase();

        for (const user of this.users.values()) {
            if (user.nickname.toLowerCase().includes(lowerQuery)) {
                results.push(user);
                if (results.length >= limit) break;
            }
        }

        return results;
    }

    /**
     * Get all users (admin only)
     */
    getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    /**
     * Get user's encryption public key by identifier (user_id, nickname, or wallet_id)
     */
    getEncryptionPublicKey(identifier: string): {
        user_id: string;
        nickname: string;
        wallet_id: string;
        encryption_public_key: string;
        messaging_privacy: string;
    } | undefined {
        // Try as user_id first
        let user = this.users.get(identifier);

        // Try as nickname
        if (!user) {
            user = this.getUserByNickname(identifier);
        }

        // Try as wallet_id
        if (!user) {
            for (const u of this.users.values()) {
                if (u.wallet_ids.includes(identifier)) {
                    user = u;
                    break;
                }
            }
        }

        if (!user || !user.encryption_public_key || user.wallet_ids.length === 0) {
            return undefined;
        }

        // Check privacy settings
        if (user.messaging_privacy === 'private') {
            return undefined;
        }

        // If 'followers', we should check if the requester is a follower.
        // However, this method is often called to just get the key.
        // The actual enforcement happens in 'canReceiveMessageFrom' or 'sendPrivateMessage'.
        // But if privacy is 'private', we definitely shouldn't return the key.

        return {
            user_id: user.system_id,
            nickname: user.nickname,
            wallet_id: user.wallet_ids[0],
            encryption_public_key: user.encryption_public_key,
            messaging_privacy: user.messaging_privacy
        };
    }

    /**
     * Update messaging privacy setting
     */
    updateMessagingPrivacy(system_id: string, privacy: 'public' | 'followers' | 'private'): boolean {
        const user = this.users.get(system_id);
        if (!user) {
            return false;
        }

        user.messaging_privacy = privacy;
        user.updated_at = new Date();
        this.users.set(system_id, user);

        // Create blockchain transaction for privacy update
        if (user.wallet_ids.length > 0) {
            const { TOKEN_CONFIG } = require('../../economy/TokenConfig');
            const privacyUpdateTx = TransactionModel.create(
                user.wallet_ids[0],
                user.wallet_ids[0], // Self-transaction
                TransactionType.PROFILE_UPDATE,
                0,
                TOKEN_CONFIG.PRIVACY_UPDATE_FEE,
                0, // Nonce
                {
                    updates: { messaging_privacy: privacy },
                    timestamp: Date.now(),
                }
            );



            // Sign the transaction
            const signableData = privacyUpdateTx.getSignableData();
            const signature = this.walletService.signData(user.wallet_ids[0], signableData);

            if (signature) {
                privacyUpdateTx.sender_signature = signature;
                // Get public key from wallet service
                const wallet = this.walletService.getWallet(user.wallet_ids[0]);
                if (wallet) {
                    privacyUpdateTx.sender_public_key = wallet.public_key;
                }
            } else {
                console.warn(`Failed to sign privacy update transaction for ${user.wallet_ids[0]}`);
            }

            // Add to mempool
            const result = this.mempool.addTransaction(privacyUpdateTx);
            if (!result.success) {
                console.error(`Failed to add privacy update transaction: ${result.error}`);
                // In a real scenario, we might want to revert the local state change if tx fails
                // But for now we keep it consistent with existing pattern
            } else {
                console.log(`Privacy update transaction added: ${privacyUpdateTx.tx_id}`);
            }
        }

        return true;
    }

    /**
     * Rotate encryption key
     * Generates a new Curve25519 key pair and updates the user profile
     */
    rotateEncryptionKey(system_id: string, shredHistory: boolean = false, clientProvidedPublicKey?: string): { success: boolean; newPublicKey?: string; newPrivateKey?: string; error?: string } {
        const user = this.users.get(system_id);
        if (!user) {
            return { success: false, error: 'User not found' };
        }

        try {
            let newPublicKey: string;
            let newPrivateKey: string | undefined;

            if (clientProvidedPublicKey) {
                // Client generated key pair - preferred for security
                newPublicKey = clientProvidedPublicKey;
                // Private key is unknown to server
            } else {
                // Server generated key pair (Legacy/Fallback)
                const nacl = require('tweetnacl');
                const util = require('tweetnacl-util');

                const newKeyPair = nacl.box.keyPair();
                newPublicKey = util.encodeBase64(newKeyPair.publicKey);
                newPrivateKey = util.encodeBase64(newKeyPair.secretKey);
            }

            user.encryption_public_key = newPublicKey;
            user.updated_at = new Date();
            this.users.set(system_id, user);

            // Crypto-Shredding Logic
            if (shredHistory && user.wallet_ids.length > 0) {
                for (const walletId of user.wallet_ids) {
                    this.walletService.deleteMnemonic(walletId);
                }
                console.log(`[Crypto-Shredding] Mnemonic deleted for user ${system_id}`);
            }


            // Create blockchain transaction for key rotation
            if (user.wallet_ids.length > 0) {
                const { TOKEN_CONFIG } = require('../../economy/TokenConfig');
                const keyRotationTx = TransactionModel.create(
                    user.wallet_ids[0],
                    user.wallet_ids[0],
                    TransactionType.PROFILE_UPDATE,
                    0,
                    TOKEN_CONFIG.KEY_ROTATION_FEE,
                    0, // Nonce
                    {
                        updates: { encryption_public_key: newPublicKey },
                        action: 'KEY_ROTATION',
                        timestamp: Date.now(),
                    }
                );

                // Sign the transaction
                const signableData = keyRotationTx.getSignableData();
                const signature = this.walletService.signData(user.wallet_ids[0], signableData);

                if (signature) {
                    keyRotationTx.sender_signature = signature;
                    const wallet = this.walletService.getWallet(user.wallet_ids[0]);
                    if (wallet) {
                        keyRotationTx.sender_public_key = wallet.public_key;
                    }
                } else {
                    console.warn(`Failed to sign key rotation transaction for ${user.wallet_ids[0]}`);
                }

                const result = this.mempool.addTransaction(keyRotationTx);
                if (!result.success) {
                    console.error(`Failed to add key rotation transaction: ${result.error}`);
                } else {
                    console.log(`Key rotation transaction added: ${keyRotationTx.tx_id}`);
                }
            }

            return {
                success: true,
                newPublicKey,
                // We return the private key here so the user can update their local storage
                // In a real app, this response would be sent over a secure channel
                // and the user would be prompted to save it immediately.
                // @ts-ignore - Adding dynamic property for return
                newPrivateKey
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    /**
     * Check if a user can receive messages from a specific wallet
     */
    canReceiveMessageFrom(system_id: string, senderWallet: string): boolean {
        const user = this.users.get(system_id);
        if (!user) {
            return false;
        }

        // Check privacy setting
        if (user.messaging_privacy === 'public') {
            return true;
        }

        if (user.messaging_privacy === 'private') {
            return false;
        }

        // For 'followers' privacy, would need to check follow relationship
        // Simplified for now - return false
        return false;
    }

    /**
     * Generate QR code data for messaging
     */
    generateQRCodeData(system_id: string): {
        type: string;
        nickname: string;
        wallet_id: string;
        encryption_public_key: string;
        messaging_privacy: string;
    } | undefined {
        const user = this.users.get(system_id);
        if (!user || !user.encryption_public_key || user.wallet_ids.length === 0) {
            return undefined;
        }

        return {
            type: 'tracenet_messaging',
            nickname: user.nickname,
            wallet_id: user.wallet_ids[0],
            encryption_public_key: user.encryption_public_key,
            messaging_privacy: user.messaging_privacy
        };
    }

    /**
     * Export users to JSON
     */
    toJSON(): User[] {
        return Array.from(this.users.values());
    }

    /**
     * Import users from JSON
     */
    loadFromJSON(data: User[]): void {
        this.users.clear();
        this.emailIndex.clear();
        this.nicknameIndex.clear();

        for (const user of data) {
            this.users.set(user.system_id, user);
            this.emailIndex.set(user.email, user.system_id);
            this.nicknameIndex.set(user.nickname, user.system_id);
        }
    }
    /**
     * Check if nickname is available
     */
    isNicknameAvailable(nickname: string): boolean {
        return !this.nicknameIndex.has(nickname);
    }
}
