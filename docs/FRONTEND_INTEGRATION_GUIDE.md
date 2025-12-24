# TraceNet V2 Frontend Integration Guide

This guide provides a complete reference for integrating frontend applications with the TraceNet V2 blockchain. It covers the four core operations requested: **Account Creation**, **Coin Transfer**, **Post Sharing**, and **Message Sending**.

> [!IMPORTANT]
> **Cryptography Dependencies**:
> Ensure you have the following libraries installed:
> - `tweetnacl`: For Ed25519 signing and X25519 encryption.
> - `tweetnacl-util`: For encoding/decoding.
> - `bip39`: For mnemonic generation.

---

## 1. Account Creation

Creating an account involves generating a BIP39 mnemonic, deriving keys, and registering the user on the blockchain.

### 1.1 Generation & Registration Flow

1.  **Generate Mnemonic**: Create a 24-word random phrase.
2.  **Derive Keys**:
    *   **Signing Key (Ed25519)**: Derived from the seed. Used for `sender_signature`.
    *   **Encryption Key (X25519)**: Derived from the seed (path `m/44'/0'/0'/1'/0'`). Used for messaging.
    *   **Public Key**: Derived from the Signing Key.
3.  **Register API**: Call `/api/user/create`.

### 1.2 Code Example

```typescript
import * as bip39 from 'bip39';
import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';

// 1. Generate Mnemonic
const mnemonic = bip39.generateMnemonic(256); // 24 words
console.log("Save this phrase safely:", mnemonic);

// 2. Derive Keys (Simplified for demo - use proper HD derivation in prod)
const seed = bip39.mnemonicToSeedSync(mnemonic);
const keyPair = nacl.sign.keyPair.fromSeed(seed.slice(0, 32));
const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');

// 3. Register User
async function registerUser(nickname: string) {
    const response = await fetch('http://localhost:3000/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nickname: nickname,
            // The backend usually generates the wallet from the keys or a new random one if not provided.
            // If you want to force a specific wallet derived from client keys, 
            // the API might need updating to accept 'public_key'.
            // Current standard: The API creates a generic wallet for the nickname.
            // Check specific implementation if client-side key generation is strictly required for the wallet ID.
        })
    });
    
    const data = await response.json();
    // data.mnemonic will be returned if the server generated it. 
    // If you generated it client-side, make sure the wallet matches.
    return data;
}
```

> [!NOTE]
> If the API `/api/user/create` generates the wallet for you, it returns the `mnemonic`. You must display this to the user immediately.

---

## 2. Coin Transfer

Transfers require calculating a fee, constructing a transaction, signing it, and broadcasting it.

### 2.1 Code Example

```typescript
async function sendCoin(
    recipientAddress: string, 
    amount: number, 
    senderKeyPair: nacl.SignKeyPair
) {
    const senderAddress = "TRN..."; // Derived from your public key
    const senderPublicKeyHex = Buffer.from(senderKeyPair.publicKey).toString('hex');

    // 1. Calculate Fee
    const feeRes = await fetch('http://localhost:3000/rpc/calculateTransferFee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient_address: recipientAddress,
            amount: amount,
            priority: 'STANDARD'
        })
    });
    const feeData = await feeRes.json();
    const fee = feeData.total_fee;

    // 2. Transacton Object
    // ID Generation: SHA256(from + to + amount + timestamp)
    const timestamp = Date.now();
    // Use a library like 'crypto-js' or 'sha.js' for hashing in browser
    const txIdInput = `${senderAddress}${recipientAddress}${amount}${timestamp}`;
    // const txId = sha256(txIdInput); 
    
    const transaction = {
        tx_id: "GENERATED_HASH_HEX", 
        from_wallet: senderAddress,
        to_wallet: recipientAddress,
        type: 'TRANSFER',
        amount: amount,
        fee: fee,
        timestamp: timestamp,
        nonce: 1, // Get this from /rpc/balance/{address} (current nonce) + 1
        payload: { priority: 'STANDARD' },
        sender_public_key: senderPublicKeyHex
    };

    // 3. Sign
    // Standard Transactions INCLUDE public key in signing data
    const signableData = JSON.stringify({
        tx_id: transaction.tx_id,
        from_wallet: transaction.from_wallet,
        to_wallet: transaction.to_wallet,
        type: transaction.type,
        payload: transaction.payload,
        amount: transaction.amount,
        fee: transaction.fee,
        timestamp: transaction.timestamp,
        nonce: transaction.nonce,
        // valid_until: undefined, // Optional
        sender_public_key: transaction.sender_public_key
    });

    const signature = nacl.sign.detached(
        new TextEncoder().encode(signableData),
        senderKeyPair.secretKey
    );
    const signatureHex = Buffer.from(signature).toString('hex');

    // 4. Send
    const finalTx = {
        ...transaction,
        sender_signature: signatureHex
    };

    await fetch('http://localhost:3000/rpc/sendRawTx', {
        method: 'POST',
        body: JSON.stringify(finalTx)
    });
}
```

