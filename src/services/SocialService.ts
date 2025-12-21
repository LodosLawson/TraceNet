import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from '../node/Mempool';
import { TransactionModel, TransactionType, Transaction } from '../blockchain/models/Transaction';
import { TOKEN_CONFIG, TREASURY_ADDRESSES } from '../economy/TokenConfig';
import { ContentService } from './ContentService';
import crypto from 'crypto';

/**
 * Like action options
 */
export interface LikeContentOptions {
    wallet_id: string;
    content_id: string;
}

/**
 * Comment action options
 */
export interface CommentContentOptions {
    wallet_id: string;
    content_id: string;
    comment_text: string;
    parent_comment_id?: string; // For replies
}

/**
 * Follow action options
 */
export interface FollowUserOptions {
    wallet_id: string;
    target_wallet_id: string;
}

/**
 * Social Service
 * Manages social interactions with fee splitting (50% creator, 50% blockchain)
 */
export class SocialService {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private contentService?: ContentService;

    constructor(blockchain: Blockchain, mempool: Mempool) {
        this.blockchain = blockchain;
        this.mempool = mempool;
    }

    /**
     * Set content service for content lookup
     */
    setContentService(contentService: ContentService): void {
        this.contentService = contentService;
    }

    /**
     * Like content
     * Fee: 0.00001 LT (50% to content creator, 50% to blockchain)
     */
    likeContent(options: LikeContentOptions): {
        tx_id: string;
        success: boolean;
        fee_paid: number;
        creator_received: number;
        treasury_received: number;
    } {
        // Get content to find creator
        if (!this.contentService) {
            throw new Error('Content service not initialized');
        }

        const content = this.contentService.getContent(options.content_id);
        if (!content) {
            throw new Error('Content not found');
        }

        // Check if user already liked
        if (this.hasUserLiked(options.wallet_id, options.content_id)) {
            throw new Error('You have already liked this content');
        }

        const totalFee = TOKEN_CONFIG.LIKE_FEE; // 1000 = 0.00001 LT
        const creatorAmount = Math.floor(totalFee * 0.5); // 50%
        const treasuryAmount = totalFee - creatorAmount; // 50%

        // Create LIKE transaction to content creator (50%)
        const likeTransaction = TransactionModel.create(
            options.wallet_id,
            content.owner_wallet, // 50% goes to content creator
            TransactionType.LIKE,
            creatorAmount,
            0, // Fee already included in amount
            (Date.now() % 1000000), // Nonce
            {
                action_type: 'LIKE',
                content_id: options.content_id,
                target_content_id: options.content_id,
                timestamp: Date.now(),
            }
        );

        // Create treasury transaction (50%)
        const treasuryTransaction = TransactionModel.create(
            options.wallet_id,
            TREASURY_ADDRESSES.main,
            TransactionType.LIKE,
            treasuryAmount,
            0,
            (Date.now() % 1000000) + 1, // Nonce + 1
            {
                action_type: 'LIKE_FEE',
                content_id: options.content_id,
                is_treasury_fee: true,
                timestamp: Date.now(),
            }
        );

        // Add both transactions to mempool
        const result1 = this.mempool.addTransaction(likeTransaction.toJSON());
        const result2 = this.mempool.addTransaction(treasuryTransaction.toJSON());

        if (!result1.success || !result2.success) {
            throw new Error('Failed to add like transaction to mempool');
        }

        return {
            tx_id: likeTransaction.tx_id,
            success: true,
            fee_paid: totalFee,
            creator_received: creatorAmount,
            treasury_received: treasuryAmount,
        };
    }

    /**
     * Comment on content
     * Fee: 0.00001 LT (50% to content creator, 50% to blockchain)
     */
    commentOnContent(options: CommentContentOptions): {
        tx_id: string;
        success: boolean;
        fee_paid: number;
        creator_received: number;
        treasury_received: number;
    } {
        // Validate comment
        if (!options.comment_text || options.comment_text.trim().length === 0) {
            throw new Error('Comment text is required');
        }

        if (options.comment_text.length > 1000) {
            throw new Error('Comment is too long (max 1000 characters)');
        }

        // Get content to find creator
        if (!this.contentService) {
            throw new Error('Content service not initialized');
        }

        const content = this.contentService.getContent(options.content_id);
        if (!content) {
            throw new Error('Content not found');
        }

        const totalFee = TOKEN_CONFIG.COMMENT_FEE; // 1000 = 0.00001 LT
        const creatorAmount = Math.floor(totalFee * 0.5); // 50%
        const treasuryAmount = totalFee - creatorAmount; // 50%

        // Create comment ID
        const comment_id = crypto
            .createHash('sha256')
            .update(`${options.wallet_id}${options.content_id}${Date.now()}`)
            .digest('hex');

        // Create COMMENT transaction to content creator (50%)
        const commentTransaction = TransactionModel.create(
            options.wallet_id,
            content.owner_wallet,
            TransactionType.COMMENT,
            creatorAmount,
            0,
            (Date.now() % 1000000), // Nonce
            {
                action_type: 'COMMENT',
                comment_id,
                content_id: options.content_id,
                target_content_id: options.content_id,
                comment_text: options.comment_text,
                parent_comment_id: options.parent_comment_id,
                timestamp: Date.now(),
            }
        );

        // Create treasury transaction (50%)
        const treasuryTransaction = TransactionModel.create(
            options.wallet_id,
            TREASURY_ADDRESSES.main,
            TransactionType.COMMENT,
            treasuryAmount,
            0,
            (Date.now() % 1000000) + 1, // Nonce + 1
            {
                action_type: 'COMMENT_FEE',
                content_id: options.content_id,
                is_treasury_fee: true,
                timestamp: Date.now(),
            }
        );

        // Add both transactions to mempool
        const result1 = this.mempool.addTransaction(commentTransaction.toJSON());
        const result2 = this.mempool.addTransaction(treasuryTransaction.toJSON());

        if (!result1.success || !result2.success) {
            throw new Error('Failed to add comment transaction to mempool');
        }

        return {
            tx_id: commentTransaction.tx_id,
            success: true,
            fee_paid: totalFee,
            creator_received: creatorAmount,
            treasury_received: treasuryAmount,
        };
    }

