
import { P2PNetwork } from '../P2PNetwork';

/**
 * Peer Discovery Service
 * 
 * Uses Gossip protocol to discover new peers.
 * - Asks connected peers for their known peers.
 * - Validates and adds new peers.
 * - Manages bootstrap nodes.
 */
export class PeerDiscovery {
    private network: P2PNetwork;
    private discoveryInterval: NodeJS.Timeout | null = null;
    private readonly DISCOVERY_INTERVAL_MS = 60000; // 1 minute

    constructor(network: P2PNetwork) {
        this.network = network;
    }

    public start() {
        console.log('[PeerDiscovery] Starting Discovery Service...');
        this.discover();
        this.discoveryInterval = setInterval(() => this.discover(), this.DISCOVERY_INTERVAL_MS);
    }

    public stop() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = null;
        }
    }

    private discover() {
        const connectedPeers = this.network.getPeers();
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
}
