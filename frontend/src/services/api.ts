
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
    url: string;
    lat?: number;
    lng?: number;
    region?: string;
    country?: string;
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
    }
};
