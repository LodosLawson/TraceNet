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

        // Generate nonce
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Encrypt message
        const messageBytes = Buffer.from(message, 'utf8');

        // Use sender's private key for authenticated encryption (allows sender to decrypt later)
        const encrypted = nacl.box(
            messageBytes,
            nonce,
            recipientPublicKey.slice(0, 32), // Use first 32 bytes
            senderPrivateKey.slice(0, 32)    // Use sender's private key
        );

        return {
            encrypted_content: Buffer.from(encrypted).toString('hex'),
            nonce: Buffer.from(nonce).toString('hex'),
            ephemeral_public_key: '', // No longer used/needed for authenticated encryption
        };
    }

    /**
     * Decrypt message using recipient's private key
     * Supports both Authenticated Encryption (senderPublicKey provided) and Anonymous/Ephemeral (embedded key)
     */
    static decryptMessage(
        encryptedMessage: EncryptedMessage,
        recipientPrivateKeyHex: string,
        senderPublicKeyHex?: string
    ): string | null {
        try {
            const encrypted = Buffer.from(encryptedMessage.encrypted_content, 'hex');
            const nonce = Buffer.from(encryptedMessage.nonce, 'hex');
            const recipientPrivateKey = Buffer.from(recipientPrivateKeyHex, 'hex');

            let otherPublicKey: Buffer;

            if (senderPublicKeyHex) {
                // Authenticated Decryption: Use Sender's Public Key
                otherPublicKey = Buffer.from(senderPublicKeyHex, 'hex');
            } else if (encryptedMessage.ephemeral_public_key) {
                // Legacy/Anonymous: Use Ephemeral Public Key from message
                otherPublicKey = Buffer.from(encryptedMessage.ephemeral_public_key, 'hex');
            } else {
                console.error('Decryption failed: No public key available for decryption');
                return null;
            }

            // Decrypt
            const decrypted = nacl.box.open(
                encrypted,
                nonce,
                otherPublicKey.slice(0, 32), // Use first 32 bytes
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
