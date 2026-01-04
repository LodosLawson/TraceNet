
import { P2PNetwork } from '../node/P2PNetwork';
import { Blockchain } from '../blockchain/core/Blockchain';
import { Mempool } from '../node/Mempool';
import { ValidatorPool } from '../consensus/ValidatorPool';
import { LocalDatabase } from '../database/LocalDatabase';
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

// Mock Blockchain & Deps
const mockBlockchain = {
    getChain: () => [{ hash: 'genesis_hash' }],
    getChainLength: () => 1,
    receiveBlock: () => ({ success: true }),
    getLatestBlock: () => ({ index: 0 }),
    validateTransaction: () => ({ valid: true }),
    processChainSegment: () => ({ success: true })
} as unknown as Blockchain;

const mockMempool = {
    addTransaction: () => { }
} as unknown as Mempool;

const mockValidatorPool = {} as unknown as ValidatorPool;
const mockDb = {
    loadPeers: async () => [],
    savePeers: async () => { }
} as unknown as LocalDatabase;

// Setup minimal server
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const port = parseInt(process.env.PORT || '3000');
const p2p = new P2PNetwork(
    mockBlockchain,
    mockMempool,
    mockValidatorPool,
    io,
    port,
    mockDb
);

// If Node 1, try connect to Node 0
if (process.env.PEER_ID === 'sim_node_1') {
    setTimeout(() => {
        console.log('Node 1 attempting to connect to Node 0...');
        p2p.connectToPeer('http://localhost:3100'); // Assuming Node 0 is at 3100
    }, 2000);
}

httpServer.listen(port, () => {
    console.log(`Sim Node listening on ${port}`);
});
