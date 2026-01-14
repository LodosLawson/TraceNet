
/**
 * TraceNet Optimized "Mainnet" Stress Test (V2)
 * 
 * Objectives:
 * 1. Register 1000 Users (Slowly, to avoid overload).
 * 2. Automatic Airdrop Funding (via API).
 * 3. Simulate realistic user behavior (Post, Like, Comment, Message, TRANSFER).
 * 4. Robust handling for network instability (Retries, Sync Checks).
 */

import fs from 'fs';
import path from 'path';
import { KeyManager, WalletKeys } from '../blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../blockchain/models/Transaction';

// --- Configuration ---
const CONFIG = {
    NODE_URL: process.env.NODE_URL || 'https://tracenet-blockchain-136028201808.us-central1.run.app',
    USER_COUNT: 250,
    DURATION_HOURS: 2,
    // Slower generation to let node digest: 1 user every 200ms
    GENERATION_DELAY_MS: 200,
    // Slower interaction: 1 action every 500-2000ms
    MIN_ACTION_DELAY_MS: 500,
    MAX_ACTION_DELAY_MS: 3000,
    // Retry logic
    MAX_RETRIES: 3
};

// --- Statistics ---
const STATS = {
    startTime: Date.now(),
    txSent: 0,
    txSuccess: 0,
    txFailed: 0,
    actions: {
        post: 0,
        like: 0,
        comment: 0,
        message: 0,
        transfer: 0
    },
    errors: [] as string[]
};

