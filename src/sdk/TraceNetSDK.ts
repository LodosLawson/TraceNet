/**
 * TraceNet Blockchain - Client SDK
 * 
 * Easy-to-use SDK for interacting with TraceNet blockchain
 * Handles dynamic fee calculation, messaging encryption, and transaction signing
 */

import { KeyManager } from '../blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../blockchain/models/Transaction';

export interface WalletKeys {
    address: string;
    publicKey: string;
    privateKey: string;
    encryptionPublicKey: string;
    encryptionPrivateKey: string;
    mnemonic: string;
}

export interface TransferOptions {
    priority?: 'STANDARD' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MessageOptions {
    amount?: number; // For MESSAGE_PAYMENT type
}

/**
 * TraceNet SDK - Main class for blockchain interactions
 */
export class TraceNetSDK {
    private apiUrl: string;
    private wallet: WalletKeys;

    constructor(apiUrl: string, wallet: WalletKeys) {
        this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        this.wallet = wallet;
    }

    /**
     * Create a new wallet from mnemonic
     */
    static createWallet(mnemonic?: string): WalletKeys {
        const keys = KeyManager.generateWalletFromMnemonic(mnemonic);
        return {
            address: keys.address,
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            encryptionPublicKey: keys.encryptionPublicKey,
            encryptionPrivateKey: keys.encryptionPrivateKey,
            mnemonic: keys.mnemonic
        };
    }

    /**
     * Get wallet balance
     */
    async getBalance(address?: string): Promise<number> {
        const targetAddress = address || this.wallet.address;
        const response = await fetch(`${this.apiUrl}/rpc/balance/${targetAddress}`);
        const data: any = await response.json();
        return data.balance;
    }

    /**
     * Calculate transfer fee (dynamic)
     */
    async calculateTransferFee(
        recipientAddress: string,
        amount: number,
        priority: string = 'STANDARD'
    ): Promise<number> {
        const response = await fetch(`${this.apiUrl}/rpc/calculateTransferFee`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient_address: recipientAddress,
                amount,
                priority
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to calculate fee: ${response.statusText}`);
        }

        const data: any = await response.json();
        return data.total_fee;
    }

    /**
     * Send LT to another address with automatic fee calculation
     */
    async transfer(
        toAddress: string,
        amount: number,
        options: TransferOptions = {}
    ): Promise<{ success: boolean; tx_id?: string; error?: string }> {
        try {
            const priority = options.priority || 'STANDARD';

            // Calculate dynamic fee
            const fee = await this.calculateTransferFee(toAddress, amount, priority);

            // Create transaction
            const tx = TransactionModel.create(
                this.wallet.address,
                toAddress,
                TransactionType.TRANSFER,
                amount,
                fee,
                (Date.now() % 1000000), // Placeholder Nonce
                { priority }
            );

            // Sign transaction
            tx.sender_public_key = this.wallet.publicKey;
            tx.sender_signature = KeyManager.sign(
                tx.getSignableData(),
                this.wallet.privateKey
            );

            // Send to network
            const response = await fetch(`${this.apiUrl}/rpc/sendRawTx`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tx)
            });

            const result: any = await response.json();

            if (result.success) {
                return {
                    success: true,
                    tx_id: result.tx_id
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Send encrypted message to another user
     */
    async sendMessage(
        toAddress: string,
        message: string,
        recipientEncryptionPublicKey: string,
        options: MessageOptions = {}
    ): Promise<{ success: boolean; tx_id?: string; error?: string }> {
        try {
            // Encrypt message CLIENT-SIDE
            const encryptedMessage = KeyManager.encryptForUser(
                message,
                this.wallet.encryptionPrivateKey,
                recipientEncryptionPublicKey
            );

            // Create transaction
            const { TOKEN_CONFIG } = require('../economy/TokenConfig');
            const tx = TransactionModel.create(
                this.wallet.address,
                toAddress,
                options.amount ? TransactionType.MESSAGE_PAYMENT : TransactionType.PRIVATE_MESSAGE,
                options.amount || 0,
                TOKEN_CONFIG.MESSAGE_FEE,
                (Date.now() % 1000000), // Placeholder Nonce
                { message: encryptedMessage, encrypted: true }
            );

            // Sign transaction
            tx.sender_public_key = this.wallet.publicKey;
            tx.sender_signature = KeyManager.sign(
                tx.getSignableData(),
                this.wallet.privateKey
            );

            // Send via messaging endpoint (only accepts encrypted messages)
            const response = await fetch(`${this.apiUrl}/api/messaging/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_wallet: this.wallet.address,
                    to_wallet: toAddress,
                    encrypted_message: encryptedMessage,
                    sender_public_key: this.wallet.publicKey,
                    sender_signature: tx.sender_signature
                })
            });

            const result: any = await response.json();

            if (result.success) {
                return {
                    success: true,
                    tx_id: result.tx_id
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Decrypt received message CLIENT-SIDE
     */
    decryptMessage(
        encryptedMessage: string,
        senderEncryptionPublicKey: string
    ): string {
        return KeyManager.decryptFromUser(
            encryptedMessage,
            this.wallet.encryptionPrivateKey,
            senderEncryptionPublicKey
        );
    }

    /**
     * Get blockchain status
     */
    async getStatus(): Promise<any> {
        const response = await fetch(`${this.apiUrl}/rpc/status`);
        return await response.json();
    }

    /**
     * Get user's transaction history (from blockchain)
     */
    async getTransactionHistory(): Promise<any[]> {
        // This would need a new API endpoint to filter transactions by address
        // For now, return empty array
        return [];
    }
}

/**
 * Example Usage:
 * 
 * // Create or import wallet
 * const wallet = TraceNetSDK.createWallet();
 * console.log('Mnemonic:', wallet.mnemonic);
 * 
 * // Initialize SDK
 * const sdk = new TraceNetSDK('http://localhost:3000', wallet);
 * 
 * // Check balance
 * const balance = await sdk.getBalance();
 * console.log('Balance:', balance / 100000000, 'LT');
 * 
 * // Send transfer (fee calculated automatically)
 * const result = await sdk.transfer(
 *     'TRN4a3b2c1...',
 *     100 * 100000000, // 100 LT
 *     { priority: 'MEDIUM' }
 * );
 * 
 * // Send encrypted message
 * const msgResult = await sdk.sendMessage(
 *     'TRN4a3b2c1...',
 *     'Hello!',
 *     recipientEncryptionPublicKey
 * );
 * 
 * // Decrypt received message
 * const decrypted = sdk.decryptMessage(
 *     encryptedMsg,
 *     senderEncryptionPublicKey
 * );
 */
