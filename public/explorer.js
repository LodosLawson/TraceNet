// ================================
// TraceNet Blockchain Explorer
// Real-time blockchain monitoring
// ================================

const API_BASE_URL = window.location.origin;
let currentPage = 1;
let blocksPerPage = 10;
let allBlocks = [];
let allTransactions = [];
let chartInstance = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 TraceNet Explorer Initialized');
    initializeExplorer();
    setupEventListeners();
    startAutoRefresh();
});

async function initializeExplorer() {
    await Promise.all([
        fetchNetworkStats(),
        fetchBlocks(),
        fetchValidators(),
        fetchNetworkHealth()
    ]);

    renderBlocks();
    renderTransactions();
    updateStatus('online');
}

function setupEventListeners() {
    // Search functionality
    document.getElementById('searchBtn')?.addEventListener('click', handleSearch);
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.dataset.filter;
            applyBlockFilter(filter);
        });
    });

    // Transaction type filter
    document.getElementById('txTypeFilter')?.addEventListener('change', (e) => {
        filterTransactions(e.target.value);
    });

    // Modal close on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

function startAutoRefresh() {
    // Refresh data every 5 seconds
    setInterval(async () => {
        await fetchNetworkStats();
        await fetchBlocks();
        renderBlocks();
        updateLastUpdate();
    }, 5000);
}

// ===== STATUS MANAGEMENT =====
function updateStatus(status) {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');

    if (status === 'online') {
        statusBar.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        statusText.textContent = '🟢 Ağ Bağlantısı Aktif';
    } else {
        statusBar.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        statusText.textContent = '🔴 Bağlantı Hatası';
    }

    updateLastUpdate();
}

function updateLastUpdate() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = `Son güncelleme: ${now.toLocaleTimeString('tr-TR')}`;
    }
}

// ===== NETWORK STATISTICS =====
async function fetchNetworkStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/rpc/status`);
        const data = await response.json();

        // Update statistics
        document.getElementById('totalBlocks').textContent = data.blockchain.height || 0;
        document.getElementById('totalTransactions').textContent = data.blockchain.totalTransactions || 0;
        document.getElementById('activeValidators').textContent = data.validators.onlineCount || 0;

        // Calculate and display distributed tokens
        const distributed = (data.blockchain.totalDistributedCoins || 0) / 100000;
        document.getElementById('distributedTokens').textContent =
            `${distributed.toFixed(5)} LT`;

        updateStatus('online');
        return data;
    } catch (error) {
        console.error('Error fetching network stats:', error);
        updateStatus('offline');
        return null;
    }
}

// ===== BLOCKS MANAGEMENT =====
async function fetchBlocks() {
    try {
        const response = await fetch(`${API_BASE_URL}/chain`);
        const data = await response.json();

        allBlocks = data.chain || [];
        allBlocks.reverse(); // Show newest first

        // Extract all transactions
        allTransactions = [];
        allBlocks.forEach(block => {
            if (block.transactions && block.transactions.length > 0) {
                block.transactions.forEach(tx => {
                    allTransactions.push({
                        ...tx,
                        blockIndex: block.index,
                        blockTime: block.timestamp
                    });
                });
            }
        });

        return allBlocks;
    } catch (error) {
        console.error('Error fetching blocks:', error);
        return [];
    }
}

function renderBlocks(blocks = allBlocks) {
    const container = document.getElementById('blocksContainer');
    if (!container) return;

    if (blocks.length === 0) {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Blok bulunamadı</p>
            </div>
        `;
        return;
    }

    // Pagination
    const startIndex = (currentPage - 1) * blocksPerPage;
    const endIndex = startIndex + blocksPerPage;
    const paginatedBlocks = blocks.slice(startIndex, endIndex);

    container.innerHTML = paginatedBlocks.map(block => `
        <div class="block-card fade-in" onclick="showBlockDetails(${block.index})">
            <div class="block-card-header">
                <div class="block-index">Blok #${block.index}</div>
                <div class="block-time">${formatTimestamp(block.timestamp)}</div>
            </div>
            
            <div class="block-info-grid">
                <div class="block-info-item">
                    <span class="info-label">İşlem Sayısı:</span>
                    <span class="info-value" style="color: var(--success);">
                        ${block.transactions?.length || 0} işlem
                    </span>
                </div>
                
                <div class="block-info-item">
                    <span class="info-label">Producer:</span>
                    <span class="info-value">${shortenHash(block.producer || 'N/A')}</span>
                </div>
                
                <div class="block-info-item">
                    <span class="info-label">Nonce:</span>
                    <span class="info-value">${block.nonce || 0}</span>
                </div>
                
                <div class="block-info-item">
                    <span class="info-label">Difficulty:</span>
                    <span class="info-value">${block.difficulty || 0}</span>
                </div>
            </div>
            
            <div class="block-hash">
                Hash: ${block.hash || 'N/A'}
            </div>
        </div>
    `).join('');

    renderPagination(blocks.length);
}

