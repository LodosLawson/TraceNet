/**
 * User data model
 */
export interface User {
    system_id: string;              // UUID (primary key)
    nickname: string;               // Unique username
    email: string;                  // Email (unique)
    password_hash: string;          // Bcrypt hash
    first_name?: string;
    last_name?: string;
    birthday?: string;              // ISO date (YYYY-MM-DD)
    profile_image_url?: string;
    metadata: MetadataEntry[];      // Versioned key-value pairs
    status: UserStatus;
    roles: UserRole[];
    wallet_ids: string[];           // Associated blockchain wallets
    created_at: Date;
    updated_at: Date;
}

/**
 * Versioned metadata entry
 */
export interface MetadataEntry {
    key: string;
    value: any;
    version: number;
    updated_at: Date;
}

/**
 * User status enum
 */
export enum UserStatus {
    ONLINE = 'online',
    OFFLINE = 'offline',
    LAST_SEEN = 'last_seen'
}

/**
 * User role enum
 */
export enum UserRole {
    USER = 'user',
    VALIDATOR = 'validator',
    ADMIN = 'admin'
}

/**
 * User creation input
 */
export interface CreateUserInput {
    nickname: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    birthday?: string;
}

/**
 * User update input
 */
export interface UpdateUserInput {
    nickname?: string;
    first_name?: string;
    last_name?: string;
    birthday?: string;
    profile_image_url?: string;
}

/**
 * User profile response (public)
 */
export interface UserProfile {
    system_id: string;
    nickname: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    status: UserStatus;
    roles: UserRole[];
    created_at: Date;
}
