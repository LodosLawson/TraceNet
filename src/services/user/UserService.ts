/**
 * User Service for managing user profiles and metadata
 */
export class UserService {
    private users: Map<string, User>;
    private emailIndex: Map<string, string>;      // email -> system_id
    private nicknameIndex: Map<string, string>;   // nickname -> system_id
    private authService: AuthService;
    private walletService: WalletService;
    private airdropService: AirdropService;

    constructor(
        authService: AuthService,
        walletService: WalletService,
        airdropService: AirdropService
    ) {
        this.users = new Map();
        this.emailIndex = new Map();
        this.nicknameIndex = new Map();
        this.authService = authService;
        this.walletService = walletService;
        this.airdropService = airdropService;
    }

    /**
     * Create a new user
     */
    async createUser(input: CreateUserInput): Promise<{
        user: User;
        wallet: any;
        mnemonic: string;
    }> {
        // Validate input
        const validation = this.authService.validateRegistrationInput(input);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Check if email already exists
        if (this.emailIndex.has(input.email)) {
            throw new Error('Email already registered');
        }

        // Check if nickname already exists
        if (this.nicknameIndex.has(input.nickname)) {
            throw new Error('Nickname already taken');
        }

        // Hash password
        const password_hash = await this.authService.hashPassword(input.password);

        // Create user
        const system_id = uuidv4();
        const user: User = {
            system_id,
            nickname: input.nickname,
            email: input.email,
            password_hash,
            first_name: input.first_name,
            last_name: input.last_name,
            birthday: input.birthday,
            metadata: [],
            status: UserStatus.ONLINE,
            roles: [UserRole.USER],
            wallet_ids: [],
            created_at: new Date(),
            updated_at: new Date(),
        };

        // Create first wallet
        const walletResult = this.walletService.createWallet(system_id);
        user.wallet_ids.push(walletResult.wallet.wallet_id);

        // Store user
        this.users.set(system_id, user);
        this.emailIndex.set(input.email, system_id);
        this.nicknameIndex.set(input.nickname, system_id);

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
}