function applyBlockFilter(filter) {
    let filteredBlocks = [...allBlocks];

    if (filter === 'recent') {
        filteredBlocks = allBlocks.slice(0, 10);
    } else if (filter === 'genesis') {
        filteredBlocks = allBlocks.filter(b => b.index === 0);
    }

    currentPage = 1;
    renderBlocks(filteredBlocks);
}

function renderPagination(totalBlocks) {
    const pagination = document.getElementById('blocksPagination');
    if (!pagination) return;

    const totalPages = Math.ceil(totalBlocks / blocksPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let buttons = [];

    // Previous button
    buttons.push(`
        <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} 
                onclick="changePage(${currentPage - 1})">
            ◀ Önceki
        </button>
    `);

    // Page numbers
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        buttons.push(`
            <button class="page-btn ${currentPage === i ? 'active' : ''}" 
                    onclick="changePage(${i})">
                ${i}
            </button>
        `);
    }

    // Next button
    buttons.push(`
        <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} 
                onclick="changePage(${currentPage + 1})">
            Sonraki ▶
        </button>
    `);

    pagination.innerHTML = buttons.join('');
}

function changePage(page) {
    currentPage = page;
    renderBlocks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== TRANSACTIONS =====
function renderTransactions(transactions = allTransactions.slice(0, 20)) {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="loading-spinner">
                <p>İşlem bulunamadı</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => {
        const txType = (tx.type || 'TRANSFER').toLowerCase();
        return `
            <div class="tx-card fade-in" onclick="showTransactionDetails('${tx.tx_id}')">
                <div class="tx-card-header">
                    <span class="tx-type ${txType}">${tx.type || 'TRANSFER'}</span>
                    <span class="tx-amount">
                        ${formatAmount(tx.amount)} LT
                    </span>
                </div>
                
                <div class="tx-info">
                    <div>ID: ${shortenHash(tx.tx_id)}</div>
                    <div>From: ${shortenHash(tx.from || 'N/A')} → To: ${shortenHash(tx.to || 'N/A')}</div>
                    <div>Blok: #${tx.blockIndex} • ${formatTimestamp(tx.blockTime)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function filterTransactions(type) {
    let filtered = allTransactions;

    if (type !== 'all') {
        filtered = allTransactions.filter(tx => tx.type === type);
    }

    renderTransactions(filtered.slice(0, 20));
}

// ===== VALIDATORS =====
async function fetchValidators() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/validator/list`);
        const data = await response.json();

        const container = document.getElementById('validatorsList');
        if (!container) return;

        if (!data.validators || data.validators.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Validator bulunamadı</p>';
            return;
        }

        container.innerHTML = data.validators.map(v => `
            <div class="validator-item">
                <div>
                    <div style="font-weight: 600; color: var(--text-primary);">
                        ${shortenHash(v.validator_id)}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Üretilen: ${v.total_blocks_produced || 0} blok • 
                        Reputation: ${v.reputation || 0}
                    </div>
                </div>
                <div class="validator-status ${v.is_online ? '' : 'offline'}"></div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching validators:', error);
    }
}

// ===== NETWORK HEALTH =====
async function fetchNetworkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/rpc/status`);
        const data = await response.json();

        // Calculate average block time
        let avgBlockTime = 0;
        if (allBlocks.length > 1) {
            const timeDiff = allBlocks[0].timestamp - allBlocks[allBlocks.length - 1].timestamp;
            avgBlockTime = (timeDiff / allBlocks.length / 1000).toFixed(2);
        }

        // Calculate TPS (approximate)
        const totalTx = data.blockchain.totalTransactions || 0;
        const totalTime = (Date.now() - (allBlocks[allBlocks.length - 1]?.timestamp || Date.now())) / 1000;
        const tps = totalTime > 0 ? (totalTx / totalTime).toFixed(4) : 0;

        document.getElementById('avgBlockTime').textContent = `${avgBlockTime}s`;
        document.getElementById('tps').textContent = tps;
        document.getElementById('mempoolSize').textContent = `${data.mempool?.pending || 0} bekleyen`;

    } catch (error) {
        console.error('Error fetching network health:', error);
    }
}

