# TraceNet Full API Documentation

This document provides a complete reference for all available API endpoints on the TraceNet node, including request parameters and code examples.

## Table of Contents
1. [RPC Endpoints (Blockchain Core)](#1-rpc-endpoints-blockchain-core)
2. [Wallet Endpoints](#2-wallet-endpoints)
3. [User Endpoints](#3-user-endpoints)
4. [Content Endpoints](#4-content-endpoints)
5. [Social Endpoints](#5-social-endpoints)
6. [Messaging Endpoints](#6-messaging-endpoints)
7. [Validator Endpoints](#7-validator-endpoints)

---

## 1. RPC Endpoints (Blockchain Core)
Interaction with core blockchain data and transaction submission.

### Get Status
Returns current blockchain status (height, tx count, chain ID).

- **URL:** `/rpc/status`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/rpc/status');
const data = await response.json();
console.log(data);
```

### Get Block
Retrieves a block by its height (index) or hash.

- **URL:** `/rpc/block/:indexOrHash`
- **Method:** `GET`

**Example:**
```javascript
// Get block by height
const response = await fetch('http://localhost:3000/rpc/block/1');
const data = await response.json();
```

### Get Transaction
Retrieves a specific transaction by its ID.

- **URL:** `/rpc/transaction/:txId`
- **Method:** `GET`

**Example:**
```javascript
const txId = 'TX_12345...';
const response = await fetch(`http://localhost:3000/rpc/transaction/${txId}`);
const data = await response.json();
```

### Get Balance
Returns the current balance of a wallet address.

- **URL:** `/rpc/balance/:walletId`
- **Method:** `GET`

**Example:**
```javascript
const walletId = 'TRN...';
const response = await fetch(`http://localhost:3000/rpc/balance/${walletId}`);
const data = await response.json();
console.log('Balance:', data.balance);
```

### Get All Accounts
Lists all accounts with non-zero balances or activity.

- **URL:** `/rpc/accounts`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/rpc/accounts');
const data = await response.json();
```

### Calculate Transfer Fee
Calculates the dynamic fee for a transfer.

- **URL:** `/rpc/calculateTransferFee`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "recipient_address": "TRN...",
    "amount": 100000000,
    "priority": "STANDARD"
  }
  ```

**Example:**
```javascript
const response = await fetch('http://localhost:3000/rpc/calculateTransferFee', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipient_address: 'TRN...',
    amount: 100,
    priority: 'STANDARD'
  })
});
const data = await response.json();
console.log('Fee:', data.total_fee_readable);
```

### Send Transfer
Simplified endpoint to send a transfer (requires signature).

- **URL:** `/rpc/transfer`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "from_wallet": "TRN...",
    "to_wallet": "TRN...",
    "amount": 100,
    "sender_public_key": "...",
    "sender_signature": "..."
  }
  ```

**Example:**
```javascript
// Signature generation required client-side
const response = await fetch('http://localhost:3000/rpc/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_wallet: 'TRN_Sender...',
    to_wallet: 'TRN_Recipient...',
    amount: 50000000,
    sender_public_key: '...',
    sender_signature: '...'
  })
});
```

---

## 2. Wallet Endpoints
Manage wallets and keys.

### Create Wallet
Creates a new wallet for a user.

- **URL:** `/api/wallet/create`
- **Method:** `POST`
- **Body:**
  ```json
  { "userId": "Optional_User_ID" }
  ```

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/wallet/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'USR_123' })
});
const data = await response.json();
console.log('Mnemonic:', data.mnemonic); // Save this securely!
```

### List Wallets
Lists all wallets associated with a specific user ID.

- **URL:** `/api/wallet/list/:userId`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/wallet/list/USR_123');
```

---

## 3. User Endpoints
Manage user profiles and identity.

### Create User
Registers a new user profile. All fields are optional.

- **URL:** `/api/user/create`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "nickname": "alice",
    "email": "alice@example.com",
    "name": "Alice",
    "surname": "Wonderland"
  }
  ```

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/user/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nickname: 'alice_v2'
  })
});
```

### Get User by Nickname
Finds a user by their unique nickname.

- **URL:** `/api/user/nickname/:nickname`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/user/nickname/alice');
```

### Search Users
Searches for users by name or nickname.

- **URL:** `/api/user/search?q=query`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/user/search?q=ali');
```

---

## 4. Content Endpoints
Create and retrieve content.

### Create Content
Publishes new content to the blockchain.

- **URL:** `/api/content/create`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "wallet_id": "TRN...",
    "content_type": "POST",
    "title": "My Post",
    "description": "Content body",
    "tags": ["tag1"]
  }
  ```

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/content/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_id: 'TRN...',
    content_type: 'POST',
    title: 'Hello World',
    description: 'This is my first post on TraceNet.'
  })
});
```

### Get Feed
Retrieves the global content feed.

- **URL:** `/api/content/feed`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/content/feed?limit=10');
```

---

## 5. Social Endpoints
Social interactions.

### Like Content
Likes a content item.

- **URL:** `/api/social/like`
- **Method:** `POST`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/social/like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_id: 'TRN...',
    content_id: 'CONTENT_ID...'
  })
});
```

### Follow User
Follows another user/wallet.

- **URL:** `/api/social/follow`
- **Method:** `POST`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/social/follow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    follower_wallet: 'TRN_Me...',
    following_wallet: 'TRN_Target...'
  })
});
```

---

## 6. Messaging Endpoints (Secure)
End-to-end encrypted messaging.

### Send Message
Sends an encrypted message. **Encryption must happen client-side.**

- **URL:** `/api/messaging/send`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "from_wallet": "TRN...",
    "to_wallet": "TRN...",
    "encrypted_message": "HEX_STRING...",
    "sender_public_key": "HEX...",
    "sender_signature": "HEX..."
  }
  ```

**Example:**
```javascript
// 1. Encrypt message client-side using TweetNaCl
// 2. Sign transaction
// 3. Send payload
const response = await fetch('http://localhost:3000/api/messaging/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_wallet: 'TRN...',
    to_wallet: 'TRN...',
    encrypted_message: '...', 
    sender_public_key: '...',
    sender_signature: '...'
  })
});
```

### Get Inbox
Retrieves encrypted messages.

- **URL:** `/api/messaging/inbox/:walletId`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/messaging/inbox/TRN...');
```

---

## 7. Validator Endpoints
Network validator management.

### Register Validator
Registers a new validator node.

- **URL:** `/api/validator/register`
- **Method:** `POST`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/validator/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet_id: 'TRN...',
    ip_address: '192.168.1.100',
    port: 3000
  })
});
```

### List Validators
Lists all active validators.

- **URL:** `/api/validator/list`
- **Method:** `GET`

**Example:**
```javascript
const response = await fetch('http://localhost:3000/api/validator/list');
```
