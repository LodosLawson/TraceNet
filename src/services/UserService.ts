import { WalletService, Wallet } from '../wallet/WalletService';
import { UserProfile, UserProfileModel, UserProfileInput } from '../models/UserProfile';
import { AirdropService } from '../wallet/AirdropService';
import { Mempool } from '../node/Mempool';

/**
 * User service for managing user profiles and wallets together
 */
export class UserService {
    private users: Map<string, UserProfile>; // user_id -> profile
    private nicknameIndex: Map<string, string>; // nickname -> user_id
    private walletService: WalletService;
    private airdropService: AirdropService;
    private mempool?: Mempool;

    constructor(walletService: WalletService, airdropService: AirdropService) {
        this.users = new Map();
        this.nicknameIndex = new Map();
        this.walletService = walletService;
        this.airdropService = airdropService;
    }

    /**
     * Set mempool reference for airdrop transactions
     */
    setMempool(mempool: Mempool): void {
        this.mempool = mempool;
    }

    /**
     * Create user with profile and wallet
     */
    createUser(input: UserProfileInput): {
        user: UserProfile;
        wallet: Wallet;
        mnemonic: string;
        privateKey: string;
        airdrop_tx_id?: string;
    } {
        // Validate nickname uniqueness
        const lowercaseNickname = input.nickname.toLowerCase().trim();
        if (this.nicknameIndex.has(lowercaseNickname)) {
            throw new Error(`Nickname '${input.nickname}' is already taken`);
        }

        // Create wallet first
        const walletResult = this.walletService.createWallet(`temp_${Date.now()}`);

        // Create user profile
        const userModel = UserProfileModel.create(
            input.nickname,
            walletResult.wallet.wallet_id,
            input.name,
            input.surname,
            input.birth_date
        );

        // Validate profile
        const validation = userModel.validate();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const userProfile = userModel.toJSON();

        // Update wallet's user_id to match profile user_id
        walletResult.wallet.user_id = userProfile.user_id;

        // Store user profile
        this.users.set(userProfile.user_id, userProfile);
        this.nicknameIndex.set(lowercaseNickname, userProfile.user_id);

        // Create airdrop transaction for first wallet
        const airdropTx = this.airdropService.createAirdropTransaction(
            userProfile.user_id,
            walletResult.wallet.wallet_id
        );

        let airdrop_tx_id: string | undefined;
        if (airdropTx && this.mempool) {
            const airdropResult = this.mempool.addTransaction(airdropTx.toJSON());
            if (airdropResult.success) {
                airdrop_tx_id = airdropTx.tx_id;
                this.airdropService.confirmAirdrop(userProfile.user_id);
            }
        }

        return {
            user: userProfile,
            wallet: walletResult.wallet,
            mnemonic: walletResult.mnemonic,
            privateKey: walletResult.privateKey,
            airdrop_tx_id,
        };
    }

    /**
     * Get user by user_id
     */
    getUser(userId: string): UserProfile | undefined {
        return this.users.get(userId);
    }

    /**
     * Get user by nickname
     */
    getUserByNickname(nickname: string): UserProfile | undefined {
        const lowercaseNickname = nickname.toLowerCase().trim();
        const userId = this.nicknameIndex.get(lowercaseNickname);
        if (!userId) {
            return undefined;
        }
        return this.users.get(userId);
    }

    /**
     * Get user by wallet_id
     */
    getUserByWallet(walletId: string): UserProfile | undefined {
        const wallet = this.walletService.getWallet(walletId);
        if (!wallet) {
            return undefined;
        }
        return this.users.get(wallet.user_id);
    }

    /**
     * Check if nickname is available
     */
    isNicknameAvailable(nickname: string): boolean {
        const lowercaseNickname = nickname.toLowerCase().trim();
        return !this.nicknameIndex.has(lowercaseNickname);
    }

    /**
     * Search users by nickname (partial match)
     */
    searchUsers(query: string, limit: number = 20): UserProfile[] {
        const lowercaseQuery = query.toLowerCase().trim();
        const results: UserProfile[] = [];

        for (const [nickname, userId] of this.nicknameIndex.entries()) {
            if (nickname.includes(lowercaseQuery)) {
                const user = this.users.get(userId);
                if (user) {
                    results.push(user);
                }
                if (results.length >= limit) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * Get user stats
     */
    getUserStats(userId: string): {
        user_id: string;
        nickname: string;
        total_wallets: number;
        created_at: number;
    } | undefined {
        const user = this.users.get(userId);
        if (!user) {
            return undefined;
        }

        const wallets = this.walletService.listWallets(userId);

        return {
            user_id: user.user_id,
            nickname: user.nickname,
            total_wallets: wallets.length,
            created_at: user.created_at,
        };
    }

    /**
     * Get all users (for admin/debugging)
     */
    getAllUsers(): UserProfile[] {
        return Array.from(this.users.values());
    }

    /**
     * Export users to JSON
     */
    toJSON(): UserProfile[] {
        return Array.from(this.users.values());
    }

    /**
     * Import users from JSON
     */
    loadFromJSON(data: UserProfile[]): void {
        this.users.clear();
        this.nicknameIndex.clear();

        for (const user of data) {
            this.users.set(user.user_id, user);
            this.nicknameIndex.set(user.nickname.toLowerCase(), user.user_id);
        }
    }

    /**
     * Get total user count
     */
    getUserCount(): number {
        return this.users.size;
    }
}
