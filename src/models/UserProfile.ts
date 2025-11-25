import crypto from 'crypto';

/**
 * User profile interface
 */
export interface UserProfile {
    user_id: string;          // Unique user ID
    nickname: string;         // Unique nickname for social interactions
    name?: string;            // Optional first name
    surname?: string;         // Optional last name
    birth_date?: number;      // Optional birth date (timestamp)
    wallet_id: string;        // Primary wallet ID
    created_at: number;       // Creation timestamp
    profile_hash: string;     // Verification hash
}

/**
 * User profile input for creation
 */
export interface UserProfileInput {
    nickname: string;
    name?: string;
    surname?: string;
    birth_date?: number;
}

/**
 * User statistics
 */
export interface UserStats {
    posts_count: number;
    followers_count: number;
    following_count: number;
    total_likes_received: number;
}

/**
 * User profile model with validation
 */
export class UserProfileModel {
    profile: UserProfile;

    constructor(profile: UserProfile) {
        this.profile = profile;
    }

    /**
     * Create new user profile
     */
    static create(
        nickname: string,
        wallet_id: string,
        name?: string,
        surname?: string,
        birth_date?: number
    ): UserProfileModel {
        const user_id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();

        // Generate profile hash for verification
        const profile_data = `${user_id}${nickname}${wallet_id}${timestamp}`;
        const profile_hash = crypto.createHash('sha256').update(profile_data).digest('hex');

        const profile: UserProfile = {
            user_id,
            nickname: nickname.toLowerCase().trim(),
            name: name?.trim(),
            surname: surname?.trim(),
            birth_date,
            wallet_id,
            created_at: timestamp,
            profile_hash,
        };

        return new UserProfileModel(profile);
    }

    /**
     * Validate user profile
     */
    validate(): { valid: boolean; error?: string } {
        // Validate nickname
        if (!this.profile.nickname || this.profile.nickname.length < 3) {
            return { valid: false, error: 'Nickname must be at least 3 characters' };
        }

        if (this.profile.nickname.length > 20) {
            return { valid: false, error: 'Nickname must be at most 20 characters' };
        }

        // Nickname should only contain alphanumeric and underscore
        if (!/^[a-z0-9_]+$/.test(this.profile.nickname)) {
            return {
                valid: false,
                error: 'Nickname can only contain lowercase letters, numbers, and underscores',
            };
        }

        // Reserved nicknames
        const reserved = ['admin', 'system', 'root', 'moderator', 'official', 'tracenet'];
        if (reserved.includes(this.profile.nickname)) {
            return { valid: false, error: 'This nickname is reserved' };
        }

        // Validate name if provided
        if (this.profile.name && this.profile.name.length > 50) {
            return { valid: false, error: 'Name must be at most 50 characters' };
        }

        // Validate surname if provided
        if (this.profile.surname && this.profile.surname.length > 50) {
            return { valid: false, error: 'Surname must be at most 50 characters' };
        }

        // Validate birth date if provided
        if (this.profile.birth_date) {
            const birthDate = new Date(this.profile.birth_date);
            const now = new Date();
            const age = now.getFullYear() - birthDate.getFullYear();

            if (age < 13) {
                return { valid: false, error: 'User must be at least 13 years old' };
            }

            if (age > 150) {
                return { valid: false, error: 'Invalid birth date' };
            }
        }

        return { valid: true };
    }

    /**
     * Convert to JSON
     */
    toJSON(): UserProfile {
        return { ...this.profile };
    }

    /**
     * Get public profile (without sensitive info)
     */
    getPublicProfile(): Partial<UserProfile> {
        return {
            user_id: this.profile.user_id,
            nickname: this.profile.nickname,
            name: this.profile.name,
            surname: this.profile.surname,
            created_at: this.profile.created_at,
        };
    }
}
