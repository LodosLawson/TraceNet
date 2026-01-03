import { Storage } from '@google-cloud/storage';
import { Block } from '../blockchain/models/Block';

/**
 * Cloud Storage Backup Service
 * Automatically backs up and restores blockchain data from Google Cloud Storage
 * to survive Cloud Run deployments
 */
export class CloudStorageBackup {
    private storage: Storage;
    private bucketName: string;
    private enabled: boolean;

    constructor() {
        this.bucketName = process.env.GCS_BACKUP_BUCKET || 'tracenet-blockchain-backups';

        // Only enable in Cloud Run environment (or if explicitly enabled)
        this.enabled = process.env.K_SERVICE !== undefined || process.env.ENABLE_GCS_BACKUP === 'true';

        if (this.enabled) {
            this.storage = new Storage();
            console.log(`[CloudBackup] Initialized (Bucket: ${this.bucketName})`);
        } else {
            console.log('[CloudBackup] Disabled (not in Cloud Run)');
        }
    }

    /**
     * Backup blockchain to GCS
     */
    async backup(chain: Block[]): Promise<void> {
        if (!this.enabled) return;

        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file('blockchain-latest.json');

            const chainData = JSON.stringify({
                version: '2.5',
                timestamp: Date.now(),
                height: chain.length,
                chain: chain.map(b => b.toJSON())
            });

            await file.save(chainData, {
                contentType: 'application/json',
                metadata: {
                    height: chain.length.toString(),
                    timestamp: Date.now().toString()
                }
            });

            console.log(`[CloudBackup] ✅ Backed up ${chain.length} blocks to GCS`);
        } catch (error) {
            console.error('[CloudBackup] ❌ Backup failed:', error);
            // Don't throw - backup failure shouldn't crash the node
        }
    }

    /**
     * Restore blockchain from GCS
     */
    async restore(): Promise<Block[] | null> {
        if (!this.enabled) return null;

        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file('blockchain-latest.json');

            const [exists] = await file.exists();
            if (!exists) {
                console.log('[CloudBackup] No backup found in GCS');
                return null;
            }

            const [contents] = await file.download();
            const data = JSON.parse(contents.toString());

            console.log(`[CloudBackup] ✅ Found backup: ${data.height} blocks (${new Date(data.timestamp).toLocaleString()})`);

            // Reconstruct Block objects
            const blocks = data.chain.map((b: any) => new Block(b));
            return blocks;
        } catch (error) {
            console.error('[CloudBackup] ❌ Restore failed:', error);
            return null;
        }
    }

    /**
     * Check if backup exists
     */
    async hasBackup(): Promise<boolean> {
        if (!this.enabled) return false;

        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file('blockchain-latest.json');
            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            return false;
        }
    }
}
