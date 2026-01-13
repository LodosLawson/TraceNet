import axios from 'axios';

const NODE_URL = 'https://tracenet-blockchain-136028201808.us-central1.run.app';

async function check() {
    console.log(`Checking ${NODE_URL}...`);
    try {
        const health = await axios.get(`${NODE_URL}/health`);
        console.log('✅ /health:', health.status, health.data);
    } catch (e: any) {
        console.error('❌ /health failed:', e.message);
    }

    try {
        const stats = await axios.get(`${NODE_URL}/rpc/status`);
        console.log('✅ /rpc/status:', stats.status);
        console.log('   Height:', stats.data.blockchain.height);
        console.log('   Peers:', stats.data.validators.activeValidators);
    } catch (e: any) {
        console.error('❌ /rpc/status failed:', e.message);
    }
}

check();
