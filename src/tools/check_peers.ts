import fetch from 'node-fetch';

const nodes = [
    { name: 'US Node', url: 'https://tracenet-blockchain-136028201808.us-central1.run.app' },
    { name: 'EU Node', url: 'https://tracenet-blockchain-nodeeu-136028201808.europe-west1.run.app' },
    { name: 'Local/Ngrok', url: 'https://rotundly-symphysial-sharonda.ngrok-free.dev' }
];

async function checkPeers() {
    for (const node of nodes) {
        try {
            console.log(`\n--- Checking ${node.name} (${node.url}) ---`);
            const response = await fetch(`${node.url}/rpc/peers`);
            if (response.ok) {
                const peers = await response.json();
                console.log(`Connected Peers: ${peers.length}`);
                peers.forEach((p: any) => {
                    console.log(` - ${p.url} (Country: ${p.country}, Status: ${p.status})`);
                });

                // Check if it knows the others
                const otherNodes = nodes.filter(n => n.url !== node.url);
                const missing = otherNodes.filter(n => !peers.find((p: any) => p.url === n.url));

                if (missing.length === 0) {
                    console.log('✅ Knows known validators');
                } else {
                    console.log('⚠️ Missing peers:');
                    missing.forEach(m => console.log(`   - ${m.name} (${m.url})`));
                }

            } else {
                console.log(`❌ Failed to fetch peers. Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Error connecting: ${error.message}`);
        }
    }
}

checkPeers();
