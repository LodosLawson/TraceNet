import { P2PNetwork } from '../P2PNetwork';
import { NETWORK_CONFIG } from '../../blockchain/config/NetworkConfig';

/**
 * Peer Discovery Service
 * 
 * Uses Gossip protocol to discover new peers.
 * - Asks connected peers for their known peers.
 * - Validates and adds new peers.
 * - Manages bootstrap nodes.
 * - 🌍 Uses HTTP Seeding (DNS Seeds) as a fallback.
 */
export class PeerDiscovery {
    private network: P2PNetwork;
    private discoveryInterval: NodeJS.Timeout | null = null;
    private readonly DISCOVERY_INTERVAL_MS = 60000; // 1 minute
    private lastSeedAttempt: number = 0;

    constructor(network: P2PNetwork) {
        this.network = network;
    }

    public start() {
        console.log('[PeerDiscovery] Starting Discovery Service...');
        this.discover();
        this.discoveryInterval = setInterval(() => this.discover(), this.DISCOVERY_INTERVAL_MS);

        // 📢 NEW: Announce existence to the world on startup
        setTimeout(() => this.announceSelf(), 5000);
    }

    public stop() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
    }

    private async discover() {
        const connectedPeers = this.network.getPeers(); // Ensure this method exists in P2PNetwork
        const knownPeersCount = connectedPeers.length;

        console.log(`[PeerDiscovery] Discovery Cycle. Connected: ${knownPeersCount}`);

        // 🚨 CRITICAL: If isolated, use HTTP Seeding (The "Phonebook" Strategy)
        if (knownPeersCount < 2 && (Date.now() - this.lastSeedAttempt > 300000)) { // Retry every 5 mins
            console.log('[PeerDiscovery] ⚠️ Low peer count. Attempting HTTP Seeding...');
            await this.fetchSeeds();
            this.lastSeedAttempt = Date.now();

            // Re-announce if we are lonely
            this.announceSelf();
        }

        if (connectedPeers.length === 0) {
            console.log('[PeerDiscovery] No peers connected. Attempting bootstrap...');
            // Logic to retry bootstrap is already in P2PNetwork constructor/init
            // We can trigger it again if exposed, or P2PNetwork handles it internally
        }

        // Ask a random subset of peers for their peer list
        const maxAsk = 3;
        const targets = connectedPeers
            .sort(() => Math.random() - 0.5)
            .slice(0, maxAsk);

        targets.forEach(peer => {
            // console.log(`[PeerDiscovery] Asking ${peer.id} for new peers...`);
            peer.socket.emit('p2p:requestPeers');
        });
    }

    /**
     * 🌍 HTTP Seeding: Fetch active nodes from GitHub/Web
     * This solves the "Bootstrap Problem" where new nodes don't know anyone.
     */
    private async fetchSeeds() {
        if (!NETWORK_CONFIG.DNS_SEEDS || NETWORK_CONFIG.DNS_SEEDS.length === 0) return;

        for (const seedUrl of NETWORK_CONFIG.DNS_SEEDS) {
            try {
                console.log(`[PeerDiscovery] 🌍 Fetching seeds from ${seedUrl}...`);
                const response = await fetch(seedUrl);
                if (!response.ok) throw new Error(`Status ${response.status}`);

                const nodes = await response.json();
                if (Array.isArray(nodes) && nodes.length > 0) {
                    console.log(`[PeerDiscovery] ✅ Found ${nodes.length} nodes from seed.`);

                    // Filter and validate URLs
                    const validNodes = nodes.filter((url: string) => {
                        try {
                            const u = new URL(url);
                            return u.protocol.startsWith('http');
                        } catch (e) {
                            return false;
                        }
                    });

                    // Try to connect to them
                    validNodes.forEach((nodeUrl: string) => {
                        this.network.connectToPeer(nodeUrl);
                    });

                    // If we found nodes, stop trying other seeds to save bandwidth
                    if (validNodes.length > 0) break;
                }
            } catch (err) {
                console.warn(`[PeerDiscovery] ❌ Failed to fetch seeds from ${seedUrl}:`, err);
            }
        }
    }

    /**
     * 📢 Self-Announcement: Let the network know we are here
     */
    public async announceSelf() {
        const publicHost = process.env.PUBLIC_HOST;
        if (!publicHost || publicHost.includes('localhost') || publicHost.includes('127.0.0.1')) {
            // console.log('[PeerDiscovery] Skipping announcement: PUBLIC_HOST is local or missing.');
            return;
        }

        console.log(`[PeerDiscovery] 📢 Announcing our presence (${publicHost}) to bootstrap nodes...`);

        const targets = NETWORK_CONFIG.BOOTSTRAP_NODES;

        for (const target of targets) {
            if (target === publicHost) continue; // Don't announce to self

            try {
                // We use the RPC API to announce
                const registrationUrl = `${target}/api/nodes/announce`;

                // Fire and forget (don't await to avoid blocking)
                fetch(registrationUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: publicHost })
                }).then(res => {
                    if (res.ok) console.log(`[PeerDiscovery] ✅ Successfully announced to ${target}`);
                }).catch(() => { });

            } catch (err) {
                // Ignore errors
            }
        }
    }
}
