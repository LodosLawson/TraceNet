import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserInput, UpdateUserInput, UserRole, UserStatus, MetadataEntry } from './models/User';
import { AuthService } from '../auth/AuthService';
import { WalletService } from '../../wallet/WalletService';
import { AirdropService } from '../../wallet/AirdropService';
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

    constructor(
        walletService: WalletService,
        airdropService: AirdropService
    ) {
        this.users = new Map();
        this.emailIndex = new Map();
        this.nicknameIndex = new Map();
        this.walletService = walletService;
        this.airdropService = airdropService;
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

        // Trigger airdrop for first wallet
        const airdropTx = this.airdropService.createAirdropTransaction(
            system_id,
            walletResult.wallet.wallet_id
        );

        return {
            user,
            wallet: walletResult.wallet,
            mnemonic: walletResult.mnemonic,
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
                {
                    updates,
                    timestamp: Date.now(),
                }
            );

            tx_id = profileUpdateTx.tx_id;
            // In production, submit to blockchain node here
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
            const privacyUpdateTx = TransactionModel.create(
                user.wallet_ids[0],
                user.wallet_ids[0],
                TransactionType.PROFILE_UPDATE,
                0,
                0,
                {
                    updates: { messaging_privacy: privacy },
                    timestamp: Date.now(),
                }
            );
            // In production, submit to blockchain node here
            console.log(`Privacy update transaction created: ${privacyUpdateTx.tx_id}`);
        }

        return true;
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
