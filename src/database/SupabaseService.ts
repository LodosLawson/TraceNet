import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration
 */
export interface SupabaseConfig {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
}

/**
 * Database Tables
 */
export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    nickname: string;
                    email: string;
                    public_key: string;
                    created_at: string;
                    updated_at: string;
                    metadata: any;
                };
                Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['users']['Insert']>;
            };
            posts: {
                Row: {
                    id: string;
                    user_id: string;
                    content: string;
                    media_urls: string[];
                    tx_id: string;
                    created_at: string;
                    likes_count: number;
                    comments_count: number;
                };
                Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'created_at' | 'likes_count' | 'comments_count'>;
                Update: Partial<Database['public']['Tables']['posts']['Insert']>;
            };
            blockchain_backups: {
                Row: {
                    id: string;
                    block_height: number;
                    block_hash: string;
                    backup_data: any;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['blockchain_backups']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['blockchain_backups']['Insert']>;
            };
        };
    };
}

/**
 * Supabase Service
 * Handles off-chain data storage and blockchain backups
 */
export class SupabaseService {
    private client: SupabaseClient<Database>;
    private serviceClient?: SupabaseClient<Database>;

    constructor(config: SupabaseConfig) {
        // Public client (for frontend)
        this.client = createClient<Database>(config.url, config.anonKey);

        // Service role client (for backend operations)
        if (config.serviceRoleKey) {
            this.serviceClient = createClient<Database>(config.url, config.serviceRoleKey);
        }
    }

    /**
     * Get client for public operations
     */
    getClient(): SupabaseClient<Database> {
        return this.client;
    }

    /**
     * Get service client for admin operations
     */
    getServiceClient(): SupabaseClient<Database> {
        if (!this.serviceClient) {
            throw new Error('Service role key not provided');
        }
        return this.serviceClient;
    }

    /**
     * Save user profile (off-chain)
     */
    async saveUser(user: Database['public']['Tables']['users']['Insert']): Promise<void> {
        const { error } = await this.client
            .from('users')
            .upsert(user as any);

        if (error) {
            throw new Error(`Failed to save user: ${error.message}`);
        }
    }

    /**
     * Get user profile
     */
    async getUser(userId: string): Promise<Database['public']['Tables']['users']['Row'] | null> {
        const { data, error } = await this.client
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get user: ${error.message}`);
        }

        return data;
    }

    /**
     * Save post (off-chain metadata)
     */
    async savePost(post: Database['public']['Tables']['posts']['Insert']): Promise<void> {
        const { error } = await this.client
            .from('posts')
            .insert(post as any);

        if (error) {
            throw new Error(`Failed to save post: ${error.message}`);
        }
    }

    /**
     * Get user posts
     */
    async getUserPosts(userId: string, limit: number = 50): Promise<Database['public']['Tables']['posts']['Row'][]> {
        const { data, error } = await this.client
            .from('posts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new Error(`Failed to get posts: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Save blockchain backup
     */
    async saveBlockchainBackup(
        blockHeight: number,
        blockHash: string,
        backupData: any
    ): Promise<void> {
        if (!this.serviceClient) {
            throw new Error('Service client required for backups');
        }

        const { error } = await this.serviceClient
            .from('blockchain_backups')
            .insert({
                block_height: blockHeight,
                block_hash: blockHash,
                backup_data: backupData,
            } as any);

        if (error) {
            throw new Error(`Failed to save backup: ${error.message}`);
        }
    }

    /**
     * Get latest blockchain backup
     */
    async getLatestBackup(): Promise<Database['public']['Tables']['blockchain_backups']['Row'] | null> {
        if (!this.serviceClient) {
            throw new Error('Service client required for backups');
        }

        const { data, error } = await this.serviceClient
            .from('blockchain_backups')
            .select('*')
            .order('block_height', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No backups yet
            }
            throw new Error(`Failed to get backup: ${error.message}`);
        }

        return data;
    }

    /**
     * Get backup by block height
     */
    async getBackupByHeight(blockHeight: number): Promise<Database['public']['Tables']['blockchain_backups']['Row'] | null> {
        if (!this.serviceClient) {
            throw new Error('Service client required for backups');
        }

        const { data, error } = await this.serviceClient
            .from('blockchain_backups')
            .select('*')
            .eq('block_height', blockHeight)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw new Error(`Failed to get backup: ${error.message}`);
        }

        return data;
    }

    /**
     * Delete old backups (keep last N)
     */
    async cleanupOldBackups(keepLast: number = 100): Promise<void> {
        if (!this.serviceClient) {
            throw new Error('Service client required for backups');
        }

        // Get the Nth latest backup
        const { data: cutoffBackup } = await this.serviceClient
            .from('blockchain_backups')
            .select('block_height')
            .order('block_height', { ascending: false })
            .limit(1)
            .range(keepLast - 1, keepLast - 1)
            .single();

        if (!cutoffBackup) {
            return; // Not enough backups to clean
        }

        // Delete backups older than cutoff
        const { error } = await this.serviceClient
            .from('blockchain_backups')
            .delete()
            .lt('block_height', (cutoffBackup as any).block_height);

        if (error) {
            throw new Error(`Failed to cleanup backups: ${error.message}`);
        }
    }
}
