# TraceNet v1.1.0 API Integration Guide

This document is the **single source of truth** for integrating the TraceNet Blockchain (v1.1.0) with frontend applications (Web, Mobile). It combines endpoint definitions, data models, and practical `curl` examples.

## Base Configuration
*   **Base URL**: `http://localhost:3000` (Dev) or `https://node.tracenet.io` (Prod)
*   **Content-Type**: `application/json`

---

## 1. Authentication & Onboarding

### 1.1 Create User & Wallet
Creates a new user profile and generates their first wallet.
*   **Endpoint:** `POST` `/api/user/create`
*   **Response**: Contains the `mnemonic` (seed phrase). **display this once** and warn the user to save it.

**Request:**
```bash
curl -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "crypto_alice",
    "email": "alice@example.com", 
    "name": "Alice",
    "surname": "Wonderland",
    "birth_date": "1995-05-15"
  }'
```

**Response:**
```json
{
  "user": {
    "user_id": "TRN7x8...", 
    "nickname": "crypto_alice",
    "messaging_privacy": "public" 
  },
  "wallet": {
    "wallet_id": "TRN7x8...", // This is the Wallet Address
    "public_key": "abc123..."
  },
  "mnemonic": "witch collapse practice feed shame open despair creek road again ice least"
}
```

### 1.2 Get User Profile
**Endpoint:** `GET` `/api/user/:userId`

**Response:**
```json
{
  "user": {
    "user_id": "TRN7x8...",
    "nickname": "crypto_alice",
    "encryption_public_key": "..." 
  },
  "balance": 5000000000,
  "total_wallets": 1
}
```

---

## 2. Wallet & Transfers

### 2.1 Get Balance
**Endpoint:** `GET` `/rpc/balance/:walletId`

**Response:**
```json
{
  "wallet_id": "TRN7x8...",
  "balance": 5000000000 // In smallest unit (10^8)
}
```

### 2.2 Send Tokens (Transfer)
**Endpoint:** `POST` `/rpc/transfer`
*   **Note**: For maximum security, sign transactions client-side and use `/rpc/sendRawTx`. This endpoint is a convenience wrapper for development.

**Request:**
```bash
curl -X POST http://localhost:3000/rpc/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_wallet": "TRN_SENDER",
    "to_wallet": "TRN_RECIPIENT",
    "amount": 100000000, 
    "priority": "STANDARD"
  }'
```
*   `amount`: 100000000 = 1.00 TRN (8 decimals).

---

## 3. Social Interactions

### 3.1 Get Global Feed
**Endpoint:** `GET` `/api/content/feed?limit=20&offset=0`

### 3.2 Create Post
**Endpoint:** `POST` `/api/content/create`

**Request:**
```bash
curl -X POST http://localhost:3000/api/content/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TRN_USER_ID",
    "content": "Just joined TraceNet! #hello",
    "type": "text"
  }'
```

### 3.3 Like Post
Cost: `0.00001 TRN` (Fee).
**Endpoint:** `POST` `/api/social/like`

**Request:**
```bash
curl -X POST http://localhost:3000/api/social/like \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN_USER_ID",
    "content_id": "POST_UUID"
  }'
```

### 3.4 Follow User
Cost: `FREE`
**Endpoint:** `POST` `/api/social/follow`

**Request:**
```bash
curl -X POST http://localhost:3000/api/social/follow \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN_FOLLOWER",
    "target_wallet_id": "TRN_TARGET"
  }'
```

---

## 4. Messaging V2 (Privacy & Batching)

### 4.1 Client-Side Encryption Flow
1.  Fetch recipient's public key: `GET /api/user/encryption-key/:recipientId`
2.  Encrypt message using **Curve25519** (TweetNaCl.js recommended).
3.  Sign the inner transaction details.
4.  Submit to Message Pool.

### 4.2 Submit Encrypted Message
**Endpoint:** `POST` `/api/messaging/pool`

**Request Model (`InnerTransaction`):**
```bash
curl -X POST http://localhost:3000/api/messaging/pool \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PRIVATE_MESSAGE",
    "from_wallet": "TRN_SENDER",
    "to_wallet": "TRN_RECIPIENT",
    "amount": 0.000001, 
    "timestamp": 1703200000000,
    "nonce": 5, 
    "max_wait_time": 3600000,
    "payload": {
      "content": "ENCRYPTED_STRING_BASE64"
    },
    "signature": "Hex_Signature_of_JSON_stringified_fields_above"
  }'
```
*   **Signature Construction**: `KeyManager.sign(JSON.stringify({ type, from_wallet, to_wallet, amount, payload, timestamp, nonce, max_wait_time }), privateKey)`

### 4.3 Get Inbox
**Endpoint:** `GET` `/api/messaging/inbox/:walletId`

---

## 5. Economy & Validators

### 5.1 Token Stats
**Endpoint:** `GET` `/economy/tokenPrice`

**Response:**
```json
{
  "data": {
    "tokenPrice": 1.25,
    "marketCap": 125000000,
    "totalSupply": 100000000
  }
}
```

### 5.2 List Validators
**Endpoint:** `GET` `/api/validator/list?online=true`

### 5.3 Fetch Messages for Batching (Validator Only)
**Endpoint:** `GET` `/api/validator/messages?limit=50`
Returns verified `InnerTransaction`s ordered by Fee Density.

---

## 6. Client-Side Transaction Signing Guide (Raw Mode)

If you are building a secure JS client, use `/rpc/sendRawTx`.

1.  **Construct Payload**:
    ```json
    {
      "tx_id": "", // Generate SHA256(from+to+amount+timestamp)
      "from_wallet": "...",
      "to_wallet": "...",
      "type": "TRANSFER",
      "amount": 100,
      "fee": 10,
      "timestamp": 123456789,
      "nonce": 1
    }
    ```
2.  **Sign**: Sign the JSON string of the payload with the sender's Private Key (Ed25519).
3.  **Attach**: Add `sender_public_key` and `sender_signature` to the object.
4.  **POST**: Send to `/rpc/sendRawTx`.
