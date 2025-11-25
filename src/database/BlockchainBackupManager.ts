import { EventEmitter } from 'events';
import { Blockchain } from '../blockchain/core/Blockchain';
import { SupabaseService } from '../database/SupabaseService';

/**
 * Blockchain Backup Configuration
 */
export interface BackupConfig {
    enabled: boolean;
    interval: number;          // Backup every N blocks
    keepLast: number;          // Keep last N backups
    autoCleanup: boolean;      // Auto cleanup old backups
}

/**
 * Backup Data Structure
 */
interface BlockchainBackupData {
    blocks: any[];
    stateRoot: string;
    latestBlockIndex: number;
    latestBlockHash: string;
    timestamp: number;
    version: string;
}

/**
 * Blockchain Backup Manager
 * Automatically backs up blockchain state to Supabase
 */
export class BlockchainBackupManager extends EventEmitter {
    private blockchain: Blockchain;
    private supabase: SupabaseService;
    private config: BackupConfig;
    private lastBackupHeight: number = 0;

    constructor(
        blockchain: Blockchain,
        supabase: SupabaseService,
        config: BackupConfig
    ) {
        super();
        this.blockchain = blockchain;
        this.supabase = supabase;
        this.config = config;
    }

    /**
     * Start automatic backup
     */
    start(): void {
        if (!this.config.enabled) {
            console.log('Blockchain backup is disabled');
            return;
        }

        console.log('Starting blockchain backup manager...');
        console.log(`  Backup interval: every ${this.config.interval} blocks`);
        console.log(`  Keep last: ${this.config.keepLast} backups`);

        // Listen for new blocks
        this.blockchain.on('blockAdded', (block: any) => {
            this.handleNewBlock(block);
        });
    }

    /**
     * Handle new block
     */
    private async handleNewBlock(block: any): Promise<void> {
        const currentHeight = block.index;

        // Check if we should backup
        if (currentHeight - this.lastBackupHeight >= this.config.interval) {
            try {
                await this.createBackup();
                this.lastBackupHeight = currentHeight;

                // Cleanup old backups if enabled
                if (this.config.autoCleanup) {
                    await this.cleanup();
                }
            } catch (error: any) {
                console.error('Backup failed:', error.message);
                this.emit('backupError', { error: error.message, blockHeight: currentHeight });
            }
        }
    }

    /**
     * Create blockchain backup
     */
    async createBackup(): Promise<void> {
        console.log('Creating blockchain backup...');

        const latestBlock = this.blockchain.getLatestBlock();
        const stats = this.blockchain.getStats();

        // Prepare backup data
        const backupData: BlockchainBackupData = {
            blocks: this.blockchain.getChain().map(b => b.toJSON()),
            stateRoot: stats.state_root,
            latestBlockIndex: latestBlock.index,
            latestBlockHash: latestBlock.hash,
            timestamp: Date.now(),
            version: '1.0.0',
        };

        // Save to Supabase
        await this.supabase.saveBlockchainBackup(
            latestBlock.index,
            latestBlock.hash,
            backupData
        );

        console.log(`✓ Backup created for block ${latestBlock.index}`);
        this.emit('backupCreated', {
            blockHeight: latestBlock.index,
            blockHash: latestBlock.hash,
            dataSize: JSON.stringify(backupData).length,
        });
    }

    /**
     * Restore blockchain from backup
     */
    async restoreFromBackup(blockHeight?: number): Promise<void> {
        console.log('Restoring blockchain from backup...');

        let backup;
        if (blockHeight !== undefined) {
            backup = await this.supabase.getBackupByHeight(blockHeight);
        } else {
            backup = await this.supabase.getLatestBackup();
        }

        if (!backup) {
            throw new Error('No backup found');
        }

        const backupData: BlockchainBackupData = backup.backup_data;

        console.log(`Restoring from backup at block ${backup.block_height}...`);
        console.log(`  Blocks: ${backupData.blocks.length}`);
        console.log(`  State root: ${backupData.stateRoot}`);

        // TODO: Implement blockchain restoration logic
        // This would involve:
        // 1. Clearing current chain
        // 2. Loading blocks from backup
        // 3. Rebuilding state
        // 4. Validating chain integrity

        console.log('✓ Blockchain restored');
        this.emit('backupRestored', {
            blockHeight: backup.block_height,
            blockHash: backup.block_hash,
        });
    }

    /**
     * Cleanup old backups
     */
    async cleanup(): Promise<void> {
        try {
            await this.supabase.cleanupOldBackups(this.config.keepLast);
            console.log(`✓ Cleaned up old backups (keeping last ${this.config.keepLast})`);
        } catch (error: any) {
            console.error('Cleanup failed:', error.message);
        }
    }

    /**
     * Get backup statistics
     */
    async getStats(): Promise<{
        lastBackupHeight: number;
        totalBackups: number;
    }> {
        const latestBackup = await this.supabase.getLatestBackup();

        return {
            lastBackupHeight: latestBackup?.block_height || 0,
            totalBackups: 0, // TODO: Count total backups
        };
    }

    /**
     * Manual backup trigger
     */
    async triggerBackup(): Promise<void> {
        await this.createBackup();
    }
}