---

## 3. Post Sharing

Posting content is a `POST_CONTENT` transaction sent directly to the chain.

### 3.1 Code Example

```typescript
async function sharePost(content: string, senderKeyPair: nacl.SignKeyPair) {
    const transaction = {
        tx_id: "...",
        from_wallet: "TRN_SENDER",
        to_wallet: "TRN_SENDER", // To yourself, or a specific "Feed" address
        type: 'POST_CONTENT',
        amount: 0,
        fee: 0, // Usually free or small fee
        timestamp: Date.now(),
        nonce: 10, // Increment!
        payload: {
            content: content,
            media: [], // Optional images
            tags: ["#tracenet"]
        },
        sender_public_key: Buffer.from(senderKeyPair.publicKey).toString('hex')
    };

    // Sign (Same logic as Coin Transfer)
    // ...
    // Send to /rpc/sendRawTx
}
```

---

## 4. Message Sending (Private)

Messages use the `InnerTransaction` format and are sent to the **Mempool** (`/api/messaging/pool`), not the raw RPC.

### 4.1 Key Differences
*   **Endpoint**: `/api/messaging/pool`
*   **Signing**: `sender_public_key` is **NOT** included in the `signableData` string for Inner Transactions.
*   **Encryption**: Content must be encrypted with `nacl.box`.

### 4.2 Code Example

```typescript
async function sendMessage(
    recipientPublicKeyHex: string, // Curve25519 Key (converted from Ed25519 likely)
    messageContent: string,
    senderKeyPair: nacl.SignKeyPair // Ed25519
) {
    // Note: encryption keys (Curve25519) are different from signing keys (Ed25519)
    // You must convert them or derivation them separately.
    // const senderEncKey = nacl.box.keyPair.fromSecretKey(convertedSecret);
     
    // 1. Encrypt Content
    const nonce = nacl.randomBytes(24);
    // const encrypted = nacl.box(...)
    // const encryptedHex = nonce + ":" + ciphertext;

    const innerTx = {
        type: 'PRIVATE_MESSAGE',
        from_wallet: "TRN_SENDER",
        to_wallet: "TRN_RECIPIENT",
        amount: 1, // Anti-spam burn
        payload: {
            content: "ENCRYPTED_HEX_STRING"
        },
        timestamp: Date.now(),
        nonce: 15,
        max_wait_time: 3600000,
        sender_public_key: Buffer.from(senderKeyPair.publicKey).toString('hex')
    };

    // 2. Sign
    // IMPORTANT: sender_public_key is EXCLUDED for Inner Tx signing
    const signableData = JSON.stringify({
        type: innerTx.type,
        from_wallet: innerTx.from_wallet,
        to_wallet: innerTx.to_wallet,
        amount: innerTx.amount,
        payload: innerTx.payload,
        timestamp: innerTx.timestamp,
        nonce: innerTx.nonce,
        max_wait_time: innerTx.max_wait_time
    });

    const signature = nacl.sign.detached(
        new TextEncoder().encode(signableData),
        senderKeyPair.secretKey
    );
    
    // 3. Submit
    const payload = {
        ...innerTx,
        signature: Buffer.from(signature).toString('hex')
    };

    await fetch('http://localhost:3000/api/messaging/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}
```
