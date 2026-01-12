
const API_BASE = '';

export interface UserResponse {
    user: {
        nickname: string;
        public_key: string;
    };
    wallet: {
        wallet_id: string;
    };
    credentials?: {
        mnemonic: string;
        privateKey: string;
    };
}

export interface NodeInfo {
    id?: string;
    ip?: string;
    url: string;
    lat?: number;
    lng?: number;
    region?: string;
    country?: string;
    city?: string; // Added city as well since backend sends it
    status: string;
}

export const api = {
    async createUser(nickname: string): Promise<UserResponse> {
        const response = await fetch(`${API_BASE}/api/user/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nickname }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to create user');
        }

        return response.json();
    },

    async mine(minerAddress: string) {
        await fetch(`${API_BASE}/rpc/mine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minerAddress })
        });
    },

    async getDiscoveredNodes(): Promise<NodeInfo[]> {
        const response = await fetch(`${API_BASE}/api/nodes/discover`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.nodes;
    },

    async getPeers(): Promise<NodeInfo[]> {
        const response = await fetch(`${API_BASE}/rpc/peers`);
        if (!response.ok) return [];
        return response.json();
    },

    async getNetworkStats() {
        const response = await fetch(`${API_BASE}/rpc/status`);
        if (!response.ok) return null;
        return response.json();
    },

    async getBlocks(limit = 20): Promise<any[]> {
        const response = await fetch(`${API_BASE}/rpc/blocks?limit=${limit}`);
        if (!response.ok) return [];
        return response.json();
    },

    async getRecentTransactions(limit = 20): Promise<any[]> {
        // Fetch blocks and extract transactions
        const blocks = await this.getBlocks(10); // Get last 10 blocks
        const txs: any[] = [];
        blocks.forEach(block => {
            if (block.transactions) {
                block.transactions.forEach((tx: any) => {
                    txs.push({ ...tx, blockHeight: block.index, timestamp: block.timestamp });
                });
            }
        });
        // Sort by time new -> old and slice
        return txs.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    async fetchWalletInfo(walletId: string): Promise<{
        wallet_id: string;
        balance: number;
        available_balance: number;
        pending_deductions: number;
        nonce: number;
    }> {
        const response = await fetch(`${API_BASE}/rpc/balance/${walletId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch wallet info');
        }
        return response.json();
    }
};
