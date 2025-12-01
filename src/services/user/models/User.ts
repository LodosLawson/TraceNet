/**
 * User data model
 * All fields are optional except system_id (wallet address)
 * User data is stored on blockchain if provided
 */
export interface User {
    system_id: string;              // Wallet address (primary key)
    nickname?: string;              // Optional unique username
    email?: string;                 // Optional email
    first_name?: string;            // Optional first name
    last_name?: string;             // Optional last name
    birthday?: string;              // Optional ISO date (YYYY-MM-DD)
    profile_image_url?: string;     // Optional profile image
    encryption_public_key?: string; // Curve25519 public key for messaging
    messaging_privacy: 'public' | 'followers' | 'private';  // Messaging privacy setting
    metadata: MetadataEntry[];      // Versioned key-value pairs
    status: UserStatus;             // Online/offline status
    roles: UserRole[];              // User roles
    wallet_ids: string[];           // Associated blockchain wallets
    created_at: Date;               // Creation timestamp
    updated_at: Date;               // Last update timestamp
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
 * All fields are optional - user can provide as much or as little info as they want
 * Provided data will be stored on blockchain
 */
export interface CreateUserInput {
    nickname?: string;      // Optional username
    email?: string;         // Optional email
    first_name?: string;    // Optional first name
    last_name?: string;     // Optional last name
    birthday?: string;      // Optional birthday (YYYY-MM-DD)
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
    encryption_public_key?: string;  // Allow updating encryption key
    messaging_privacy?: 'public' | 'followers' | 'private';
}

/**
 * User profile response (public)
 */
export interface UserProfile {
    system_id: string;              // Wallet address
    nickname?: string;              // Optional username
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    encryption_public_key?: string;  // For messaging
    messaging_privacy: 'public' | 'followers' | 'private';
    status: UserStatus;
    roles: UserRole[];
    created_at: Date;
}
