import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from '../node/Mempool';
import { SocialPool } from '../node/SocialPool';
import { TransactionModel, TransactionType, Transaction, InnerTransaction, Signature } from '../blockchain/models/Transaction';
import { TOKEN_CONFIG, TREASURY_ADDRESSES } from '../economy/TokenConfig';
import { ContentService } from './ContentService';
import crypto from 'crypto';

/**
 * Like action options
 */
import { KeyManager } from '../blockchain/crypto/KeyManager';

/**
 * Like action options
 */
export interface LikeContentOptions {
    wallet_id: string;
    content_id: string;
    timestamp: number; // Required for signature verification
    signature: string;
    sender_public_key: string;
}

/**
 * Comment action options
 */
export interface CommentContentOptions {
    wallet_id: string;
    content_id: string;
    comment_text: string;
    parent_comment_id?: string; // For replies
    timestamp: number;
    signature: string;
    sender_public_key: string;
}

/**
 * Follow action options
 */
export interface FollowUserOptions {
    wallet_id: string;
    target_wallet_id: string;
    timestamp: number;
    signature: string;
    sender_public_key: string;
}

/**
 * Social Service
 * Manages social interactions with fee splitting (50% creator, 50% blockchain)
 */
export class SocialService {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private socialPool: SocialPool; // Injected
    private contentService?: ContentService;

