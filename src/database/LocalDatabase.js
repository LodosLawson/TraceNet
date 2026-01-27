"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDatabase = void 0;
const path_1 = __importDefault(require("path"));
const level_1 = require("level");
const Block_1 = require("../blockchain/models/Block");
class LocalDatabase {
    constructor(dataDir = './data') {
        this.dataPath = path_1.default.resolve(dataDir);
        // LevelDB database instance
        console.log(`[Database] Initializing LevelDB at ${path_1.default.join(this.dataPath, 'chain-db')}`);
        try {
            this.db = new level_1.Level(path_1.default.join(this.dataPath, 'chain-db'), { valueEncoding: 'json' });
            console.log('[Database] LevelDB instance created');
        }
        catch (err) {
            console.error('[Database] Failed to create LevelDB instance:', err);
            throw err;
        }
    }
    /**
     * Save the entire chain (optimized to only save new blocks if possible,
     * but this method signature expects full chain. We should probably add appendBlock).
     * For backward compatibility, we iterate and put blocks.
     */
    async saveChain(chain) {
        try {
            // Batch operation for performance
            const batch = this.db.batch();
            for (const block of chain) {
                // Key: block:index, Value: Block Data
                batch.put(`block:${block.index}`, block);
                // Also index by hash for fast lookup
                batch.put(`hash:${block.hash}`, block.index);
            }
            // Save head
            const latest = chain[chain.length - 1];
            if (latest) {
                batch.put('head', latest.index);
            }
            await batch.write();
            console.log(`[Database] Chain saved to LevelDB. Height: ${chain.length}`);
        }
        catch (error) {
            console.error('[Database] Failed to save chain:', error);
        }
    }
    /**
     * Load chain from disk
     */
    async loadChain() {
        console.log('[Database] Loading chain from LevelDB...');
        try {
            // Check if DB is empty or has head
            try {
                const headIndex = await this.db.get('head');
                console.log(`[Database] Found chain head at index ${headIndex}`);
                const chain = [];
                // Load blocks from 0 to head
                for (let i = 0; i <= headIndex; i++) {
                    try {
                        const blockData = await this.db.get(`block:${i}`);
                        chain.push(new Block_1.Block(blockData));
                    }
                    catch (e) {
                        console.warn(`[Database] Missing block ${i} in DB`);
                        break; // Stop if gap found
                    }
                }
                return chain.length > 0 ? chain : null;
            }
            catch (e) {
                // Head not found, db likely empty
                return null;
            }
        }
        catch (error) {
            console.error('[Database] Failed to load chain:', error);
            return null;
        }
    }
    /**
     * Save known peers
     */
    async savePeers(peers) {
        try {
            await this.db.put('known_peers', peers);
            // console.log(`[Database] Saved ${peers.length} peers.`);
        }
        catch (error) {
            console.error('[Database] Failed to save peers:', error);
        }
    }
    /**
     * Load known peers
     */
    async loadPeers() {
        try {
            const peers = await this.db.get('known_peers');
            console.log(`[Database] Loaded ${peers.length} known peers.`);
            return peers;
        }
        catch (error) {
            // Key not found is normal for first run
            return [];
        }
    }
    /**
     * Clear database (for genesis reset)
     */
    async clear() {
        try {
            await this.db.clear();
            console.log('[Database] Database cleared.');
        }
        catch (error) {
            console.error('[Database] Failed to clear database:', error);
        }
    }
}
exports.LocalDatabase = LocalDatabase;
