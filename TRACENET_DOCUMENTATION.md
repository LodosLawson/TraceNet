title: TraceNet Technical Documentation
version: 1.1.0
last_updated: 2025-12-07
status: ACTIVE
---

# TraceNet Technical Documentation

This document provides a detailed technical overview of the TraceNet blockchain application, focusing on core functionalities: Coin Transfers, Messaging, User Search, Content Sharing, User Management, and Tokenomics.

## 1. Coin Transfers (Coin Transferleri)

Coin transfers in TraceNet are executed via verified blockchain transactions. The system uses a dynamic fee model based on network activity and user history.

### Mechanism
Transfers are handled by the `TransactionType.TRANSFER` transaction. The process involves:
1.  **Fee Calculation**: Fees are dynamic and calculated based on the recipient's incoming transfer count (to prevent spam) and a priority level chosen by the sender.
2.  **Transaction Creation**: A transaction object is created with type `TRANSFER`, containing the amount and calculated fee.
3.  **Signing**: The transaction is signed using the sender's Ed25519 private key.
4.  **Broadcast**: The signed transaction is sent to the blockchain node (mempool).

### Key Components
*   **SDK Method**: `TraceNetSDK.transfer(toAddress, amount, options)`
*   **Model**: `TransactionModel`
*   **Transaction Type**: `TransactionType.TRANSFER`

### Implementation Details
The `TraceNetSDK` abstracts the complexity. Under the hood, it performs:

```typescript
// Algorithm for Transfer
async function transfer(toAddress: string, amount: number, options: TransferOptions) {
    // 1. Calculate Fee
    const fee = await calculateTransferFee(toAddress, amount, options.priority);

    // 2. Create Transaction
    const tx = TransactionModel.create(
        wallet.address,
        toAddress,
        TransactionType.TRANSFER,
        amount,
        fee
    );

    // 3. Sign Transaction
    tx.sender_public_key = wallet.publicKey;
    tx.sender_signature = KeyManager.sign(tx.getSignableData(), wallet.privateKey);

    // 4. Submit to Node
    return await api.post('/transactions/add', tx);
}
```

### API Endpoint
*   **Endpoint**: `POST /transactions/add`
*   **Body**: JSON representation of the signed `TransactionModel`.

### Lifecycle of a Transfer
To understand exactly what happens during a transfer, here is the step-by-step lifecycle:

1.  **Initiation**:
    *   User clicks "Send".
    *   `TraceNetSDK` queries the `FeeHandler` to get the current fee rate for the recipient.
    *   *Why?* To prevent spam, accounts receiving thousands of small transactions trigger higher fees for senders.

2.  **Creation & Signing**:
    *   A `Transaction` object is built: `{ type: 'TRANSFER', amount: 100, fee: 1, ... }`.
    *   The hash of this object (`tx_id`) is signed with the user's private key.

3.  **Propagation**:
    *   The signed JSON is POSTed to the Node (`/transactions/add`).
    *   The Node validates the signature and checks the user's balance.

4.  **Mempool**:
    *   If valid, the transaction sits in the `Mempool` (Memory Pool) waiting for a miner/validator.

5.  **Block Inclusion**:
    *   A Validator picks the transaction, verifies it again, and includes it in a new `Block`.
    *   The Block is finalized and added to the chain.

6.  **State Update**:
    *   The `Blockchain` state machine processes the block.
    *   Sender balance decreases by `amount + fee`.
    *   Recipient balance increases by `amount`.
    *   Treasury balance increases by `fee` (split with Validator).

---

## 2. Secure Messaging (Mesaj Gönderme)

TraceNet supports end-to-end encrypted messaging stored directly on the blockchain. Messages can be free-standing or include a payment (`MESSAGE_PAYMENT`).

### Mechanism
Messages are encrypted using `NaCl` (Curve25519) before being placed in a transaction payload. This ensures only the sender and recipient can read the content.

### encryption Process
1.  **Key Lookup**: Retrieve the recipient's `encryption_public_key` (distinct from their signing key).
2.  **Shared Secret**: ECDH is used to derive a shared secret using Sender's Private Key + Recipient's Public Key.
3.  **Encryption**: The message is encrypted client-side.
4.  **Transaction**: A `PRIVATE_MESSAGE` transaction is created with the encrypted payload.

### Implementation Details

```typescript
// SDK: sending a message
async function sendMessage(toAddress, message, recipientEncryptionPublicKey) {
    // 1. Encrypt (Client Side)
    const encryptedMessage = KeyManager.encryptForUser(
        message,
        wallet.encryptionPrivateKey,
        recipientEncryptionPublicKey
    );

    // 2. Create Transaction
    const tx = TransactionModel.create(
        wallet.address,
        toAddress,
        TransactionType.PRIVATE_MESSAGE,
        0, // amount
        TOKEN_CONFIG.MESSAGE_FEE,
        { message: encryptedMessage, encrypted: true }
    );
    
    // 3. Sign & Submit
    // ... same as transfer
}
```

