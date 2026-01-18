import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from '../node/Mempool';
import { ContentModel, ContentType, ContentMetadata } from '../models/ContentModel';
import { TransactionModel, TransactionType } from '../blockchain/models/Transaction';
import { UserService } from './user/UserService';

import { KeyManager } from '../blockchain/crypto/KeyManager';

/**
 * Content creation options
 */
export interface CreateContentOptions {
    wallet_id: string;
    content_type: ContentType;
    title?: string;
    description?: string;
    content_url?: string;
    media_type?: string;
    duration?: number;
    size?: number;
    tags?: string[];
    timestamp: number;
    signature: string;
    sender_public_key: string;
}

/**
 * Content with stats
 */
export interface ContentWithStats extends ContentMetadata {
    likes_count: number;
    comments_count: number;
    shares_count: number;
}

/**
 * Content Service
 * Manages content posting and retrieval
 */
export class ContentService {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private userService?: UserService;

    constructor(blockchain: Blockchain, mempool: Mempool) {
        this.blockchain = blockchain;
        this.mempool = mempool;
    }

    /**
     * Set user service for nickname lookup
     */
    setUserService(userService: UserService): void {
        this.userService = userService;
    }

    /**
     * Create and post content
     */
    createContent(options: CreateContentOptions): {
        content: ContentMetadata;
        tx_id: string;
        success: boolean;
    } {
        // VERIFY SIGNATURE (SECURITY FIX)
        // Message format: walletId:POST_CONTENT:timestamp
        const messageToVerify = `${options.wallet_id}:POST_CONTENT:${options.timestamp}`;
        if (!KeyManager.verify(messageToVerify, options.signature, options.sender_public_key)) {
            throw new Error('Invalid signature');
        }

        // Get user nickname if available
        let nickname: string | undefined;
        if (this.userService) {
            const user = this.userService.getUserByWallet(options.wallet_id);
            nickname = user?.nickname;
        }

        // Create content model
        const contentModel = ContentModel.create(
            options.wallet_id,
            options.content_type,
            {
                title: options.title,
                description: options.description,
                content_url: options.content_url,
                media_type: options.media_type,
                duration: options.duration,
                size: options.size,
                tags: options.tags,
                nickname,
            }
        );

        // Validate content
        const validation = contentModel.validate();
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const timestamp = options.timestamp;

        // Create transaction
        const transaction = TransactionModel.create(
            options.wallet_id,
            'CONTENT_POOL', // Content goes to a pool address
            TransactionType.POST_CONTENT,
            0, // No transfer amount for posting
            0, // No fee for posting content
            (timestamp % 1000000), // Nonce
            {
                content: contentModel.toJSON(),
                timestamp: timestamp
            }
        );

        // Assign signature
        transaction.sender_signature = options.signature;

        // Add to mempool
        const result = this.mempool.addTransaction(transaction.toJSON());

        if (!result.success) {
            throw new Error(result.error || 'Failed to add content transaction to mempool');
        }

        return {
            content: contentModel.toJSON(),
            tx_id: transaction.tx_id,
            success: true,
        };
    }

