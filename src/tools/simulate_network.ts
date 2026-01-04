
import { fork } from 'child_process';
import * as path from 'path';

/**
 * TraceNet Network Simulator
 * Spawns multiple node processes to test:
 * 1. Cold Start / Bootstrapping
 * 2. Peer Discovery
 * 3. Rate Limiting (Flooding)
 */

const NUM_NODES = 2; // Keep it light
const BASE_PORT = 3100;

console.log('🌍 Starting TraceNet Network Simulator...');
console.log(`Simulating ${NUM_NODES} nodes starting at port ${BASE_PORT}...\n`);

const childProcs: any[] = [];

// Helper to spawn a node
function spawnNode(index: number) {
    const port = BASE_PORT + index;
    // We need a separate script entry point that acts like a node but allows port override
    // Or we use the main index.ts and pass PORT env

    // Check if we can just use ts-node on src/index.ts
    const env = {
        ...process.env,
        PORT: port.toString(),
        // Different DB paths to avoid locking
        DATABASE_URL: `postgres://user:pass@localhost:5432/tracenet_sim_${index}`, // Mock, likely won't connect if real DB needed
        // For local leveldb, use different dirs if implemented
        NODE_ENV: 'development',
        PEER_ID: `sim_node_${index}`
    };

    // If P2P network uses LevelDB, we need to ensure they don't lock same dir.
    // Assuming P2PNetwork uses 'peers' dir or similar.

    console.log(`[Sim] Spawning Node ${index} on port ${port}...`);

    // We'll spawn a "Light Node" script instead of full index to avoid DB reqs if possible.
    // If not, we run the real index.ts but expect DB errors (which is fine for P2P test usually if handled)

    // Ideally we create a 'src/tools/sim_node.ts' that just starts P2P + Mock Blockchain.
    const proc = fork(path.join(__dirname, 'sim_node.ts'), [], { env });

    proc.on('message', (msg) => {
        console.log(`[Node ${index}]`, msg);
    });

    childProcs.push(proc);
}

// Check if sim_node exists, if not create it first? 
// We will write sim_node.ts in next step.
// For now, let's assume we will have it.

async function run() {
    // Spawn Node 0 (Bootstrap-like)
    spawnNode(0);

    // Wait for it to init
    await new Promise(r => setTimeout(r, 3000));

    // Spawn Node 1
    spawnNode(1);

    // Wait for connection
    setTimeout(() => {
        console.log('\n✅ Simulation running. Watch logs for connection success.');
        console.log('Press Ctrl+C to stop all nodes.');
    }, 2000);
}

run();

// Cleanup
process.on('SIGINT', () => {
    console.log('\nStopping simulation...');
    childProcs.forEach(p => p.kill());
    process.exit();
});
