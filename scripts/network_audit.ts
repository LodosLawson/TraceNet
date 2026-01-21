
import { Blockchain } from '../src/blockchain/core/Blockchain';
import { Mempool } from '../src/node/Mempool';
import { SocialPool } from '../src/node/SocialPool';
import { ValidatorPool } from '../src/consensus/ValidatorPool';
import { BlockProducer } from '../src/consensus/BlockProducer';
import { P2PNetwork } from '../src/node/P2PNetwork';
import { LocalDatabase } from '../src/database/LocalDatabase';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { Block } from '../src/blockchain/models/Block';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import path from 'path';

// --- CONFIG ---
const BASE_PORT = 4000;
const NODE_COUNT = 5;
const BLOCK_TIME_MS = 2000; // Accelerated for test

class SimulatedNode {
    id: number;
    port: number;
    blockchain: Blockchain;
    mempool: Mempool;
    socialPool: SocialPool;
    validatorPool: ValidatorPool;
    blockProducer: BlockProducer;
    p2pNetwork: P2PNetwork;
    localDb: LocalDatabase;
    httpServer: http.Server;
    io: SocketIOServer;

    // Keys
    validatorPrivateKey: string;
    validatorPublicKey: string;
    nodePrivateKey: string;
    nodePublicKey: string;
    validatorId: string;

    constructor(id: number) {
        this.id = id;
        this.port = BASE_PORT + id;

        // Keys
        const vKeys = KeyManager.generateWalletFromMnemonic(); // Reuse wallet gen for keys
        this.validatorPrivateKey = vKeys.privateKey;
        this.validatorPublicKey = vKeys.publicKey;
        this.validatorId = `validator_${this.validatorPublicKey.substring(0, 8)}`;

        const nKeys = KeyManager.generateWalletFromMnemonic();
        this.nodePrivateKey = nKeys.privateKey;
        this.nodePublicKey = nKeys.publicKey;

        // DB (Isolated)
        const dbPath = `./data_sim_node_${id}`;
        if (fs.existsSync(dbPath)) {
            fs.rmSync(dbPath, { recursive: true, force: true });
        }
        this.localDb = new LocalDatabase(dbPath);

        // Components
        this.mempool = new Mempool(1000, 3600000);
        this.socialPool = new SocialPool(this.mempool, this.nodePrivateKey, this.nodePublicKey);
        this.validatorPool = new ValidatorPool();

        // Register myself
        this.validatorPool.registerValidator(this.validatorId, `node_${id}`, this.validatorPublicKey);
        this.validatorPool.setOnline(this.validatorId);

        // Blockchain
        this.blockchain = new Blockchain(this.validatorId, this.validatorPool);

        // Server
        this.httpServer = http.createServer();
        this.io = new SocketIOServer(this.httpServer, { cors: { origin: '*' } });

        // P2P
        this.p2pNetwork = new P2PNetwork(
            this.blockchain,
            this.mempool,
            this.validatorPool,
            this.io,
            this.port,
            this.localDb,
            this.validatorPublicKey,
            this.validatorPrivateKey
        );

        // Block Producer (Only Node 0 will act as primary proposer initially, but logic allows all)
        this.blockProducer = new BlockProducer(
            this.blockchain,
            this.validatorPool,
            this.mempool,
            { distributeBlockReward: () => [], distributeSignatureRewards: () => [] } as any, // Mock RewardDistributor
            BLOCK_TIME_MS,
            100,
            this.nodePublicKey
        );

        // Register local key in producer
        this.blockProducer.registerLocalValidator(this.validatorId, this.validatorPrivateKey);

        // Wiring
        this.setupEvents();
    }

    private setupEvents() {
        // Broadcast Block
        this.blockProducer.on('newBlock', (data) => {
            console.log(`[Node ${this.id}] 🔨 Mined Block ${data.block.index}`);
            this.p2pNetwork.broadcastBlock(data.block);
        });

        // Broadcast Proposal
        this.blockProducer.on('blockProposed', (block) => {
            console.log(`[Node ${this.id}] 🗳️ Proposed Block ${block.index}`);
            this.p2pNetwork.broadcastProposal(block);
        });

        // Handle Signatures
        this.p2pNetwork.on('blockSignatureReceived', (data) => {
            // console.log(`[Node ${this.id}] 📩 Recv Sig from ${data.validatorId}`);
            this.blockProducer.addSignature(data.validatorId, data.signature);
        });
    }

    async start() {
        return new Promise<void>((resolve) => {
            this.httpServer.listen(this.port, () => {
                console.log(`[Node ${this.id}] Listening on ${this.port}`);
                resolve();
            });
        });
    }

    async connectTo(targetPort: number) {
        this.p2pNetwork.connectToPeer(`http://localhost:${targetPort}`);
    }
}