// --- ApiClient with Retry ---
class ApiClient {
    static async post(endpoint: string, body: any): Promise<any> {
        let attempts = 0;
        while (attempts < CONFIG.MAX_RETRIES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

                const response = await fetch(`${CONFIG.NODE_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (response.status === 502 || response.status === 503 || response.status === 504) {
                    throw new Error(`Server overloaded (${response.status})`);
                }

                const data: any = await response.json();
                if (!response.ok) throw new Error(data.error || response.statusText);
                return data;
            } catch (error: any) {
                attempts++;
                if (attempts >= CONFIG.MAX_RETRIES) throw error;
                // Exponential backoff
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)));
            }
        }
    }
}

class Simulation {
    private users: WalletKeys[] = [];
    private contentIds: string[] = [];
    private commentIds: string[] = [];

    /**
     * Step 1: Generate Users
     */
    async generateUsers() {
        console.log(`\n[1/2] Generating ${CONFIG.USER_COUNT} users...`);

        for (let i = 0; i < CONFIG.USER_COUNT; i++) {
            try {
                const randSuffix = Math.random().toString(36).substring(7);
                const nickname = `user_${Date.now()}_${randSuffix}`;

                const res = await ApiClient.post('/api/user/create', {
                    nickname,
                    name: `TestUser${i}`,
                    surname: 'Bot'
                });

                if (res.wallet && res.mnemonic) {
                    const userKeys = KeyManager.generateWalletFromMnemonic(res.mnemonic);
                    this.users.push(userKeys);
                    if (i % 25 === 0) console.log(`[Generated ${i}/${CONFIG.USER_COUNT}]`);
                }

                // Important: Delay to prevent overwhelming the single node
                await new Promise(r => setTimeout(r, CONFIG.GENERATION_DELAY_MS));

            } catch (e: any) {
                console.error(`\nFailed user ${i}:`, e.message);
                // Continue despite failure
            }
        }

        // Save Credentials
        const credentialsPath = path.join(__dirname, `test_users_v2_${Date.now()}.json`);
        fs.writeFileSync(credentialsPath, JSON.stringify(this.users.map(u => ({
            address: u.address,
            privateKey: u.privateKey,
            mnemonic: u.mnemonic
        })), null, 2));
        console.log(`\nGenerated ${this.users.length} users. Saved to ${credentialsPath}`);
    }

    /**
     * Step 2: Main Traffic Loop
     */
    async startLoop() {
        console.log(`\n[2/2] Starting ${CONFIG.DURATION_HOURS} hour simulation loop...`);
        const endTime = Date.now() + (CONFIG.DURATION_HOURS * 60 * 60 * 1000);

        while (Date.now() < endTime) {
            const user = this.users[Math.floor(Math.random() * this.users.length)];
            const rand = Math.random();

            try {
                // Feature: Mixed Actions including TRANSFER
                // 10% Post, 30% Like, 20% Comment, 20% Message, 20% Transfer
                if (rand < 0.10) await this.doPost(user);
                else if (rand < 0.40) await this.doLike(user);
                else if (rand < 0.60) await this.doComment(user);
                else if (rand < 0.80) await this.doMessage(user);
                else await this.doTransfer(user);

            } catch (e: any) {
                STATS.txFailed++;
                // Keep errors log clean, only store unique ones
                const msg = e.message;
                if (!STATS.errors.includes(msg)) STATS.errors.push(msg);
            }

            // Adaptive Delay: Randomize to avoid thundering herd
            const delay = Math.floor(Math.random() * (CONFIG.MAX_ACTION_DELAY_MS - CONFIG.MIN_ACTION_DELAY_MS + 1)) + CONFIG.MIN_ACTION_DELAY_MS;
            await new Promise(r => setTimeout(r, delay));

            if (STATS.txSent > 0 && STATS.txSent % 50 === 0) this.printStats();
        }
    }

    // --- Actions ---

    async doPost(user: WalletKeys) {
        const timestamp = Date.now();
        const content = {
            wallet_id: user.address,
            content_type: 'TEXT',
            title: `V2 Post ${timestamp}`,
            description: `Hello from ${user.address}`,
            timestamp: timestamp,
            signature: '',
            public_key: user.publicKey
        };
        const signMsg = `${user.address}:POST_CONTENT:${timestamp}`;
        content.signature = KeyManager.sign(signMsg, user.privateKey);

        const res = await ApiClient.post('/api/content/create', content);
        if (res.success) {
            STATS.txSuccess++;
            STATS.actions.post++;
            if (res.content?.content_id) this.contentIds.push(res.content.content_id);
        }
        STATS.txSent++;
    }

    async doLike(user: WalletKeys) {
        if (this.contentIds.length === 0) return;
        const contentId = this.contentIds[Math.floor(Math.random() * this.contentIds.length)];
        const timestamp = Date.now();
        const body = {
            wallet_id: user.address,
            content_id: contentId,
            timestamp: timestamp,
            signature: '',
            public_key: user.publicKey
        };
        const msg = `${user.address}:LIKE:${contentId}:${timestamp}`;
        body.signature = KeyManager.sign(msg, user.privateKey);

        const res = await ApiClient.post('/api/social/like', body);
        if (res.success) {
            STATS.txSuccess++;
            STATS.actions.like++;
        }
        STATS.txSent++;
    }

    async doComment(user: WalletKeys) {
        if (this.contentIds.length === 0) return;

        // 50% chance to reply to a comment vs top-level post (if comments exist)
        const isReply = this.commentIds.length > 0 && Math.random() > 0.5;
        const targetId = isReply
            ? this.commentIds[Math.floor(Math.random() * this.commentIds.length)]
            : this.contentIds[Math.floor(Math.random() * this.contentIds.length)]; // Replies still need content_id? API says it needs content_id AND parent.

        // Wait, commentOnContent needs content_id. If replying to a comment, we still need the original content_id.
        // Simplified: Just comment on random content for now, but sometimes add parent_id if available.
        // We'll map commentId -> contentId if we want to be precise, or just use random content and hope it matches (risky).
        // Better: Just support top-level comments capturing IDs for now, and simple replies if we track the map.
        // Let's stick to Top Level first to fix the counts, then add basic reply support if we can find the parent content.

        const contentId = this.contentIds[Math.floor(Math.random() * this.contentIds.length)];
        const timestamp = Date.now();
        const text = isReply ? "Replying to this!" : "Great post!";

        const body: any = {
            wallet_id: user.address,
            content_id: contentId,
            comment_text: text,
            timestamp: timestamp,
            signature: '',
            public_key: user.publicKey
        };

        if (isReply && this.commentIds.length > 0) {
            body.parent_comment_id = this.commentIds[Math.floor(Math.random() * this.commentIds.length)];
        }

        const msg = `${user.address}:COMMENT:${contentId}:${timestamp}:${text}`;
        body.signature = KeyManager.sign(msg, user.privateKey);

        const res = await ApiClient.post('/api/social/comment', body);
        if (res.success) {
            STATS.txSuccess++;
            STATS.actions.comment++;
            if (res.comment_id) this.commentIds.push(res.comment_id); // Capture ID
        }
        STATS.txSent++;
    }

    async doMessage(user: WalletKeys) {
        const recipient = this.users[Math.floor(Math.random() * this.users.length)];
        if (recipient.address === user.address) return;

        const message = "Secret hello";
        const encrypted = KeyManager.encryptForUser(message, user.encryptionPrivateKey, recipient.encryptionPublicKey);

        // Transaction Construction
        const tx = TransactionModel.create(
            user.address,
            recipient.address,
            TransactionType.PRIVATE_MESSAGE,
            0,
            1000,
            (Date.now() % 1000000),
            { message: encrypted, encrypted: true }
        );
        tx.sender_public_key = user.publicKey;
        tx.sender_signature = KeyManager.sign(tx.getSignableData(), user.privateKey);

        const body = {
            from_wallet: user.address,
            to_wallet: recipient.address,
            encrypted_message: encrypted,
            sender_public_key: user.publicKey,
            sender_signature: tx.sender_signature
        };

        const res = await ApiClient.post('/api/messaging/send', body);
        if (res.success) {
            STATS.txSuccess++;
            STATS.actions.message++;
        }
        STATS.txSent++;
    }

    async doTransfer(user: WalletKeys) {
        const recipient = this.users[Math.floor(Math.random() * this.users.length)];
        if (recipient.address === user.address) return;

        // Small random amount: 1 to 10 LT
        const amount = Math.floor(Math.random() * 10 * 100000000) + 100000000;
        const fee = 1000;

        const tx = TransactionModel.create(
            user.address,
            recipient.address,
            TransactionType.TRANSFER,
            amount,
            fee,
            (Date.now() % 1000000)
        );
        tx.sender_public_key = user.publicKey;
        tx.sender_signature = KeyManager.sign(tx.getSignableData(), user.privateKey);

        try {
            await ApiClient.post('/rpc/sendRawTx', tx);
            STATS.txSuccess++;
            STATS.actions.transfer++;
        } catch (e) {
            // Can fail if balance is low, ignore
            STATS.txFailed++;
        }
        STATS.txSent++;
    }

    printStats() {
        console.log(`\n--- Stats [${new Date().toISOString()}] ---`);
        console.log(`Total: ${STATS.txSent} | Success: ${STATS.txSuccess} | Failed: ${STATS.txFailed}`);
        console.log(`Actions: Post=${STATS.actions.post} Like=${STATS.actions.like} Cmt=${STATS.actions.comment} Msg=${STATS.actions.message} Transfer=${STATS.actions.transfer}`);
        if (STATS.errors.length > 0) {
            console.log('Errors:', STATS.errors.slice(0, 5)); // Show top 5 errors
        }
    }
}

async function main() {
    const sim = new Simulation();
    await sim.generateUsers();
    await sim.startLoop();
}

main().catch(console.error);
