import fetch from 'node-fetch';

const nodes = [
    { name: 'US Node', url: 'https://tracenet-blockchain-136028201808.us-central1.run.app' },
    { name: 'EU Node', url: 'https://tracenet-blockchain-nodeeu-136028201808.europe-west1.run.app' },
    { name: 'Local/Ngrok', url: 'https://rotundly-symphysial-sharonda.ngrok-free.dev' }
];

async function checkHealth() {
    console.log('🔍 Checking TraceNet Network Health...\n');

    const results = [];

    for (const node of nodes) {
        try {
            const start = Date.now();
            const response = await fetch(`${node.url}/rpc/status`);
            const latency = Date.now() - start;

            if (response.ok) {
                const status = await response.json();
                const height = status.blockchain.height || status.blockchain.blockCount; // Use height, fallback to blockCount
                const hash = status.blockchain.latestBlockHash;
                const mempoolSize = status.mempool ? status.mempool.size : 0;
                const lastBlockTime = status.blockchain.timestamp || status.timestamp; // Allow fallback
                const ageSeconds = lastBlockTime ? ((Date.now() - lastBlockTime) / 1000).toFixed(1) : 'N/A';

                results.push({
                    name: node.name,
                    url: node.url,
                    online: true,
                    height: height,
                    hash: hash,
                    peers: status.validators ? status.validators.count : '?', // Adjusted based on likely structure
                    mempool: mempoolSize,
                    latency: latency,
                    blockAge: ageSeconds
                });
            } else {
                results.push({
                    name: node.name,
                    url: node.url,
                    online: false,
                    error: `Status ${response.status}`
                });
            }
        } catch (error) {
            results.push({
                name: node.name,
                url: node.url,
                online: false,
                error: error.message
            });
        }
    }

    // Display Results
    console.table(results.map(r => ({
        Node: r.name,
        Online: r.online ? '✅' : '❌',
        Height: r.height,
        "Latest Hash (Short)": r.hash ? r.hash.substring(0, 10) + '...' : 'N/A',
        Mempool: r.mempool,
        Latency: r.latency + 'ms'
    })));

    // Analysis
    const onlineNodes = results.filter(r => r.online);
    if (onlineNodes.length === 0) {
        console.log('\n❌ SYSTEM CRITICAL: All nodes are offline or unreachable.');
        return;
    }

    const heights = onlineNodes.map(r => r.height);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);

    if (maxHeight === minHeight) {
        console.log(`\n✅ HEIGHT SYNC: Perfect. All nodes are at height ${maxHeight}.`);
    } else {
        console.log(`\n⚠️ HEIGHT WARNING: Nodes are not fully synced. Diff: ${maxHeight - minHeight} blocks.`);
    }

    // Hash Consistency (Check if all nodes at Max Height have same hash)
    const tips = onlineNodes.filter(r => r.height === maxHeight);
    const tipJash = tips[0].hash;
    const consistent = tips.every(r => r.hash === tipJash);

    if (consistent) {
        console.log(`✅ HASH CONSISTENCY: Nodes at tip agree on block hash.`);
    } else {
        console.log(`🚨 FORK DETECTED? Nodes at height ${maxHeight} have different hashes!`);
    }

    console.log('\nNetwork check complete.');
}

checkHealth();