// ===== SEARCH FUNCTIONALITY =====
async function handleSearch() {
    const query = document.getElementById('searchInput')?.value.trim();

    if (!query) {
        alert('Lütfen bir arama terimi girin');
        return;
    }

    // Check if it's a number (block index)
    if (/^\d+$/.test(query)) {
        const blockIndex = parseInt(query);
        showBlockDetails(blockIndex);
        return;
    }

    // Check if it's a block hash
    const block = allBlocks.find(b => b.hash === query);
    if (block) {
        showBlockDetails(block.index);
        return;
    }

    // Check if it's a transaction ID
    const tx = allTransactions.find(t => t.tx_id === query);
    if (tx) {
        showTransactionDetails(tx.tx_id);
        return;
    }

    // Check if it's a wallet address
    const txsForWallet = allTransactions.filter(t => t.from === query || t.to === query);
    if (txsForWallet.length > 0) {
        renderTransactions(txsForWallet);
        document.getElementById('transactions').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    alert('Sonuç bulunamadı. Lütfen geçerli bir blok numarası, hash veya cüzdan adresi girin.');
}

// ===== MODAL DETAILS =====
async function showBlockDetails(blockIndex) {
    const block = allBlocks.find(b => b.index === blockIndex);

    if (!block) {
        alert('Blok bulunamadı');
        return;
    }

    const modal = document.getElementById('blockModal');
    const modalBody = document.getElementById('blockModalBody');

    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Blok İndeksi</div>
                <div class="detail-value" style="font-size: 1.5rem; color: var(--primary);">
                    #${block.index}
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Zaman Damgası</div>
                <div class="detail-value">
                    ${new Date(block.timestamp).toLocaleString('tr-TR')}
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Hash</div>
                <div class="detail-value">${block.hash}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Previous Hash</div>
                <div class="detail-value">${block.previous_hash || 'N/A'}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Producer</div>
                <div class="detail-value">${block.producer || 'N/A'}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Nonce</div>
                <div class="detail-value">${block.nonce || 0}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Difficulty</div>
                <div class="detail-value">${block.difficulty || 0}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">İşlem Sayısı</div>
                <div class="detail-value" style="color: var(--success); font-size: 1.2rem;">
                    ${block.transactions?.length || 0} işlem
                </div>
            </div>
        </div>
        
        ${block.transactions && block.transactions.length > 0 ? `
            <div style="margin-top: 2rem;">
                <h3 style="color: var(--primary); margin-bottom: 1rem;">İşlemler</h3>
                ${block.transactions.map(tx => `
                    <div class="detail-item" style="margin-bottom: 0.75rem; cursor: pointer;" 
                         onclick="closeModal('blockModal'); setTimeout(() => showTransactionDetails('${tx.tx_id}'), 300)">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span class="tx-type ${(tx.type || 'TRANSFER').toLowerCase()}">${tx.type}</span>
                            <span style="font-weight: 700; color: var(--success);">${formatAmount(tx.amount)} LT</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                            ${shortenHash(tx.tx_id)}
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;

    modal.classList.add('active');
}

async function showTransactionDetails(txId) {
    const tx = allTransactions.find(t => t.tx_id === txId);

    if (!tx) {
        alert('İşlem bulunamadı');
        return;
    }

    const modal = document.getElementById('transactionModal');
    const modalBody = document.getElementById('transactionModalBody');

    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">İşlem Tipi</div>
                <div>
                    <span class="tx-type ${(tx.type || 'TRANSFER').toLowerCase()}">${tx.type || 'TRANSFER'}</span>
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Miktar</div>
                <div class="detail-value" style="font-size: 1.5rem; color: var(--success);">
                    ${formatAmount(tx.amount)} LT
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">İşlem ID</div>
                <div class="detail-value">${tx.tx_id}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Gönderen (From)</div>
                <div class="detail-value">${tx.from || 'N/A'}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Alıcı (To)</div>
                <div class="detail-value">${tx.to || 'N/A'}</div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Blok</div>
                <div class="detail-value" style="color: var(--primary); cursor: pointer;"
                     onclick="closeModal('transactionModal'); setTimeout(() => showBlockDetails(${tx.blockIndex}), 300)">
                    #${tx.blockIndex} (Detayları görüntüle)
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">Zaman</div>
                <div class="detail-value">
                    ${new Date(tx.blockTime).toLocaleString('tr-TR')}
                </div>
            </div>
            
            ${tx.signature ? `
                <div class="detail-item">
                    <div class="detail-label">İmza</div>
                    <div class="detail-value">${tx.signature}</div>
                </div>
            ` : ''}
            
            ${tx.metadata ? `
                <div class="detail-item">
                    <div class="detail-label">Metadata</div>
                    <div class="detail-value">
                        <pre style="background: var(--bg-primary); padding: 1rem; border-radius: 8px; overflow-x: auto;">
${JSON.stringify(tx.metadata, null, 2)}
                        </pre>
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== UTILITY FUNCTIONS =====
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} saat önce`;

    return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatAmount(amount) {
    if (!amount) return '0';
    return (amount / 100000).toFixed(5);
}

function shortenHash(hash, length = 12) {
    if (!hash) return 'N/A';
    if (hash.length <= length) return hash;
    return `${hash.slice(0, length / 2)}...${hash.slice(-length / 2)}`;
}

// Make functions available globally
window.showBlockDetails = showBlockDetails;
window.showTransactionDetails = showTransactionDetails;
window.closeModal = closeModal;
window.changePage = changePage;

console.log('✅ Explorer ready');
