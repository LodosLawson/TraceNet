import { KeyManager } from '../../src/blockchain/crypto/KeyManager';

describe('KeyManager', () => {
    describe('Key Generation', () => {
        it('should generate a valid ED25519 key pair', () => {
            const keyPair = KeyManager.generateKeyPair();

            expect(keyPair.publicKey).toBeDefined();
            expect(keyPair.privateKey).toBeDefined();
            expect(keyPair.publicKey.length).toBe(64); // 32 bytes in hex
            expect(keyPair.privateKey.length).toBe(128); // 64 bytes in hex
        });

        it('should generate different key pairs each time', () => {
            const keyPair1 = KeyManager.generateKeyPair();
            const keyPair2 = KeyManager.generateKeyPair();

            expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
            expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
        });
    });

    describe('Mnemonic Wallet Generation', () => {
        it('should generate a wallet with mnemonic', () => {
            const wallet = KeyManager.generateWalletFromMnemonic();

            expect(wallet.mnemonic).toBeDefined();
            expect(wallet.publicKey).toBeDefined();
            expect(wallet.privateKey).toBeDefined();
            expect(wallet.address).toBeDefined();
            expect(wallet.address).toMatch(/^TRN/);
        });

        it('should generate wallet from provided mnemonic', () => {
            const wallet1 = KeyManager.generateWalletFromMnemonic();
            const wallet2 = KeyManager.generateWalletFromMnemonic(wallet1.mnemonic);

            expect(wallet2.publicKey).toBe(wallet1.publicKey);
            expect(wallet2.privateKey).toBe(wallet1.privateKey);
            expect(wallet2.address).toBe(wallet1.address);
        });

        it('should reject invalid mnemonic', () => {
            expect(() => {
                KeyManager.generateWalletFromMnemonic('invalid mnemonic phrase');
            }).toThrow();
        });

        it('should derive consistent address from public key', () => {
            const wallet = KeyManager.generateWalletFromMnemonic();
            const derivedAddress = KeyManager.deriveAddress(wallet.publicKey);

            expect(derivedAddress).toBe(wallet.address);
        });
    });

    describe('Signing and Verification', () => {
        it('should sign and verify data correctly', () => {
            const keyPair = KeyManager.generateKeyPair();
            const data = 'test message';

            const signature = KeyManager.sign(data, keyPair.privateKey);
            const isValid = KeyManager.verify(data, signature, keyPair.publicKey);

            expect(isValid).toBe(true);
        });

        it('should reject invalid signature', () => {
            const keyPair = KeyManager.generateKeyPair();
            const data = 'test message';

            const signature = KeyManager.sign(data, keyPair.privateKey);
            const isValid = KeyManager.verify('different message', signature, keyPair.publicKey);

            expect(isValid).toBe(false);
        });

        it('should reject signature from different key', () => {
            const keyPair1 = KeyManager.generateKeyPair();
            const keyPair2 = KeyManager.generateKeyPair();
            const data = 'test message';

            const signature = KeyManager.sign(data, keyPair1.privateKey);
            const isValid = KeyManager.verify(data, signature, keyPair2.publicKey);

            expect(isValid).toBe(false);
        });
    });

    describe('Encryption and Decryption', () => {
        const encryptionKey = 'test_encryption_key_32_bytes_long';

        it('should encrypt and decrypt data correctly', () => {
            const data = 'sensitive information';

            const encrypted = KeyManager.encrypt(data, encryptionKey);
            const decrypted = KeyManager.decrypt(encrypted, encryptionKey);

            expect(decrypted).toBe(data);
        });

        it('should produce different ciphertext each time', () => {
            const data = 'sensitive information';

            const encrypted1 = KeyManager.encrypt(data, encryptionKey);
            const encrypted2 = KeyManager.encrypt(data, encryptionKey);

            expect(encrypted1).not.toBe(encrypted2);
        });

        it('should fail to decrypt with wrong key', () => {
            const data = 'sensitive information';
            const encrypted = KeyManager.encrypt(data, encryptionKey);

            expect(() => {
                KeyManager.decrypt(encrypted, 'wrong_key');
            }).toThrow();
        });

        it('should fail to decrypt tampered ciphertext', () => {
            const data = 'sensitive information';
            const encrypted = KeyManager.encrypt(data, encryptionKey);
            const tampered = encrypted.replace(/.$/, '0'); // Change last character

            expect(() => {
                KeyManager.decrypt(tampered, encryptionKey);
            }).toThrow();
        });
    });

    describe('Hashing', () => {
        it('should produce consistent hash', () => {
            const data = 'test data';

            const hash1 = KeyManager.hash(data);
            const hash2 = KeyManager.hash(data);

            expect(hash1).toBe(hash2);
            expect(hash1.length).toBe(64); // SHA-256 in hex
        });

        it('should produce different hashes for different data', () => {
            const hash1 = KeyManager.hash('data1');
            const hash2 = KeyManager.hash('data2');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Random Bytes', () => {
        it('should generate random bytes', () => {
            const random1 = KeyManager.randomBytes(16);
            const random2 = KeyManager.randomBytes(16);

            expect(random1.length).toBe(32); // 16 bytes in hex
            expect(random2.length).toBe(32);
            expect(random1).not.toBe(random2);
        });
    });
});
