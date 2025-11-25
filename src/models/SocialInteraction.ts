/**
 * Social interaction types
 */
export enum SocialActionType {
    LIKE = 'LIKE',
    COMMENT = 'COMMENT',
    SHARE = 'SHARE',
    FOLLOW = 'FOLLOW',
    UNFOLLOW = 'UNFOLLOW',
}

/**
 * Social interaction data structure
 */
export interface SocialInteraction {
    interaction_id: string;
    action_type: SocialActionType;
    wallet_id: string; // Who performed the action
    target_content_id?: string; // For likes, comments, shares
    target_wallet_id?: string; // For follows
    parent_id?: string; // For comment threads
    interaction_data?: any; // Comment text, etc.
    timestamp: number;
}

/**
 * Comment-specific data
 */
export interface CommentData {
    comment_text: string;
    content_id: string;
    parent_comment_id?: string; // For replies
}

/**
 * Like-specific data
 */
export interface LikeData {
    content_id: string;
}

/**
 * Share-specific data
 */
export interface ShareData {
    content_id: string;
    share_message?: string;
}

/**
 * Follow-specific data
 */
export interface FollowData {
    target_wallet_id: string;
    target_nickname?: string;
}
