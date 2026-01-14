
const NODE_URL = 'https://tracenet-blockchain-136028201808.us-central1.run.app';

async function checkGenesis() {
    try {
        const response = await fetch(`${NODE_URL}/rpc/block/0`);
        const data = await response.json();
        if (data.hash) {
            console.log('Genesis Hash (remote):', data.hash);
        } else {
            console.error('Failed to get genesis:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}
checkGenesis();