### Transaction Types
*   **`PRIVATE_MESSAGE`**: Standard encrypted text message.
*   **`MESSAGE_PAYMENT`**: A transfer of coins attached with an encrypted message.

### Encryption Technical Deep Dive
For developers implementing alternative clients, here are the exact cryptographic specifications used by TraceNet for messaging:

#### 1. Libraries & Standards
*   **Core Library**: `tweetnacl` (matches standard NaCl/libsodium).
*   **Key Derivation**: `BIP39` (Mnemonic) + `BIP32` (HD Wallet).
*   **Encryption Scheme**: `Curve25519` (Key Exchange) + `XSalsa20` (Stream Cipher) + `Poly1305` (MAC).

#### 2. Key Generation
Different keys are used for signing (Identity) and encryption (Messaging) to improve security.

*   **Master Seed**: Generated from 24-word BIP39 Mnemonic (`bip39.mnemonicToSeedSync`).
*   **Signing Keys (Ed25519)**:
    *   Derived directly from the first 32 bytes of the Master Seed.
    *   Used for: Signing Transactions (`TransactionModel`).
*   **Encryption Keys (Curve25519)**:
    *   **HD Path**: `m/44'/0'/0'/1'/0'`
    *   **Derivation**: Uses `HDKey` (from `@scure/bip32`) to derive a private scalar.
    *   **Conversion**: The derived scalar is used as a secret key to generate a `nacl.box.keyPair`.
    *   **Used for**: `nacl.box` operations.

#### 3. Encryption Algorithm
TraceNet uses the standard `nacl.box` construction (Authenticated Encryption).

**Sender Steps (`encryptForUser`):**
1.  **Inputs**: Message (UTF-8), Sender Private Key (Curve25519), Recipient Public Key (Curve25519).
2.  **Nonce**: Generate 24 random bytes (`nacl.randomBytes`).
3.  **Encrypt**: `ciphertext = nacl.box(message, nonce, recipientPubKey, senderPrivKey)`
4.  **Format**: Combine Nonce and Ciphertext with a colon separator:
    ```
    hex(nonce) + ":" + hex(ciphertext)
    ```

**Recipient Steps (`decryptFromUser`):**
1.  **Parse**: Split the string by `:` to get `nonce` and `ciphertext`.
2.  **Decrypt**: `message = nacl.box.open(ciphertext, nonce, senderPubKey, recipientPrivKey)`
    *   *Note: Sender Public Key is required for decryption (Authenticated Encryption).*
3.  **Verify**: `nacl.box.open` returns `null` if authentication fails (e.g., tampered data or wrong sender).

