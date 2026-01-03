/**
 * Peer Store - TraceNet V3.0
 * 
 * Persists discovered peers to LevelDB for network resilience
 */

import { Level } from 'level';
import * as path from 'path';

export interface PeerMetadata {
    url: string;
    lastSeen: number;
    height: number;
    country?: string;
    region?: string;
    city?: string;
    successfulConnections: number;
    failedConnections: number;
}

export class PeerStore {
    private db: Level<string, string>;

    constructor(dataPath: string = './data/peers') {
        this.db = new Level(dataPath, { valueEncoding: 'json' });
    }

    /**
     * Save peer to database
     */
    async savePeer(peer: PeerMetadata): Promise<void> {
        try {
            await this.db.put(`peer:${peer.url}`, JSON.stringify(peer));
        } catch (error) {
            console.error(`[PeerStore] Error saving peer ${peer.url}:`, error);
        }
    }

    /**
     * Load all known peers
     */
    async loadPeers(): Promise<PeerMetadata[]> {
        const peers: PeerMetadata[] = [];

        try {
            for await (const [key, value] of this.db.iterator({ gte: 'peer:', lte: 'peer:~' })) {
                try {
                    const peer = JSON.parse(value as string) as PeerMetadata;
                    peers.push(peer);
                } catch (err) {
                    console.error(`[PeerStore] Error parsing peer ${key}:`, err);
                }
            }
        } catch (error) {
            console.error('[PeerStore] Error loading peers:', error);
        }

        return peers;
    }

    /**
     * Update peer metadata
     */
    async updatePeer(url: string, updates: Partial<PeerMetadata>): Promise<void> {
        try {
            const existingData = await this.db.get(`peer:${url}`);
            const existing = JSON.parse(existingData as string) as PeerMetadata;
            const updated = { ...existing, ...updates };
            await this.db.put(`peer:${url}`, JSON.stringify(updated));
        } catch (error) {
            // Peer doesn't exist, create new
            const newPeer: PeerMetadata = {
                url,
                lastSeen: Date.now(),
                height: 0,
                successfulConnections: 0,
                failedConnections: 0,
                ...updates
            };
            await this.savePeer(newPeer);
        }
    }

    /**
     * Remove peer from database
     */
    async removePeer(url: string): Promise<void> {
        try {
            await this.db.del(`peer:${url}`);
        } catch (error) {
            console.error(`[PeerStore] Error removing peer ${url}:`, error);
        }
    }

    /**
     * Get best peers (sorted by success rate and recency)
     */
    async getBestPeers(limit: number = 10): Promise<PeerMetadata[]> {
        const allPeers = await this.loadPeers();

        // Sort by success rate and last seen
        const sorted = allPeers.sort((a, b) => {
            const aScore = a.successfulConnections / (a.successfulConnections + a.failedConnections + 1);
            const bScore = b.successfulConnections / (b.successfulConnections + b.failedConnections + 1);

            if (aScore !== bScore) return bScore - aScore;
            return b.lastSeen - a.lastSeen;
        });

        return sorted.slice(0, limit);
    }

    /**
     * Close database
     */
    async close(): Promise<void> {
        await this.db.close();
    }
}