    /**
     * Follow user (FREE - no fee)
     */
    followUser(options: FollowUserOptions): {
        tx_id: string;
        success: boolean;
    } {
        // Check if already following
        if (this.isFollowing(options.wallet_id, options.target_wallet_id)) {
            throw new Error('You are already following this user');
        }

        // Create FOLLOW transaction (no fee)
        const followTransaction = TransactionModel.create(
            options.wallet_id,
            options.target_wallet_id,
            TransactionType.FOLLOW,
            0, // No amount
            0, // No fee - following is FREE
            (Date.now() % 1000000), // Nonce
            {
                action_type: 'FOLLOW',
                target_wallet_id: options.target_wallet_id,
                timestamp: Date.now(),
            }
        );

        const result = this.mempool.addTransaction(followTransaction.toJSON());

        if (!result.success) {
            throw new Error(result.error || 'Failed to add follow transaction to mempool');
        }

        return {
            tx_id: followTransaction.tx_id,
            success: true,
        };
    }

    /**
     * Unfollow user (FREE - no fee)
     */
    unfollowUser(options: FollowUserOptions): {
        tx_id: string;
        success: boolean;
    } {
        // Check if following
        if (!this.isFollowing(options.wallet_id, options.target_wallet_id)) {
            throw new Error('You are not following this user');
        }

        // Create UNFOLLOW transaction (no fee)
        const unfollowTransaction = TransactionModel.create(
            options.wallet_id,
            options.target_wallet_id,
            TransactionType.UNFOLLOW,
            0,
            0,
            (Date.now() % 1000000), // Nonce
            {
                action_type: 'UNFOLLOW',
                target_wallet_id: options.target_wallet_id,
                timestamp: Date.now(),
            }
        );

        const result = this.mempool.addTransaction(unfollowTransaction.toJSON());

        if (!result.success) {
            throw new Error(result.error || 'Failed to add unfollow transaction to mempool');
        }

        return {
            tx_id: unfollowTransaction.tx_id,
            success: true,
        };
    }

    /**
     * Get content likes
     */
    getContentLikes(contentId: string): Transaction[] {
        const likes: Transaction[] = [];
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (
                    tx.type === TransactionType.LIKE &&
                    (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) &&
                    !tx.payload?.is_treasury_fee
                ) {
                    likes.push(tx);
                }
            }
        }

        return likes;
    }

    /**
     * Get content comments
     */
    getContentComments(contentId: string): Transaction[] {
        const comments: Transaction[] = [];
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (
                    tx.type === TransactionType.COMMENT &&
                    (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) &&
                    !tx.payload?.is_treasury_fee
                ) {
                    comments.push(tx);
                }
            }
        }

        return comments;
    }

    /**
     * Get user's followers
     */
    getUserFollowers(walletId: string): string[] {
        const followers = new Set<string>();
        const unfollowers = new Set<string>();
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (tx.to_wallet === walletId) {
                    if (tx.type === TransactionType.FOLLOW) {
                        followers.add(tx.from_wallet);
                    } else if (tx.type === TransactionType.UNFOLLOW) {
                        unfollowers.add(tx.from_wallet);
                    }
                }
            }
        }

        // Remove unfollowers from followers
        unfollowers.forEach((wallet) => followers.delete(wallet));

        return Array.from(followers);
    }

    /**
     * Get who user is following
     */
    getUserFollowing(walletId: string): string[] {
        const following = new Set<string>();
        const unfollowed = new Set<string>();
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (tx.from_wallet === walletId) {
                    if (tx.type === TransactionType.FOLLOW) {
                        following.add(tx.to_wallet);
                    } else if (tx.type === TransactionType.UNFOLLOW) {
                        unfollowed.add(tx.to_wallet);
                    }
                }
            }
        }

        // Remove unfollowed from following
        unfollowed.forEach((wallet) => following.delete(wallet));

        return Array.from(following);
    }

    /**
     * Check if user has liked content
     */
    private hasUserLiked(walletId: string, contentId: string): boolean {
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (
                    tx.type === TransactionType.LIKE &&
                    tx.from_wallet === walletId &&
                    (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) &&
                    !tx.payload?.is_treasury_fee
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if user is following another user
     */
    private isFollowing(walletId: string, targetWalletId: string): boolean {
        const following = this.getUserFollowing(walletId);
        return following.includes(targetWalletId);
    }
}