#### 4. Security Notes
*   **Forward Secrecy (Key Rotation)**: Users can rotate their encryption keys to secure future messages and effectively delete access to old ones.
    *   **Mechanism**: Increment the derivation path index (`m/44'/0'/0'/1'/${index}'`).
    *   **Effect**: By updating the profile with a new `encryption_public_key`, new messages use the new key.
    *   **History Deletion**: If the user discards the old private key (or simply forgets the old index/doesn't derive it), old messages become permanently unreadable ("Self-Shredding").
*   **Client-Side Only**: All encryption/decryption happens locally on the user's device. The exact private keys are never sent to the server.

---

## 3. User Search & Discovery (Kullanıcı Arama ve Bulma)

Searching on TraceNet is hybrid, utilizing both fast in-memory indexes and blockchain verification.

### Scope
*   **Users**: Search by nickname, wallet address, or email.
*   **Content**: Search by hashtags (e.g., in posts).
*   **Blocks/Transactions**: Search by ID or height.

### Mechanism
The `UserService` maintains a `nicknameIndex` for O(1) lookups. When a search query is received:
1.  The system scans the in-memory user index for string matches.
2.  Results include public profile metadata (nickname, avatar, system_id).
3.  For blockchain-level search, the explorer can query specific transaction hashes.

### API Endpoints
*   **Search Users**: `GET /api/users/search?q={query}`
*   **Get User**: `GET /api/users/{system_id}`
*   **Search Tags**: `GET /api/content/search?tags={tag1},{tag2}`

---

## 4. Content & Posts (Paylaşım Yapma)

Content creation (posts, images, videos) is immutable and tied to the user's wallet.

### Mechanism
Posts are `POST_CONTENT` transactions. Large media files are **not** stored on-chain; only their cryptographic hashes and URLs (e.g., IPFS links) are stored.

### Structure
*   **Transaction Type**: `TransactionType.POST_CONTENT`
*   **Payload**: `ContentMetadata` (title, description, tags, media_url, media_type).

### Implementation Details

```typescript
// Content Creation Flow
function createPost(contentData) {
    // 1. Validate Data
    const contentModel = ContentModel.create(wallet.address, ...contentData);
    
    // 2. Create Transaction
    const tx = TransactionModel.create(
        wallet.address,
        'CONTENT_POOL', // sent to a special pool address
        TransactionType.POST_CONTENT,
        0,
        0, // Posting is often fee-subsidized or low fee
        { content: contentModel.toJSON() }
    );
    
    // 3. Sign & Submit to Mempool
}
```

The `ContentService` also indexes these transactions to build timelines and feeds (`getFeed`, `getUserContent`).

### Social Component Details
Social actions in TraceNet are not just database entries; they are financial transactions that carry small fees and rewards.

#### 1. Likes (`TransactionType.LIKE`)
*   **Cost**: `0.00002 LT`
*   **Distribution**:
    *   **50%** burned/treasury.
    *   **50%** paid directly to the **Post Author**.
*   **Effect**: This creates a direct "tipping" economy where high-quality content earns money simply by being liked.

#### 2. Comments (`TransactionType.COMMENT`)
*   **Cost**: `0.00002 LT`
*   **Structure**:
    ```typescript
    {
        type: 'COMMENT',
        payload: {
            target_post_id: "original-post-uuid",
            content_text: "Great post!",
            parent_comment_id: null // for nested replies
        }
    }
    ```
*   **Distribution**: Similar to likes, a portion of the comment fee goes to the author of the post being commented on.

#### 3. Follows (`TransactionType.FOLLOW`)
*   **Cost**: `0.000001 LT`
*   **Logic**: Following creates a graph edge. This is recorded on-chain so that your "Feed" can be reconstructed on any device by replaying the blockchain history of users you follow.

---

## 5. User Creation (Kullanıcı Oluşturma)

User creation creates a digital identity on the blockchain.

### Process
1.  **Wallet Generation**: A new 24-word IPFS-compatible mnemonic is generated. Keys (Sign & Encrypt) are derived.
2.  **Profile Transaction**: A `PROFILE_UPDATE` transaction is created with the `action: 'USER_CREATED'`. This permanently links the nickname and encryption key to the wallet address on-chain.
3.  **Indexing**: The node sees this transaction and adds the user to the `UserService` index.
4.  **Airdrop**: New users automatically receive an initial coin airdrop from the `AirdropService` to pay for their first transactions.

### Key Data
*   **System ID**: Same as the Wallet Address.
*   **Roles**: Default `USER`.
*   **Privacy**: Users can set messaging privacy to `public`, `followers`, or `private`.

---

## 6. Tokenomics (Token ve Coin Ekonomisi)

TraceNet uses a custom token economy designed for sustainability and incentives.

### Config (`TokenConfig.ts`)
*   **Symbol**: `LT`
*   **Total Supply**: 100,000,000 LT
*   **Decimals**: 8
*   **Initial Airdrop**: 0.00625 LT per new user (Total Pool: 35%)

### Fee Structure
Fees are collected and split to incentivize the ecosystem:
*   **Split**:
    *   **50%** to the Validator/Node (Processing reward).
    *   **50%** to the Treasury (Development & Reserve).
    *   *(For Social Actions)*: A portion goes to the **Content Creator** as a reward.

### Fee Table
| Action | Cost (LT) |
| :--- | :--- |
| **Transfer** | 0.01% - 0.1% (Dynamic based on usage) |
| **Message** | 0.000002 LT |
| **Like** | 0.00002 LT |
| **Comment** | 0.00002 LT |
| **Profile Update** | 0.000005 LT |

### Economic Logic
*   **Anti-Spam**: Fees increase for users who receive too many small transfers (dusting attack prevention).
*   **Creator Economy**: Likes and comments directly reward the content creator financially (25-50% of the network fee goes to the author).


## 7. System Requirements (Sistem Gereksinimleri)

Running a TraceNet node requires specific hardware and software configurations to ensure network stability and performance.

### Minimum Hardware (Minimum Donanım)
*   **CPU**: 2+ Cores (2.0 GHz+)
*   **RAM**: 4 GB (8 GB recommended for Validators)
*   **Storage**: 50 GB SSD (NVMe preferred for high IOPS)
*   **Network**: Stable broadband internet (10 Mbps+ Upload/Download)

### Software Environment (Yazılım Ortamı)
*   **Runtime**: Node.js v20.0.0 or higher
*   **Database**: PostgreSQL 14+
*   **Cache**: Redis 6+
*   **OS**: Linux (Ubuntu 22.04 LTS recommended), Windows (WSL2), or macOS

### Docker Support
For easier deployment, the project includes a `Dockerfile` optimized for `node:20-alpine`.

---
*Generated by TraceNet Documentation Agent targeting `v1.0.0` codebase.*
