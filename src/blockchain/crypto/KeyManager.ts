import * as nacl from 'tweetnacl';
import * as bip39 from 'bip39';
import crypto from 'crypto';

/**
 * Key pair structure
 */
export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

/**
 * Wallet creation result
 */
export interface WalletKeys {
    mnemonic: string;
    publicKey: string;
    privateKey: string;
    address: string;
}

/**
 * Cryptographic key management using ED25519
 */
export class KeyManager {
    /**
     * Generate a new ED25519 key pair
     */
    static generateKeyPair(): KeyPair {
        const keyPair = nacl.sign.keyPair();

        return {
            publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
            privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
        };
    }

    /**
     * Generate wallet from mnemonic (BIP39)
     */
    static generateWalletFromMnemonic(mnemonic?: string): WalletKeys {
        // Generate or use provided mnemonic
        const mnemonicPhrase = mnemonic || bip39.generateMnemonic(256); // 24 words

        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonicPhrase)) {
            throw new Error('Invalid mnemonic phrase');
        }

        // Generate seed from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonicPhrase);

        // Use first 32 bytes as ED25519 seed
        const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));

        const publicKey = Buffer.from(keyPair.publicKey).toString('hex');
        const privateKey = Buffer.from(keyPair.secretKey).toString('hex');

        // Address is derived from public key (first 40 chars of hash)
        const address = this.deriveAddress(publicKey);

        return {
            mnemonic: mnemonicPhrase,
            publicKey,
            privateKey,
            address,
        };
    }

    /**
     * Derive address from public key
     */
    static deriveAddress(publicKey: string): string {
        const hash = crypto
            .createHash('sha256')
            .update(Buffer.from(publicKey, 'hex'))
            .digest('hex');

        // Take first 40 characters and add prefix
        return 'TRN' + hash.substring(0, 40);
    }

    /**
     * Sign data with private key
     */
    static sign(data: string, privateKeyHex: string): string {
        const privateKey = Buffer.from(privateKeyHex, 'hex');
        const message = Buffer.from(data, 'utf8');

        const signature = nacl.sign.detached(message, privateKey);

        return Buffer.from(signature).toString('hex');
    }

    /**
     * Verify signature
     */
    static verify(data: string, signatureHex: string, publicKeyHex: string): boolean {
        try {
            const publicKey = Buffer.from(publicKeyHex, 'hex');
            const signature = Buffer.from(signatureHex, 'hex');
            const message = Buffer.from(data, 'utf8');

            return nacl.sign.detached.verify(message, signature, publicKey);
        } catch (error) {
            return false;
        }
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    static encrypt(data: string, encryptionKey: string): string {
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(encryptionKey, 'salt', 32);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return iv + authTag + encrypted data
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt data using AES-256-GCM
     */
    static decrypt(encryptedData: string, encryptionKey: string): string {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];

        const key = crypto.scryptSync(encryptionKey, 'salt', 32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Generate random bytes (for nonces, IDs, etc.)
     */
    static randomBytes(length: number): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash data using SHA-256
     */
    static hash(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
}
