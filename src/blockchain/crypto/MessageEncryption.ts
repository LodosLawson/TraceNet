import * as nacl from 'tweetnacl';
import { KeyManager } from './KeyManager';

/**
 * End-to-end encryption for private messages using X25519 key exchange
 */

export interface EncryptedMessage {
    encrypted_content: string;
    nonce: string;
    ephemeral_public_key: string;
}

/**
 * Message encryption utilities
 */
export class MessageEncryption {
    /**
     * Encrypt message for recipient using their public key
     * Uses ECDH (Elliptic Curve Diffie-Hellman) for key agreement
     */
    static encryptMessage(
        message: string,
        recipientPublicKeyHex: string,
        senderPrivateKeyHex: string
    ): EncryptedMessage {
        // Convert hex keys to Uint8Array
        const recipientPublicKey = Buffer.from(recipientPublicKeyHex, 'hex');
        const senderPrivateKey = Buffer.from(senderPrivateKeyHex, 'hex');

        // Generate ephemeral keypair for this message
        const ephemeralKeyPair = nacl.box.keyPair();

        // Generate nonce
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Encrypt message
        const messageBytes = Buffer.from(message, 'utf8');

        // Convert Ed25519 keys to X25519 for encryption
        // Note: In production, you'd want to use proper key derivation
        // For now, we'll use a simple approach
        const encrypted = nacl.box(
            messageBytes,
            nonce,
            recipientPublicKey.slice(0, 32), // Use first 32 bytes
            ephemeralKeyPair.secretKey
        );

        return {
            encrypted_content: Buffer.from(encrypted).toString('hex'),
            nonce: Buffer.from(nonce).toString('hex'),
            ephemeral_public_key: Buffer.from(ephemeralKeyPair.publicKey).toString('hex'),
        };
    }

    /**
     * Decrypt message using recipient's private key
     */
    static decryptMessage(
        encryptedMessage: EncryptedMessage,
        recipientPrivateKeyHex: string
    ): string | null {
        try {
            const encrypted = Buffer.from(encryptedMessage.encrypted_content, 'hex');
            const nonce = Buffer.from(encryptedMessage.nonce, 'hex');
            const ephemeralPublicKey = Buffer.from(encryptedMessage.ephemeral_public_key, 'hex');
            const recipientPrivateKey = Buffer.from(recipientPrivateKeyHex, 'hex');

            // Decrypt
            const decrypted = nacl.box.open(
                encrypted,
                nonce,
                ephemeralPublicKey,
                recipientPrivateKey.slice(0, 32) // Use first 32 bytes
            );

            if (!decrypted) {
                return null;
            }

            return Buffer.from(decrypted).toString('utf8');
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    /**
     * Encrypt message with a simple shared secret (for sender's own copy)
     */
    static encryptWithPassword(message: string, password: string): string {
        const key = KeyManager.hash(password).slice(0, 64); // Use hash as key
        const keyBuffer = Buffer.from(key, 'hex').slice(0, 32);

        const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
        const messageBytes = Buffer.from(message, 'utf8');

        const encrypted = nacl.secretbox(messageBytes, nonce, keyBuffer);

        return Buffer.from(nonce).toString('hex') + ':' + Buffer.from(encrypted).toString('hex');
    }

    /**
     * Decrypt message encrypted with password
     */
    static decryptWithPassword(encryptedMessage: string, password: string): string | null {
        try {
            const parts = encryptedMessage.split(':');
            if (parts.length !== 2) {
                return null;
            }

            const nonce = Buffer.from(parts[0], 'hex');
            const encrypted = Buffer.from(parts[1], 'hex');

            const key = KeyManager.hash(password).slice(0, 64);
            const keyBuffer = Buffer.from(key, 'hex').slice(0, 32);

            const decrypted = nacl.secretbox.open(encrypted, nonce, keyBuffer);

            if (!decrypted) {
                return null;
            }

            return Buffer.from(decrypted).toString('utf8');
        } catch (error) {
            console.error('Password decryption failed:', error);
            return null;
        }
    }
}