async function runAudit() {
    console.log("=== STARTING SECURITY AUDIT & SIMULATION ===");

    const nodes: SimulatedNode[] = [];

    // 1. Initialize Nodes
    for (let i = 0; i < NODE_COUNT; i++) {
        const node = new SimulatedNode(i);
        nodes.push(node);
        await node.start();
    }

    // 2. Register All Validators on All Nodes (Genesis Setup Simulation)
    console.log("--- Genesis Setup: Exchanging Validator Info ---");
    const allValidators = nodes.map(n => ({ id: n.validatorId, pk: n.validatorPublicKey }));

    for (const node of nodes) {
        for (const v of allValidators) {
            if (v.id !== node.validatorId) {
                node.validatorPool.registerValidator(v.id, "sim_peer", v.pk);
            }
        }
    }

    // 3. Connect Mesh
    console.log("--- Connecting P2P Mesh ---");
    // Connect ring + random cross
    for (let i = 0; i < NODE_COUNT; i++) {
        const target = (i + 1) % NODE_COUNT;
        await nodes[i].connectTo(BASE_PORT + target);
        // Cross connect
        if (i < NODE_COUNT - 2) {
            await nodes[i].connectTo(BASE_PORT + i + 2);
        }
    }

    await new Promise(r => setTimeout(r, 2000)); // Wait for interactions

    // 4. Test Connectivity
    console.log("--- Phase 1: Mesh Verification ---");
    for (const node of nodes) {
        const peers = node.p2pNetwork.getPeers().length;
        console.log(`Node ${node.id} Peers: ${peers} (Expected: >= 2)`);
    }

    // 5. Test Features: Batch & Instant
    console.log("--- Phase 2: Transaction Features ---");

    // A. Instant Transaction
    console.log(">>> Sending INSTANT Transaction to Node 0");
    const instantTx = TransactionModel.create(
        nodes[4].nodePublicKey,
        nodes[1].nodePublicKey,
        TransactionType.TRANSFER,
        10, 1, Date.now()
    );
    // Sign manually (mock wallet)
    const sig = KeyManager.sign(instantTx.tx_id, nodes[4].nodePrivateKey);
    instantTx.sender_signature = sig;

    nodes[0].mempool.addTransaction(instantTx.toJSON());

    // Broadcast Instant Tx
    nodes[0].p2pNetwork.broadcastTransaction(instantTx.toJSON());

    // B. Batch Transaction (SocialPool)
    console.log(">>> Sending 5 Social Actions to Node 0 SocialPool");
    for (let i = 0; i < 5; i++) {
        nodes[0].socialPool.addSocialAction({
            type: TransactionType.LIKE,
            from_wallet: "user_" + i,
            to_wallet: "creator_x",
            amount: 5,
            timestamp: Date.now(),
            nonce: i,
            signature: "sig_mock",
            payload: { content_id: "post_1" }
        });
    }
    nodes[0].socialPool.forceFlush(); // Should create BATCH tx

    await new Promise(r => setTimeout(r, 1000));

    // 6. Test Consensus: Block Production
    console.log("--- Phase 3: Consensus (Multi-Sig) ---");
    // Force Node 0 to produce block
    await nodes[0].blockProducer.produceBlock();

    // Wait for propagation and signing
    console.log("Waiting for Consensus (5s)...");
    await new Promise(r => setTimeout(r, 5000));

    // 7. Verify Results
    console.log("--- Phase 4: Verification ---");
    const head0 = nodes[0].blockchain.getLatestBlock();
    console.log(`Node 0 Height: ${head0.index} | Hash: ${head0.hash.substring(0, 8)} | Sigs: ${head0.signatures.length}`);

    console.log("Checking Sync...");
    for (let i = 1; i < NODE_COUNT; i++) {
        const head = nodes[i].blockchain.getLatestBlock();
        console.log(`Node ${i} Height: ${head.index} | Hash: ${head.hash.substring(0, 8)}`);

        if (head.hash === head0.hash) {
            console.log(`✅ Node ${i} Synced`);
        } else {
            console.log(`❌ Node ${i} OUT OF SYNC`);
        }
    }

    // Verify Batch
    const batchTx = head0.transactions.find(t => t.type === TransactionType.BATCH);
    if (batchTx) {
        console.log(`✅ Batch Transaction Mined: ${batchTx.tx_id}`);
        console.log(`   Inner Txs: ${batchTx.payload.transactions.length}`);
    } else {
        console.log("❌ Batch Transaction NOT found in block.");
    }

    // Verify Signatures
    const quorum = Math.floor(NODE_COUNT / 2) + 1;
    if (head0.signatures.length >= quorum) {
        console.log(`✅ Quorum Met: ${head0.signatures.length}/${NODE_COUNT}`);
    } else {
        console.log(`❌ Quorum Failed: ${head0.signatures.length} (Needed ${quorum})`);
    }

    console.log("=== AUDIT COMPLETE ===");
    process.exit(0);
}

runAudit().catch(e => {
    console.error(e);
    process.exit(1);
});
