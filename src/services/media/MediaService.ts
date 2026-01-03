import crypto from 'crypto';

/**
 * Media file metadata
 */
export interface MediaFile {
    media_id: string;
    hash: string;                   // SHA256
    url: string;                    // CDN URL
    size: number;
    content_type: string;
    uploader_id: string;
    scan_status: 'pending' | 'clean' | 'infected' | 'error';
    created_at: Date;
    expires_at?: Date;
}

/**
 * Media upload result
 */
export interface MediaUploadResult {
    media_id: string;
    hash: string;
    url: string;
    size: number;
    content_type: string;
}

/**
 * Media Service for handling file uploads and cloud storage
 */
export class MediaService {
    private mediaFiles: Map<string, MediaFile>;
    private cdnDomain: string;
    private maxFileSize: number;
    private allowedTypes: string[];

    constructor(
        cdnDomain: string = 'https://cdn.tracenet.io',
        maxFileSize: number = 104857600, // 100MB
        allowedTypes: string[] = ['image/*', 'video/*', 'audio/*']
    ) {
        this.mediaFiles = new Map();
        this.cdnDomain = cdnDomain;
        this.maxFileSize = maxFileSize;
        this.allowedTypes = allowedTypes;
    }

    /**
     * Upload media file (simulated - in production would upload to GCP)
     */
    async uploadMedia(
        file: Buffer,
        contentType: string,
        uploaderId: string
    ): Promise<MediaUploadResult> {
        // Validate file size
        if (file.length > this.maxFileSize) {
            throw new Error(`File size exceeds maximum of ${this.maxFileSize} bytes`);
        }

        // Validate content type
        if (!this.isAllowedType(contentType)) {
            throw new Error(`Content type ${contentType} not allowed`);
        }

        // Calculate SHA256 hash
        const hash = this.calculateHash(file);

        // Check if file already exists
        const existing = Array.from(this.mediaFiles.values()).find((m) => m.hash === hash);
        if (existing) {
            return {
                media_id: existing.media_id,
                hash: existing.hash,
                url: existing.url,
                size: existing.size,
                content_type: existing.content_type,
            };
        }

        // Generate media ID
        const media_id = crypto.randomBytes(16).toString('hex');

        // Simulate cloud storage upload
        // In production: upload to GCP Cloud Storage
        const url = `${this.cdnDomain}/media/${hash}`;

        const mediaFile: MediaFile = {
            media_id,
            hash,
            url,
            size: file.length,
            content_type: contentType,
            uploader_id: uploaderId,
            scan_status: 'pending',
            created_at: new Date(),
        };

        this.mediaFiles.set(media_id, mediaFile);

        // Trigger virus scan (simulated)
        this.scanMedia(media_id);

        return {
            media_id,
            hash,
            url,
            size: file.length,
            content_type: contentType,
        };
    }

    /**
     * Calculate SHA256 hash of file
     */
    calculateHash(data: Buffer): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Check if content type is allowed
     */
    private isAllowedType(contentType: string): boolean {
        for (const allowedType of this.allowedTypes) {
            if (allowedType.endsWith('/*')) {
                const prefix = allowedType.slice(0, -2);
                if (contentType.startsWith(prefix)) {
                    return true;
                }
            } else if (contentType === allowedType) {
                return true;
            }
        }
        return false;
    }

    /**
     * Scan media for viruses (simulated)
     */
    private async scanMedia(media_id: string): Promise<void> {
        const mediaFile = this.mediaFiles.get(media_id);
        if (!mediaFile) {
            return;
        }

        // Simulate virus scan delay
        setTimeout(() => {
            // In production: integrate with ClamAV or Cloud Security Scanner
            mediaFile.scan_status = 'clean';
            this.mediaFiles.set(media_id, mediaFile);
        }, 1000);
    }

    /**
     * Get media file by hash
     */
    getMediaByHash(hash: string): MediaFile | undefined {
        return Array.from(this.mediaFiles.values()).find((m) => m.hash === hash);
    }

    /**
     * Get media file by ID
     */
    getMediaById(media_id: string): MediaFile | undefined {
        return this.mediaFiles.get(media_id);
    }

    /**
     * Delete media file
     */
    deleteMedia(media_id: string): boolean {
        return this.mediaFiles.delete(media_id);
    }

    /**
     * Get media statistics
     */
    getStats(): {
        totalFiles: number;
        totalSize: number;
        pendingScans: number;
        cleanFiles: number;
        infectedFiles: number;
    } {
        const files = Array.from(this.mediaFiles.values());

        return {
            totalFiles: files.length,
            totalSize: files.reduce((sum, f) => sum + f.size, 0),
            pendingScans: files.filter((f) => f.scan_status === 'pending').length,
            cleanFiles: files.filter((f) => f.scan_status === 'clean').length,
            infectedFiles: files.filter((f) => f.scan_status === 'infected').length,
        };
    }
}
