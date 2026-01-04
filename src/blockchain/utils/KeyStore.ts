
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Secure KeyStore for managing private keys.
 * Uses AES-256-GCM for encryption.
 */
export class KeyStore {
    private keystorePath: string;

    constructor(storagePath: string = 'secrets/keystore.json') {
        this.keystorePath = path.resolve(process.cwd(), storagePath);
        this.ensureDirectory();
    }

    /**
     * Ensure the secrets directory exists
     */
    private ensureDirectory() {
        const dir = path.dirname(this.keystorePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); // Private permissions
        }
    }

    /**
     * Save a private key encrypted
     */
    saveKey(alias: string, privateKey: string, password: string): void {
        const salt = crypto.randomBytes(16);
        const key = crypto.scryptSync(password, salt, 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        const entry = {
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            content: encrypted
        };

        const store = this.loadStore();
        store[alias] = entry;
        this.writeStore(store);
    }

    /**
     * Load and decrypt a private key
     */
    loadKey(alias: string, password: string): string | null {
        const store = this.loadStore();
        const entry = store[alias];

        if (!entry) return null;

        try {
            const salt = Buffer.from(entry.salt, 'hex');
            const iv = Buffer.from(entry.iv, 'hex');
            const authTag = Buffer.from(entry.authTag, 'hex');
            const encrypted = entry.content;

            const key = crypto.scryptSync(password, salt, 32);
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error(`[KeyStore] Failed to decrypt key '${alias}'. Wrong password or corrupted data.`);
            return null;
        }
    }

    /**
     * Check if a key exists
     */
    hasKey(alias: string): boolean {
        const store = this.loadStore();
        return !!store[alias];
    }

    private loadStore(): Record<string, any> {
        if (!fs.existsSync(this.keystorePath)) {
            return {};
        }
        try {
            const data = fs.readFileSync(this.keystorePath, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            return {};
        }
    }

    private writeStore(store: Record<string, any>) {
        fs.writeFileSync(this.keystorePath, JSON.stringify(store, null, 2), { mode: 0o600 });
    }
}
