# TraceNet v1.1.0 API Usage Guide

This document provides detailed usage examples for the TraceNet API.

## 1. User Onboarding

### Create a New User
This endpoint creates a wallet and a user profile in a single step.

**Endpoint:** `POST` `/api/user/create`

**Request:**
```bash
curl -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "crypto_king",
    "email": "king@tracenet.io",
    "name": "Satoshi",
    "surname": "Nakamoto",
    "birth_date": "2009-01-03"
  }'
```

**Response:**
```json
{
  "user": {
    "user_id": "TRN7x8...", 
    "nickname": "crypto_king",
    ...
  },
  "wallet": {
    "wallet_id": "TRN7x8...",
    "public_key": "abc123..."
  },
  "mnemonic": "witch collapse practice feed shame open despair creek road again ice least"
}
```
> **Note:** Save the `mnemonic` securely! It is the only way to recover the wallet. Since `system_id` is usually the `wallet_id`, you use `TRN...` for subsequent requests.

---

## 2. Transfers

### Send Tokens (Simple)
Send TraceNet (LT) coins to another user.

**Endpoint:** `POST` `/rpc/transfer`

**Request:**
```bash
curl -X POST http://localhost:3000/rpc/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_wallet": "TRN_SENDER_ADDRESS",
    "to_wallet": "TRN_RECIPIENT_ADDRESS",
    "amount": 500000000, 
    "priority": "STANDARD",
    "sender_public_key": "OPTIONAL_IF_LOCAL_WALLET",
    "sender_signature": "OPTIONAL_IF_LOCAL_WALLET"
  }'
```
*   `amount`: In smallest unit (1 LT = 100,000,000 units). Example is 5 LT.

---

## 3. Social Interactions

### Create a Post
**Endpoint:** `POST` `/api/content/create`

**Request:**
```bash
curl -X POST http://localhost:3000/api/content/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "TRN_USER_WALLET_ID",
    "content": "Hello TraceNet! This is my first on-chain post 🚀",
    "type": "text", 
    "media_url": ""
  }'
```

### Like a Post
Likes cost a small fee (0.00001 LT), split between the creator and the treasury.

**Endpoint:** `POST` `/api/social/like`

**Request:**
```bash
curl -X POST http://localhost:3000/api/social/like \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN_LIKER_WALLET_ID",
    "content_id": "CONTENT_UUID_HERE"
  }'
```

---

## 4. Messaging V2 (New Message Pool)

The V2 messaging system introduces a **Message Pool** for batched processing.

### Submit Message to Pool
Instead of sending a transaction directly, you submit a signed `InnerTransaction` to the pool.

**Endpoint:** `POST` `/api/messaging/pool`

**Request:**
```bash
curl -X POST http://localhost:3000/api/messaging/pool \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PRIVATE_MESSAGE",
    "from_wallet": "TRN_SENDER",
    "to_wallet": "TRN_RECIPIENT",
    "amount": 0.000001,
    "payload": {
      "content": "Encrypted message content here..."
    },
    "timestamp": 1703200000000,
    "nonce": 1,
    "max_wait_time": 3600000,
    "signature": "SIGNATURE_OF_ABOVE_DATA"
  }'
```
*   `amount`: The fee you are willing to pay. Lower fees = longer wait time.
*   `max_wait_time`: Max milliseconds you are willing to wait.
*   `signature`: Must be generated client-side using the wallet's private key.

### Fetch Messages (Validator)
Validators use this to fetch high-priority messages to build a Batch Transaction.

**Endpoint:** `GET` `/api/validator/messages`

**Request:**
```bash
curl "http://localhost:3000/api/validator/messages?limit=50&minFee=100"
```

---

## 5. Economy

### Check Details
**Endpoint:** `GET` `/economy/tokenPrice`

**Request:**
```bash
curl http://localhost:3000/economy/tokenPrice
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenPrice": 1.25,
    "marketCap": 125000000,
    ...
  }
}
```
