import crypto from 'crypto';

/**
 * Content types supported
 */
export enum ContentType {
    VIDEO = 'VIDEO',
    PHOTO = 'PHOTO',
    TEXT = 'TEXT',
    TWEET = 'TWEET',
}

/**
 * Content metadata structure
 */
export interface ContentMetadata {
    content_id: string; // Unique hash
    content_type: ContentType;
    title?: string;
    description?: string;
    content_url?: string; // IPFS or external URL
    content_hash: string; // Content verification hash
    media_type?: string; // e.g., "video/mp4", "image/jpeg"
    duration?: number; // For videos (in seconds)
    size?: number; // File size in bytes
    tags?: string[];
    owner_wallet: string;
    owner_nickname?: string;
    created_at: number;
}

/**
 * Content  model class
 */
export class ContentModel {
    metadata: ContentMetadata;

    constructor(metadata: ContentMetadata) {
        this.metadata = metadata;
    }

    /**
     * Create new content
     */
    static create(
        walletId: string,
        contentType: ContentType,
        options: {
            title?: string;
            description?: string;
            content_url?: string;
            media_type?: string;
            duration?: number;
            size?: number;
            tags?: string[];
            nickname?: string;
        } = {}
    ): ContentModel {
        const timestamp = Date.now();
        const contentData = `${walletId}${contentType}${timestamp}`;
        const content_id = crypto.createHash('sha256').update(contentData).digest('hex');

        const contentHash = crypto
            .createHash('sha256')
            .update(JSON.stringify({ ...options, content_id }))
            .digest('hex');

        const metadata: ContentMetadata = {
            content_id,
            content_type: contentType,
            title: options.title,
            description: options.description,
            content_url: options.content_url,
            content_hash: contentHash,
            media_type: options.media_type,
            duration: options.duration,
            size: options.size,
            tags: options.tags || [],
            owner_wallet: walletId,
            owner_nickname: options.nickname,
            created_at: timestamp,
        };

        return new ContentModel(metadata);
    }

    /**
     * Validate content metadata
     */
    validate(): { valid: boolean; error?: string } {
        if (!this.metadata.content_id) {
            return { valid: false, error: 'Content ID is required' };
        }

        if (!this.metadata.owner_wallet) {
            return { valid: false, error: 'Owner wallet is required' };
        }

        if (!Object.values(ContentType).includes(this.metadata.content_type)) {
            return { valid: false, error: 'Invalid content type' };
        }

        // Validate description length
        if (this.metadata.description && this.metadata.description.length > 5000) {
            return { valid: false, error: 'Description too long (max 5000 characters)' };
        }

        // Validate title length
        if (this.metadata.title && this.metadata.title.length > 200) {
            return { valid: false, error: 'Title too long (max 200 characters)' };
        }

        return { valid: true };
    }

    /**
     * Convert to JSON
     */
    toJSON(): ContentMetadata {
        return { ...this.metadata };
    }
}
