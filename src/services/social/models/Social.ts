/**
 * Post data model
 */
export interface Post {
    post_id: string;                // UUID
    author_id: string;              // User system_id
    content_text: string;
    media_hashes: MediaHash[];      // SHA256 hashes of media
    media_urls: string[];           // CDN URLs
    timestamp: Date;
    visibility: PostVisibility;
    like_count: number;
    comment_count: number;
    share_count: number;
    tx_id?: string;                 // On-chain transaction ID
    status: PostStatus;
    created_at: Date;
    updated_at: Date;
}

/**
 * Media hash with metadata
 */
export interface MediaHash {
    hash: string;                   // SHA256
    url: string;                    // CDN URL
    size: number;
    content_type: string;
}

/**
 * Post visibility enum
 */
export enum PostVisibility {
    PUBLIC = 'public',
    FOLLOWERS = 'followers',
    PRIVATE = 'private'
}

/**
 * Post status enum
 */
export enum PostStatus {
    PENDING_MODERATION = 'pending_moderation',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    FLAGGED = 'flagged'
}

/**
 * Like model
 */
export interface Like {
    like_id: string;
    post_id: string;
    user_id: string;
    timestamp: Date;
    tx_id?: string;                 // On-chain LIKE transaction
    created_at: Date;
}

/**
 * Comment model
 */
export interface Comment {
    comment_id: string;
    post_id: string;
    author_id: string;
    content: string;
    timestamp: Date;
    tx_id?: string;
    created_at: Date;
}

/**
 * Follow model
 */
export interface Follow {
    follow_id: string;
    follower_id: string;            // Who is following
    following_id: string;           // Who is being followed
    timestamp: Date;
    tx_id: string;                  // On-chain FOLLOW transaction
    created_at: Date;
}

/**
 * Share model
 */
export interface Share {
    share_id: string;
    post_id: string;
    user_id: string;
    timestamp: Date;
    tx_id?: string;
    created_at: Date;
}

/**
 * Create post input
 */
export interface CreatePostInput {
    author_id: string;
    content_text: string;
    media_files?: any[];
    visibility?: PostVisibility;
}

/**
 * Post with author info
 */
export interface PostWithAuthor extends Post {
    author: {
        system_id: string;
        nickname: string;
        profile_image_url?: string;
    };
    is_liked_by_user?: boolean;
}
