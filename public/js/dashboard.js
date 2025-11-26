// Dashboard functionality
const API_BASE = 'http://localhost:3000';

async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/rpc/status`);
        const data = await response.json();

        updateStats(data);
        updateStatusBar(true);
    } catch (error) {
        console.error('Error fetching status:', error);
        updateStatusBar(false);
    }
}

function updateStats(data) {
    const blockCount = document.getElementById('blockCount');
    const validatorCount = document.getElementById('validatorCount');
    const txCount = document.getElementById('txCount');
    const distributedCoins = document.getElementById('distributedCoins');

    if (blockCount) blockCount.textContent = data.blockchain?.blockCount || '-';
    if (validatorCount) validatorCount.textContent = data.validators?.activeCount || '-';
    if (txCount) txCount.textContent = data.blockchain?.totalTransactions || '-';
    if (distributedCoins) {
        const coins = (data.blockchain?.totalDistributedCoins || 0) / 100000000;
        distributedCoins.textContent = coins.toFixed(8);
    }

    // Remove loading class
    document.querySelectorAll('.loading').forEach(el => el.classList.remove('loading'));
}

function updateStatusBar(isOnline) {
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.textContent = isOnline ? '🟢 Bağlı - Canlı Veri' : '🔴 Bağlantı Hatası';
        statusBar.style.background = isOnline
            ? 'linear-gradient(135deg, #10b981, #059669)'
            : 'linear-gradient(135deg, #ef4444, #dc2626)';
    }
}

async function fetchRecentBlocks() {
    try {
        const response = await fetch(`${API_BASE}/blocks?limit=5`);
        const blocks = await response.json();

        displayBlocks(blocks);
    } catch (error) {
        console.error('Error fetching blocks:', error);
    }
}

function displayBlocks(blocks) {
    const container = document.getElementById('recentBlocks');
    if (!container) return;

    if (!blocks || blocks.length === 0) {
        container.innerHTML = '<div class="block-item"><div class="stat-info">Henüz blok yok</div></div>';
        return;
    }

    container.innerHTML = blocks.map(block => `
        <div class="block-item">
            <div class="block-header">
                <span class="block-index">Blok #${block.index}</span>
                <span class="block-time">${new Date(block.timestamp).toLocaleString('tr-TR')}</span>
            </div>
            <div class="block-tx-count">📝 ${block.transactions?.length || 0} işlem</div>
            <div class="block-hash">Hash: ${block.hash}</div>
        </div>
    `).join('');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    fetchRecentBlocks();

    // Refresh every 5 seconds
    setInterval(fetchStatus, 5000);
    setInterval(fetchRecentBlocks, 10000);
});
