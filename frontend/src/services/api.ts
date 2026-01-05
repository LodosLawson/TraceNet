
const API_BASE = 'http://localhost:3000'; // Adjust if needed

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
    }
};