    /**
     * Get content by ID
     */
    getContent(contentId: string): ContentWithStats | null {
        // 1. Search in Blockchain
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                // Check for POST_CONTENT
                if (tx.type === TransactionType.POST_CONTENT && tx.payload?.content) {
                    const content = tx.payload.content as ContentMetadata;
                    if (content.content_id === contentId) {
                        return {
                            ...content,
                            ...this.getContentStats(contentId),
                        };
                    }
                }
                // NEW: Check for COMMENT (to allow Liking/Replying to Comments)
                if (tx.type === TransactionType.COMMENT && tx.payload?.comment_id === contentId) {
                    return {
                        content_id: contentId,
                        wallet_id: tx.from_wallet, // The commenter is the owner
                        content_type: ContentType.TEXT, // Treat as text content
                        timestamp: tx.timestamp,
                        title: 'Comment',
                        description: tx.payload.comment_text,
                        tags: [],
                        ...this.getContentStats(contentId), // Get likes/replies for this comment
                    } as ContentWithStats;
                }
            }
        }

        // 2. Search in Mempool (for unmined content/comments)
        const mempoolTxs = this.mempool.getAllTransactions();
        for (const tx of mempoolTxs) {
            // Check for POST_CONTENT
            if (tx.type === TransactionType.POST_CONTENT && tx.payload?.content) {
                const content = tx.payload.content as ContentMetadata;
                if (content.content_id === contentId) {
                    return {
                        ...content,
                        likes_count: 0,
                        comments_count: 0,
                        shares_count: 0
                    };
                }
            }
            // NEW: Check for COMMENT in Mempool
            if (tx.type === TransactionType.COMMENT && tx.payload?.comment_id === contentId) {
                return {
                    content_id: contentId,
                    wallet_id: tx.from_wallet,
                    content_type: ContentType.TEXT,
                    timestamp: tx.timestamp,
                    title: 'Comment',
                    description: tx.payload.comment_text,
                    tags: [],
                    likes_count: 0,
                    comments_count: 0,
                    shares_count: 0
                } as ContentWithStats;
            }
        }

        return null;
    }

    /**
     * Get user's content
     */
    getUserContent(walletId: string, limit: number = 50): ContentMetadata[] {
        const contents: ContentMetadata[] = [];
        const chain = this.blockchain.getChain();

        // Search in reverse order (newest first)
        for (let i = chain.length - 1; i >= 0; i--) {
            const block = chain[i];
            for (const tx of block.transactions) {
                if (
                    tx.type === TransactionType.POST_CONTENT &&
                    tx.from_wallet === walletId &&
                    tx.payload?.content
                ) {
                    contents.push(tx.payload.content as ContentMetadata);
                    if (contents.length >= limit) {
                        return contents;
                    }
                }
            }
        }

        return contents;
    }

    /**
     * Get content feed (all content, newest first)
     */
    getContentFeed(limit: number = 20, offset: number = 0): {
        contents: ContentWithStats[];
        total: number;
    } {
        const allContents: ContentMetadata[] = [];
        const chain = this.blockchain.getChain();

        // Collect all content
        for (let i = chain.length - 1; i >= 0; i--) {
            const block = chain[i];
            for (const tx of block.transactions) {
                if (tx.type === TransactionType.POST_CONTENT && tx.payload?.content) {
                    allContents.push(tx.payload.content as ContentMetadata);
                }
            }
        }

        // Apply pagination
        const paginatedContents = allContents.slice(offset, offset + limit);

        // Add stats to each content
        const contentsWithStats: ContentWithStats[] = paginatedContents.map((content) => {
            const stats = this.getContentStats(content.content_id);
            return {
                ...content,
                ...stats,
            };
        });

        return {
            contents: contentsWithStats,
            total: allContents.length,
        };
    }

    /**
     * Get content stats (likes, comments, shares)
     */
    private getContentStats(contentId: string): {
        likes_count: number;
        comments_count: number;
        shares_count: number;
    } {
        let likes = 0;
        let comments = 0;
        let shares = 0;

        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (tx.payload?.content_id === contentId || tx.payload?.target_content_id === contentId) {
                    if (tx.type === TransactionType.LIKE) {
                        likes++;
                    } else if (tx.type === TransactionType.COMMENT) {
                        comments++;
                    } else if (tx.type === TransactionType.SHARE) {
                        shares++;
                    }
                }
            }
        }

        return {
            likes_count: likes,
            comments_count: comments,
            shares_count: shares,
        };
    }

    /**
     * Search content by tags
     */
    searchContentByTags(tags: string[], limit: number = 20): ContentMetadata[] {
        const results: ContentMetadata[] = [];
        const chain = this.blockchain.getChain();

        for (let i = chain.length - 1; i >= 0; i--) {
            const block = chain[i];
            for (const tx of block.transactions) {
                if (tx.type === TransactionType.POST_CONTENT && tx.payload?.content) {
                    const content = tx.payload.content as ContentMetadata;
                    // Check if content has any of the searched tags
                    if (content.tags && content.tags.some((tag) => tags.includes(tag))) {
                        results.push(content);
                        if (results.length >= limit) {
                            return results;
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Get total content count
     */
    getTotalContentCount(): number {
        let count = 0;
        const chain = this.blockchain.getChain();

        for (const block of chain) {
            for (const tx of block.transactions) {
                if (tx.type === TransactionType.POST_CONTENT) {
                    count++;
                }
            }
        }

        return count;
    }
}
