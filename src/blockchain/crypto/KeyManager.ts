import * as nacl from 'tweetnacl';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
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
    // Encryption keys (Curve25519)
    encryptionPublicKey: string;
    encryptionPrivateKey: string;
}

/**
 * Cryptographic key management using ED25519 and Curve25519
 */
export class KeyManager {
    /**
     * Generate a new ED25519 key pair
     */
    static generateKeyPair(): KeyPair {
        // FIXED: Explicitly use crypto.randomBytes for reliable entropy
        const seed = crypto.randomBytes(32);
        const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));

        return {
            publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
            privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
        };
    }

    /**
     * Restore key pair from private key hex
     */
    static getKeyPairFromPrivate(privateKeyHex: string): KeyPair {
        const secretKey = new Uint8Array(Buffer.from(privateKeyHex, 'hex'));

        // Fix: Handle 32-byte seeds (common from env vars/seeds) vs 64-byte full secret keys
        let keyPair;
        if (secretKey.length === 32) {
            keyPair = nacl.sign.keyPair.fromSeed(secretKey);
        } else {
            keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
        }

        return {
            publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
            privateKey: Buffer.from(keyPair.secretKey).toString('hex'),
        };
    }

    /**
     * Generate wallet from mnemonic (BIP39)
     * @param mnemonic Optional mnemonic (generates new if not provided)
     * @param encryptionIndex Optional index for encryption key rotation (default: 0)
     */
    static generateWalletFromMnemonic(mnemonic?: string, encryptionIndex: number = 0): WalletKeys {
        // Generate or use provided mnemonic
        const mnemonicPhrase = mnemonic || bip39.generateMnemonic(256); // 24 words

        // Validate mnemonic
        if (!bip39.validateMnemonic(mnemonicPhrase)) {
            throw new Error('Invalid mnemonic phrase');
        }

        // Generate seed from mnemonic
        const seed = bip39.mnemonicToSeedSync(mnemonicPhrase);

        // 1. Signing Keys (Ed25519) - Use first 32 bytes
        const signKeyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
        const publicKey = Buffer.from(signKeyPair.publicKey).toString('hex');
        const privateKey = Buffer.from(signKeyPair.secretKey).toString('hex');

        // 2. Encryption Keys (Curve25519) - BIP32 HD derivation for compatibility
        // Standard HD path for encryption: m/44'/0'/0'/1'/index'
        // Index 0 is default. Incrementing index rotates the key (forward secrecy).
        const encryptionPath = `m/44'/0'/0'/1'/${encryptionIndex}'`;
        const hdkey = HDKey.fromMasterSeed(seed);
        const derived = hdkey.derive(encryptionPath);

        if (!derived.privateKey) {
            throw new Error('Failed to derive encryption private key');
        }

        // CRITICAL FIX: TweetNaCl doesn't have box.keyPair.fromSecretKey()
        // We must derive the public key manually using scalarMult.base
        const secretKey = new Uint8Array(derived.privateKey.slice(0, 32));
        const publicKey_curve25519 = nacl.scalarMult.base(secretKey);

        const encryptionPublicKey = Buffer.from(publicKey_curve25519).toString('hex');
        const encryptionPrivateKey = Buffer.from(secretKey).toString('hex');

        // Address is derived from signing public key
        const address = this.deriveAddress(publicKey);

        return {
            mnemonic: mnemonicPhrase,
            publicKey,
            privateKey,
            address,
            encryptionPublicKey,
            encryptionPrivateKey
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
     * Encrypt data using AES-256-GCM (Symmetric)
     */
    static encrypt(data: string, encryptionKey: string): string {
        const iv = crypto.randomBytes(16);
        // FIXED: Use random salt specifically for this encryption
        const salt = crypto.randomBytes(16);
        const key = crypto.scryptSync(encryptionKey, salt, 32);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Return salt + iv + authTag + encrypted data
        return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt data using AES-256-GCM (Symmetric)
     */
    static decrypt(encryptedData: string, encryptionKey: string): string {
        const parts = encryptedData.split(':');
        // Now expects 4 parts: salt:iv:authTag:encrypted
        if (parts.length !== 4) {
            // Fallback for legacy format (temporary)
            if (parts.length === 3) {
                // Try treating first part as iv, use legacy 'salt'
                // This is risky but allows reading old keys until migration is done.
                // However, for strict security hardening, we might want to fail.
                // Let's assume user wants to read old data for now.
                const iv = Buffer.from(parts[0], 'hex');
                const authTag = Buffer.from(parts[1], 'hex');
                const encrypted = parts[2];
                const key = crypto.scryptSync(encryptionKey, 'salt', 32); // Legacy hardcoded salt
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(encrypted, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            }
            throw new Error('Invalid encrypted data format');
        }

        const salt = Buffer.from(parts[0], 'hex');
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const encrypted = parts[3];

        const key = crypto.scryptSync(encryptionKey, salt, 32);

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

    /**
     * Encrypt message for a specific recipient using nacl.box (Authenticated Encryption)
     * @param message Message to encrypt
     * @param senderEncryptionPrivateKey Sender's Encryption Private Key
     * @param recipientEncryptionPublicKey Recipient's Encryption Public Key
     */
    static encryptForUser(message: string, senderEncryptionPrivateKey: string, recipientEncryptionPublicKey: string): string {
        const senderPriv = new Uint8Array(Buffer.from(senderEncryptionPrivateKey, 'hex'));
        const recipientPub = new Uint8Array(Buffer.from(recipientEncryptionPublicKey, 'hex'));

        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const msgBuffer = Buffer.from(message, 'utf8');

        const encrypted = nacl.box(msgBuffer, nonce, recipientPub, senderPriv);

        // Return Nonce + EncryptedData
        return Buffer.from(nonce).toString('hex') + ':' + Buffer.from(encrypted).toString('hex');
    }

    /**
     * Decrypt message from a specific sender using nacl.box.open
     * @param encryptedMessage Encrypted message (Nonce:Data)
     * @param recipientEncryptionPrivateKey Recipient's Encryption Private Key
     * @param senderEncryptionPublicKey Sender's Encryption Public Key
     */
    static decryptFromUser(encryptedMessage: string, recipientEncryptionPrivateKey: string, senderEncryptionPublicKey: string): string {
        const parts = encryptedMessage.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted message format');
        }

        const nonce = new Uint8Array(Buffer.from(parts[0], 'hex'));
        const encrypted = new Uint8Array(Buffer.from(parts[1], 'hex'));

        const recipientPriv = new Uint8Array(Buffer.from(recipientEncryptionPrivateKey, 'hex'));
        const senderPub = new Uint8Array(Buffer.from(senderEncryptionPublicKey, 'hex'));

        const decrypted = nacl.box.open(encrypted, nonce, senderPub, recipientPriv);

        if (!decrypted) {
            throw new Error('Failed to decrypt message');
        }

        return Buffer.from(decrypted).toString('utf8');
    }
}
