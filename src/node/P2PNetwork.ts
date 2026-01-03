import io, { Socket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from './Mempool';
import { Block } from '../blockchain/models/Block';
import { Transaction } from '../blockchain/models/Transaction';
import { ValidatorPool } from '../consensus/ValidatorPool';
import * as geoip from 'geoip-lite';

interface Peer {
    url: string;
    socket: Socket;
    id: string;
    height: number;
    country?: string;
    region?: string;
    city?: string;
    ip?: string;
}


export class P2PNetwork {
    private blockchain: Blockchain;
    private mempool: Mempool;
    private validatorPool: ValidatorPool;
    private peers: Map<string, Peer> = new Map();
    private server: SocketIOServer;
    private myPort: number;
    private knownPeers: Set<string> = new Set();
    private isSyncing: boolean = false;
    private readonly MAX_PEERS = 50;
    private connectedIPs: Map<string, string> = new Map(); // IP -> Node ID (anti-sybil)
    private peerStore: any; // PeerStore instance (initialized in start())
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor(
        blockchain: Blockchain,
        mempool: Mempool,
        validatorPool: ValidatorPool,
        server: SocketIOServer,
        port: number
    ) {
        this.blockchain = blockchain;
        this.mempool = mempool;
        this.validatorPool = validatorPool;
        this.server = server;
        this.myPort = port;

        this.setupServerHandlers();
    }

    /**
     * Connect to a peer
     */
    public connectToPeer(peerUrl: string): void {
        if (this.peers.size >= this.MAX_PEERS) {
            console.warn(`[P2P] Max peers reached (${this.MAX_PEERS}). Ignoring connect request to ${peerUrl}`);
            return;
        }
        if (this.peers.has(peerUrl) || peerUrl === `http://localhost:${this.myPort}`) return;

        console.log(`[P2P] Connecting to peer: ${peerUrl}`);
        const socket = io(peerUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log(`[P2P] Connected to ${peerUrl}`);
            this.setupClientHandlers(socket, peerUrl);

            // Handshake
            socket.emit('p2p:handshake', {
                port: this.myPort,
                publicHost: process.env.PUBLIC_HOST, // Send my public IP/Domain
                height: this.blockchain.getChainLength(),
                version: '2.5.0',
            });
        });

        socket.on('connect_error', (err) => {
            console.warn(`[P2P] Connection error to ${peerUrl}: ${err.message}`);
        });
    }

    /**
     * Broadcast a new block to all peers
     */
    public broadcastBlock(block: Block): void {
        console.log(`[P2P] Broadcasting block ${block.index}`);
        this.server.emit('p2p:newBlock', block.toJSON());
        // Also send to connected peers via client sockets?
        // Usually server.emit broadcasts to all *incoming* connections.
        // We also need to send to *outgoing* connections.
        this.peers.forEach(peer => {
            peer.socket.emit('p2p:newBlock', block.toJSON());
        });
    }

    /**
     * Broadcast a new transaction
     */
    public broadcastTransaction(tx: Transaction): void {
        this.server.emit('p2p:newTransaction', tx);
        this.peers.forEach(peer => {
            peer.socket.emit('p2p:newTransaction', tx);
        });
    }

    /**
     * Setup handlers for incoming connections (Server)
     */
    private setupServerHandlers(): void {
        this.server.on('connection', (socket) => {
            // ✅ ANTI-SYBIL: Extract and check IP immediately
            const clientIP = this.extractClientIP(socket);

            // Check if this IP already has an active connection
            if (this.connectedIPs.has(clientIP)) {
                const existingNodeId = this.connectedIPs.get(clientIP);
                console.log(`[P2P] ❌ REJECTED: IP ${clientIP} already has active node (${existingNodeId})`);
                console.log(`[P2P] Anti-Sybil: Only one node per IP address allowed`);

                // Notify client and disconnect
                socket.emit('error', {
                    message: 'Anti-Sybil Protection: Only one node per IP address allowed',
                    code: 'DUPLICATE_IP',
                    existingNode: existingNodeId
                });
                socket.disconnect(true);
                return; // Stop processing this connection
            }

            console.log(`[P2P] ✅ IP ${clientIP} is new, allowing connection...`);

            // Wait for handshake to register peer?
            // Or just listen to events.

            socket.on('p2p:handshake', (data: any) => {
                this.handleHandshake(socket, data, true); // Incoming

                // Respond with my info
                socket.emit('p2p:handshake', {
                    port: this.myPort,
                    publicHost: process.env.PUBLIC_HOST,
                    height: this.blockchain.getChainLength(),
                    version: '2.5.0',
                });
            });

            socket.on('p2p:newBlock', (blockData: any) => {
                this.handleNewBlock(blockData);
            });

            socket.on('p2p:newTransaction', (txData: any) => {
                this.handleNewTransaction(txData);
            });

            socket.on('p2p:requestChain', (data: any) => {
                this.handleRequestChain(socket, data);
            });

            socket.on('p2p:sendChain', (data: any) => {
                this.handleReceiveChain(data);
            });

            socket.on('p2p:requestPeers', () => {
                socket.emit('p2p:sendPeers', Array.from(this.knownPeers));
            });

            // Clean up IP tracking when socket disconnects
            socket.on('disconnect', () => {
                const nodeId = this.connectedIPs.get(clientIP);
                if (nodeId) {
                    console.log(`[P2P] Node ${nodeId} disconnected, freeing IP ${clientIP}`);
                    this.connectedIPs.delete(clientIP);
                }
            });
        });
    }

    /**
     * Setup handlers for outgoing connections (Client)
     */
    /**
     * Setup handlers for outgoing connections (Client)
     */
    private setupClientHandlers(socket: Socket, peerUrl: string): void {
        socket.on('p2p:handshake', (data: any) => {
            // Response to my handshake involved?
            // Actually currently handshake is one-way announce.
            // We can register them.
            this.handleHandshake(socket, data, false, peerUrl);

            // 🚀 DISCOVERY: Ask for their peers immediately after handshake
            socket.emit('p2p:requestPeers');
        });

        socket.on('p2p:newBlock', (blockData: any) => {
            this.handleNewBlock(blockData);
        });

        socket.on('p2p:newTransaction', (txData: any) => {
            this.handleNewTransaction(txData);
        });

        socket.on('p2p:sendChain', (data: any) => {
            this.handleReceiveChain(data);
        });

        socket.on('p2p:sendPeers', (peers: string[]) => {
            console.log(`[P2P] Received ${peers.length} peers from ${peerUrl}`);
            let newPeersCount = 0;

            peers.forEach(p => {
                // Don't add myself or localhost to known list if I'm public
                if (p !== `http://localhost:${this.myPort}` && !this.knownPeers.has(p)) {
                    if (this.knownPeers.size < 500) { // Hardcoded limit for now, should use Config
                        this.knownPeers.add(p);
                        newPeersCount++;
                    }
                }
            });

            if (newPeersCount > 0) {
                console.log(`[P2P] Added ${newPeersCount} new peers. Total known: ${this.knownPeers.size}`);
                // 🚀 FAILOVER / AUTO-CONNECT
                // If we have few connections, try connecting to these new peers
                if (this.peers.size < 5) {
                    this.connectToRandomPeers();
                }
            }
        });
    }

    /**
     * Connect to random peers from known list
     */
    private connectToRandomPeers() {
        if (this.isSyncing) return;

        const candidates = Array.from(this.knownPeers).filter(p => !this.peers.has(p));
        // Shuffle
        candidates.sort(() => Math.random() - 0.5);

        // Try top 3
        for (let i = 0; i < Math.min(3, candidates.length); i++) {
            this.connectToPeer(candidates[i]);
        }
    }


    /**
     * Extract IP from URL and lookup geolocation
     */
    private getLocationFromUrl(url: string): { ip?: string; country?: string; region?: string; city?: string } {
        try {
            // Extract hostname/IP from URL
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            // Skip localhost/private IPs
            if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
                return { ip: hostname, country: 'Local', region: 'N/A', city: 'N/A' };
            }

            // Lookup geolocation
            const geo = geoip.lookup(hostname);
            if (geo) {
                return {
                    ip: hostname,
                    country: geo.country,
                    region: geo.region,
                    city: geo.city
                };
            }

            return { ip: hostname };
        } catch (error) {
            return {};
        }
    }

    /**
     * Check if IP is localhost or private range
     */
    private isLocalOrPrivateIP(ip: string): boolean {
        if (!ip) return true;

        // IPv6 localhost
        if (ip === '::1' || ip === '::ffff:127.0.0.1') return true;

        // IPv4 localhost
        if (ip.startsWith('127.')) return true;

        // Private ranges
        if (ip.startsWith('10.')) return true;
        if (ip.startsWith('192.168.')) return true;
        if (ip.startsWith('172.')) {
            const second = parseInt(ip.split('.')[1]);
            if (second >= 16 && second <= 31) return true;
        }

        return false;
    }

    /**
     * Extract real client IP from socket (handles proxies and Cloud Run)
     */
    private extractClientIP(socket: any): string {
        // Priority 1: X-Forwarded-For header (for proxies/load balancers)
        const forwarded = socket.handshake.headers['x-forwarded-for'];
        if (forwarded) {
            // X-Forwarded-For can contain multiple IPs, take the first (client)
            const clientIP = forwarded.split(',')[0].trim();
            console.log(`[P2P] Extracted IP from X-Forwarded-For: ${clientIP}`);
            return clientIP;
        }

        // Priority 2: Direct socket address
        const socketIP = socket.handshake.address;
        console.log(`[P2P] Using socket IP: ${socketIP}`);
        return socketIP;
    }

    private handleHandshake(socket: any, data: any, isIncoming: boolean, peerUrl?: string) {
        const theirId = peerUrl || `incoming_${socket.id}`; // Simple ID

        // Extract client IP using consistent method
        const clientIP = this.extractClientIP(socket);

        // NEW: Extract location from client IP
        let location: any = {};
        if (isIncoming) {
            console.log(`[P2P] Incoming handshake from IP: ${clientIP}`);

            // Perform geolocation on client IP
            try {
                const geo = geoip.lookup(clientIP);
                if (geo) {
                    location = {
                        ip: clientIP,
                        country: geo.country,
                        region: geo.region,
                        city: geo.city
                    };
                } else {
                    // No geolocation data (localhost or private IP)
                    location = {
                        ip: clientIP,
                        country: this.isLocalOrPrivateIP(clientIP) ? 'Local/Private' : 'Unknown',
                        region: 'N/A',
                        city: 'N/A'
                    };
                }
            } catch (err) {
                console.warn(`[P2P] Geolocation failed for ${clientIP}:`, err);
                location = { ip: clientIP, country: 'Unknown', region: 'N/A', city: 'N/A' };
            }

            // ✅ Register this IP -> Node ID mapping (anti-sybil tracking)
            this.connectedIPs.set(clientIP, theirId);
            console.log(`[P2P] Registered IP ${clientIP} -> Node ${theirId}`);
        } else if (peerUrl) {
            // Outgoing connection - extract location from URL
            location = this.getLocationFromUrl(peerUrl);
        }

        const peer: Peer = {
            url: peerUrl || 'unknown', // If incoming, we don't strictly know their public URL unless they sent it
            socket: socket,
            id: theirId,
            height: data.height || 0,
            ...location
        };

        if (isIncoming && data.port) {
            // Construct their likely URL assuming same IP
            // For local network simulation this is tricky.
            // But we'll trust their announced port?
            // We won't connect back immediately to avoid loops, or we check if connected.
        }

        this.peers.set(theirId, peer);
        console.log(`[P2P] Handshake with ${peer.id} (Height: ${peer.height}, Location: ${peer.city || 'N/A'}, ${peer.region || 'N/A'}, ${peer.country || 'Unknown'}, IP: ${peer.ip || 'N/A'})`);

        // Check Sync
        this.checkForSync(peer);
    }

    private checkForSync(peer: Peer) {
        const myHeight = this.blockchain.getChainLength();
        if (peer.height > myHeight) {
            console.log(`[P2P] Peer ${peer.id} is ahead (${peer.height} > ${myHeight}). Requesting chain...`);
            peer.socket.emit('p2p:requestChain', { fromHeight: myHeight });
            this.isSyncing = true;
        }
    }

    private handleNewBlock(blockData: any) {
        if (this.isSyncing) return; // Ignore single blocks while syncing

        const block = new Block(blockData);
        // Basic validation before processing
        if (!block || !block.hash) return;

        console.log(`[P2P] Received block ${block.index} from peer`);

        const result = this.blockchain.receiveBlock(block);
        if (result.success) {
            console.log(`[P2P] Block ${block.index} added to chain`);
            // Stop my own mining if I was mining? (Handled by BlockProducer listening to Blockchain events ideally)
        } else {
            console.warn(`[P2P] Block ${block.index} rejected: ${result.error}`);
            // Check if we need full sync (e.g. index gap)
            const latest = this.blockchain.getLatestBlock();
            if (block.index > latest.index + 1) {
                console.log(`[P2P] Detected gap (My Height: ${latest.index}, Block Height: ${block.index}). Requesting full chain sync...`);

                // Find the peer that sent this block (or any ahead peer)
                // Since this method is generic for incoming socket events, we need to find the peer instance.
                // In a perfect world we pass the peer context. For now, we iterate.
                for (const peer of this.peers.values()) {
                    // We don't know exactly WHO sent it without context, but we can ask anyone who is ahead.
                    // Or simply broadcast the request to everyone.
                    peer.socket.emit('p2p:requestChain', { fromHeight: latest.index + 1 });
                    this.isSyncing = true;
                    break; // Ask one peer to avoid flooding
                }
            }
        }
    }

    private handleNewTransaction(txData: any) {
        // Add to mempool
        const validation = this.blockchain.validateTransaction(txData); // Dry run check
        if (validation.valid) {
            this.mempool.addTransaction(txData);
            // console.log(`[P2P] Added tx ${txData.tx_id} to mempool`);
        }
    }

    private handleRequestChain(socket: any, data: any) {
        // Send blocks starting from requested height
        // Limit to 500 blocks for example
        const chain = this.blockchain.getChain();
        const start = data.fromHeight || 0;
        const chunk = chain.slice(start); // Should limit size in production

        console.log(`[P2P] Sending ${chunk.length} blocks to peer`);
        socket.emit('p2p:sendChain', { blocks: chunk.map(b => b.toJSON()) });
    }

    private handleReceiveChain(data: any) {
        if (!data.blocks || !Array.isArray(data.blocks)) return;

        console.log(`[P2P] Received chain of ${data.blocks.length} blocks`);
        const blocks = data.blocks.map((b: any) => new Block(b));

        const result = this.blockchain.processChainSegment(blocks);
        if (result.success) {
            console.log(`[P2P] Synced ${blocks.length} blocks successfully.`);
            this.isSyncing = false;
        } else {
            console.error(`[P2P] Sync failed: ${result.error}`);
            this.isSyncing = false;
        }
    }

    public getPeers(): Peer[] {
        return Array.from(this.peers.values());
    }

    /**
     * Get all known peer URLs (connected + disconnected)
     * Used by Frontend for failover
     */
    public getKnownPeers(): string[] {
        return Array.from(this.knownPeers);
    }
}