    constructor(blockchain: Blockchain, mempool: Mempool, socialPool: SocialPool) {
        this.blockchain = blockchain;
        this.mempool = mempool;
        this.socialPool = socialPool;
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
        status: string; // 'queued' or 'confirmed'
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

        // VERIFY SIGNATURE (SECURITY FIX)
        const messageToVerify = `${options.wallet_id}:LIKE:${options.content_id}:${options.timestamp}`;
        if (!KeyManager.verify(messageToVerify, options.signature, options.sender_public_key)) {
            throw new Error('Invalid signature');
        }

        const totalFee = TOKEN_CONFIG.LIKE_FEE; // 1000 = 0.00001 LT

        // 50% to Creator
        const creatorAmount = Math.floor(totalFee * (TOKEN_CONFIG.FEE_TO_PRIMARY_PERCENT / 100));

        // 10% to Treasury
        const treasuryAmount = Math.floor(totalFee * (TOKEN_CONFIG.FEE_TO_DEV_PERCENT / 100));

        // 40% to Validator Pool (Remaining)
        const poolAmount = totalFee - creatorAmount - treasuryAmount;

        const timestamp = options.timestamp;

        // 1. Create INNER Like Transaction (Creator Share)
        const innerLike: InnerTransaction = {
            type: TransactionType.LIKE,
            from_wallet: options.wallet_id,
            to_wallet: content.owner_wallet,
            amount: creatorAmount,
            nonce: (timestamp % 1000000),
            timestamp: timestamp,
            payload: {
                action_type: 'LIKE',
                content_id: options.content_id,
                target_content_id: options.content_id,
            },
            signature: options.signature, // Use actual signature
        };

        // 2. Create INNER Treasury Transaction
        const innerTreasury: InnerTransaction = {
            type: TransactionType.LIKE,
            from_wallet: options.wallet_id,
            to_wallet: TREASURY_ADDRESSES.main,
            amount: treasuryAmount,
            nonce: (timestamp % 1000000) + 1,
            timestamp: timestamp,
            payload: {
                action_type: 'LIKE_FEE',
                content_id: options.content_id,
                is_treasury_fee: true
            },
            signature: 'PENDING'
        };

        // 3. Create INNER Validator Pool Transaction (Epoch Reward Accumulation)
        const innerPoolTx: InnerTransaction = {
            type: TransactionType.LIKE,
            from_wallet: options.wallet_id,
            to_wallet: TREASURY_ADDRESSES.validator_pool, // 'VALIDATOR_POOL'
            amount: poolAmount,
            nonce: (timestamp % 1000000) + 2,
            timestamp: timestamp,
            payload: {
                action_type: 'POOL_FEE',
                content_id: options.content_id,
                is_pool_fee: true
            },
            signature: 'PENDING'
        };

        // Add to Social Pool (Batch Queue)
        this.socialPool.addSocialAction(innerLike);
        this.socialPool.addSocialAction(innerTreasury);
        this.socialPool.addSocialAction(innerPoolTx);

        return {
            tx_id: `PENDING-BATCH-${timestamp}`,
            success: true,
            fee_paid: totalFee,
            creator_received: creatorAmount,
            treasury_received: treasuryAmount,
            status: 'queued'
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
        status: string;
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

        // VERIFY SIGNATURE (SECURITY FIX)
        const messageToVerify = `${options.wallet_id}:COMMENT:${options.content_id}:${options.timestamp}:${options.comment_text}`;
        if (!KeyManager.verify(messageToVerify, options.signature, options.sender_public_key)) {
            throw new Error('Invalid signature');
        }

        const totalFee = TOKEN_CONFIG.COMMENT_FEE;

        // 50% to Creator
        const creatorAmount = Math.floor(totalFee * (TOKEN_CONFIG.FEE_TO_PRIMARY_PERCENT / 100));

        // 10% to Treasury
        const treasuryAmount = Math.floor(totalFee * (TOKEN_CONFIG.FEE_TO_DEV_PERCENT / 100));

        // 40% to Validator Pool
        const poolAmount = totalFee - creatorAmount - treasuryAmount;

        const timestamp = options.timestamp;

        // Create comment ID
        const comment_id = crypto
            .createHash('sha256')
            .update(`${options.wallet_id}${options.content_id}${timestamp}`)
            .digest('hex');

        // 1. Inner Comment Tx
        const innerComment: InnerTransaction = {
            type: TransactionType.COMMENT,
            from_wallet: options.wallet_id,
            to_wallet: content.owner_wallet,
            amount: creatorAmount,
            nonce: (timestamp % 1000000),
            timestamp: timestamp,
            payload: {
                action_type: 'COMMENT',
                comment_id,
                content_id: options.content_id,
                target_content_id: options.content_id,
                comment_text: options.comment_text,
                parent_comment_id: options.parent_comment_id,
            },
            signature: options.signature
        };

        // 2. Inner Treasury Tx
        const innerTreasury: InnerTransaction = {
            type: TransactionType.COMMENT,
            from_wallet: options.wallet_id,
            to_wallet: TREASURY_ADDRESSES.main,
            amount: treasuryAmount,
            nonce: (timestamp % 1000000) + 1,
            timestamp: timestamp,
            payload: {
                action_type: 'COMMENT_FEE',
                content_id: options.content_id,
                is_treasury_fee: true
            },
            signature: 'PENDING'
        };

        // 3. Inner Validator Pool Tx
        const innerPoolTx: InnerTransaction = {
            type: TransactionType.COMMENT,
            from_wallet: options.wallet_id,
            to_wallet: TREASURY_ADDRESSES.validator_pool,
            amount: poolAmount,
            nonce: (timestamp % 1000000) + 2,
            timestamp: timestamp,
            payload: {
                action_type: 'POOL_FEE',
                content_id: options.content_id,
                is_pool_fee: true
            },
            signature: 'PENDING'
        };

        // Add to Social Pool
        this.socialPool.addSocialAction(innerComment);
        this.socialPool.addSocialAction(innerTreasury);
        this.socialPool.addSocialAction(innerPoolTx);

        return {
            tx_id: `PENDING-BATCH-${timestamp}`,
            success: true,
            fee_paid: totalFee,
            creator_received: creatorAmount,
            treasury_received: treasuryAmount,
            status: 'queued'
        };
    }

    /**
     * Follow user (FREE - no fee)
     * For now, we allow immediate execution as it's free/lightweight, 
     * or we can batch it too. Let's keep it immediate to show hybrid approach is possible,
     * unless requested otherwise. The prompt specifically mentioned Like and Comments.
     */
    followUser(options: FollowUserOptions): {
        tx_id: string;
        success: boolean;
    } {
        // Check if already following
        if (this.isFollowing(options.wallet_id, options.target_wallet_id)) {
            throw new Error('You are already following this user');
        }

        const timestamp = options.timestamp;

        // VERIFY SIGNATURE (SECURITY FIX)
        const messageToVerify = `${options.wallet_id}:FOLLOW:${options.target_wallet_id}:${timestamp}`;
        if (!KeyManager.verify(messageToVerify, options.signature, options.sender_public_key)) {
            throw new Error('Invalid signature');
        }

        // Create FOLLOW transaction (no fee)
        const followTransaction = TransactionModel.create(
            options.wallet_id,
            options.target_wallet_id,
            TransactionType.FOLLOW,
            0, // No amount
            0, // No fee - following is FREE
            (timestamp % 1000000), // Nonce
            {
                action_type: 'FOLLOW',
                target_wallet_id: options.target_wallet_id,
                timestamp: timestamp,
            }
        );

        // Assign signature
        followTransaction.sender_signature = options.signature;

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

        const timestamp = options.timestamp;

        // VERIFY SIGNATURE (SECURITY FIX)
        const messageToVerify = `${options.wallet_id}:UNFOLLOW:${options.target_wallet_id}:${timestamp}`;
        if (!KeyManager.verify(messageToVerify, options.signature, options.sender_public_key)) {
            throw new Error('Invalid signature');
        }

        // Create UNFOLLOW transaction (no fee)
        const unfollowTransaction = TransactionModel.create(
            options.wallet_id,
            options.target_wallet_id,
            TransactionType.UNFOLLOW,
            0,
            0,
            (timestamp % 1000000), // Nonce
            {
                action_type: 'UNFOLLOW',
                target_wallet_id: options.target_wallet_id,
                timestamp: timestamp,
            }
        );

        // Assign signature
        unfollowTransaction.sender_signature = options.signature;

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

        // TODO: Also search SocialPool?

        for (const block of chain) {
            for (const tx of block.transactions) {
                // Handle Normal Likes
                if (
                    tx.type === TransactionType.LIKE &&
                    (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) &&
                    !tx.payload?.is_treasury_fee
                ) {
                    likes.push(tx);
                }

                // Handle Batched Likes
                if (tx.type === TransactionType.BATCH && tx.payload && Array.isArray(tx.payload.transactions)) {
                    for (const innerTx of tx.payload.transactions) {
                        if (
                            innerTx.type === TransactionType.LIKE &&
                            (innerTx.payload?.content_id === contentId || innerTx.payload?.target_content_id === contentId) &&
                            !innerTx.payload?.is_treasury_fee
                        ) {
                            // Convert InnerTx to Tx format for consistency
                            likes.push(innerTx as any);
                        }
                    }
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

                // Handle Batched Comments
                if (tx.type === TransactionType.BATCH && tx.payload && Array.isArray(tx.payload.transactions)) {
                    for (const innerTx of tx.payload.transactions) {
                        if (
                            innerTx.type === TransactionType.COMMENT &&
                            (innerTx.payload?.content_id === contentId || innerTx.payload?.target_content_id === contentId) &&
                            !innerTx.payload?.is_treasury_fee
                        ) {
                            comments.push(innerTx as any);
                        }
                    }
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
                // Normal
                if (
                    tx.type === TransactionType.LIKE &&
                    tx.from_wallet === walletId &&
                    (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) &&
                    !tx.payload?.is_treasury_fee
                ) {
                    return true;
                }

                // Batched
                if (tx.type === TransactionType.BATCH && tx.payload && Array.isArray(tx.payload.transactions)) {
                    for (const innerTx of tx.payload.transactions) {
                        if (
                            innerTx.type === TransactionType.LIKE &&
                            innerTx.from_wallet === walletId &&
                            (innerTx.payload?.content_id === contentId || innerTx.payload?.target_content_id === contentId) &&
                            !innerTx.payload?.is_treasury_fee
                        ) {
                            return true;
                        }
                    }
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
