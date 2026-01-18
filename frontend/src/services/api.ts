
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
    },

    // --- Content & Social API ---

    async getContentFeed(limit = 20, offset = 0): Promise<any> {
        const response = await fetch(`${API_BASE}/api/content/feed?limit=${limit}&offset=${offset}`);
        if (!response.ok) return { contents: [], total: 0 };
        return response.json();
    },

    async likeContent(data: {
        wallet_id: string;
        content_id: string;
        timestamp: number;
        signature: string;
        public_key: string;
        instant?: boolean;
    }): Promise<any> {
        const response = await fetch(`${API_BASE}/api/social/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to like content');
        }
        return response.json();
    },

    async commentContent(data: {
        wallet_id: string;
        content_id: string;
        comment_text: string;
        parent_comment_id?: string;
        timestamp: number;
        signature: string;
        public_key: string;
        instant?: boolean;
    }): Promise<any> {
        const response = await fetch(`${API_BASE}/api/social/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to comment');
        }
        return response.json();
    },

    async sendTransaction(data: {
        from_wallet: string;
        to_wallet: string;
        amount: number;
        fee?: number;
        sender_public_key: string;
        sender_signature: string;
        priority?: string;
    }): Promise<any> {
        const response = await fetch(`${API_BASE}/rpc/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to send transaction');
        }
        return response.json();
    },

    async sendBatch(data: {
        transactions: any[];
        sender_public_key: string;
        sender_signature: string;
        timestamp: number;
    }): Promise<any> {
        // Construct BATCH transaction payload
        // This assumes the backend's /rpc/sendRawTx handles BATCH type
        // Or we use a specific batch endpoint if it existed.
        // For now, mapping to sendRawTx with type='BATCH'
        const batchTx = {
            from_wallet: data.transactions[0].from_wallet, // Assume all from same wallet for simplicity
            to_wallet: 'BATCH_PROCESSOR', // or Network Address
            type: 'BATCH',
            amount: 0,
            fee: 0, // Calculated by node or pre-calc
            nonce: Date.now() % 1000000,
            timestamp: data.timestamp,
            sender_public_key: data.sender_public_key,
            sender_signature: data.sender_signature,
            payload: {
                transactions: data.transactions
            }
        };

        const response = await fetch(`${API_BASE}/rpc/sendRawTx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchTx)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to send batch');
        }
        return response.json();
    }
};
