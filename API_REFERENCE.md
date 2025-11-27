# TraceNet API Reference

This document provides a comprehensive reference for all TraceNet API endpoints, including examples in JavaScript and Python.

## Base URL
`http://localhost:3000`

---

## ⛓️ Blockchain APIs

### Get Blockchain Status
**GET** `/rpc/status`
Returns current blockchain statistics including block height, transaction count, and chain ID.

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/rpc/status');
const data = await response.json();
console.log('Block Height:', data.blockchain.height);
console.log('Chain ID:', data.blockchain.chainId);
```

#### Python
```python
import requests
response = requests.get('http://localhost:3000/rpc/status')
data = response.json()
print(f"Block Height: {data['blockchain']['height']}")
print(f"Chain ID: {data['blockchain']['chainId']}")
```

### Get Balance
**GET** `/rpc/balance/:walletId`
Returns the balance of a specific wallet.

#### JavaScript
```javascript
const walletId = 'TRN...';
const response = await fetch(`http://localhost:3000/rpc/balance/${walletId}`);
const data = await response.json();
console.log('Balance:', data.balance / 100000000, 'LT');
```

#### Python
```python
wallet_id = 'TRN...'
response = requests.get(f'http://localhost:3000/rpc/balance/{wallet_id}')
data = response.json()
print(f"Balance: {data['balance'] / 100000000} LT")
```

### Get All Accounts
**GET** `/rpc/accounts`
Returns a list of all accounts with their balances.

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/rpc/accounts');
const data = await response.json();
data.accounts.forEach(acc => console.log(`${acc.address}: ${acc.balance}`));
```

#### Python
```python
response = requests.get('http://localhost:3000/rpc/accounts')
data = response.json()
for acc in data['accounts']:
    print(f"{acc['address']}: {acc['balance']}")
```

### Get Block
**GET** `/rpc/block/:indexOrHash`
Returns block details by index or hash.

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/rpc/block/1');
const data = await response.json();
console.log('Block:', data);
```

#### Python
```python
response = requests.get('http://localhost:3000/rpc/block/1')
data = response.json()
print('Block:', data)
```

---

## 💸 Transfer APIs

### Calculate Transfer Fee
**POST** `/rpc/calculateTransferFee`
Calculates the dynamic fee for a transfer based on recipient activity and priority.

**Body:**
```json
{
  "recipient_address": "TRN...",
  "amount": 100000000,
  "priority": "STANDARD" // STANDARD, LOW, MEDIUM, HIGH
}
```

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/rpc/calculateTransferFee', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipient_address: 'TRN...',
    amount: 100 * 100000000,
    priority: 'STANDARD'
  })
});
const data = await response.json();
console.log('Fee:', data.total_fee_readable);
```

#### Python
```python
response = requests.post('http://localhost:3000/rpc/calculateTransferFee', json={
    'recipient_address': 'TRN...',
    'amount': 100 * 100000000,
    'priority': 'STANDARD'
})
data = response.json()
print(f"Fee: {data['total_fee_readable']}")
```

### Send Transfer
**POST** `/rpc/transfer`
Sends a transfer transaction. Requires valid signature.

**Body:**
```json
{
  "from_wallet": "TRN...",
  "to_wallet": "TRN...",
  "amount": 100000000,
  "priority": "STANDARD",
  "sender_public_key": "...",
  "sender_signature": "..."
}
```

#### JavaScript
```javascript
// Sign transaction data first using KeyManager
const response = await fetch('http://localhost:3000/rpc/transfer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_wallet: 'TRN...',
    to_wallet: 'TRN...',
    amount: 50 * 100000000,
    priority: 'MEDIUM',
    sender_public_key: publicKey,
    sender_signature: signature
  })
});
const data = await response.json();
console.log('TX ID:', data.tx_id);
```

#### Python
```python
# Sign transaction data first
response = requests.post('http://localhost:3000/rpc/transfer', json={
    'from_wallet': 'TRN...',
    'to_wallet': 'TRN...',
    'amount': 50 * 100000000,
    'priority': 'MEDIUM',
    'sender_public_key': public_key,
    'sender_signature': signature
})
data = response.json()
print(f"TX ID: {data['tx_id']}")
```

---

## 👤 User APIs

### Create User
**POST** `/api/user/create`
Creates a new user profile and associated wallet.

**Body:**
```json
{
  "nickname": "alice",
  "name": "Alice",
  "surname": "Smith",
  "birth_date": "1990-01-01"
}
```

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/api/user/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nickname: 'alice',
    name: 'Alice',
    surname: 'Smith',
    birth_date: '1990-01-01'
  })
});
const data = await response.json();
console.log('User ID:', data.user.user_id);
console.log('Mnemonic:', data.mnemonic); // SAVE THIS!
```

#### Python
```python
response = requests.post('http://localhost:3000/api/user/create', json={
    'nickname': 'alice',
    'name': 'Alice',
    'surname': 'Smith',
    'birth_date': '1990-01-01'
})
data = response.json()
print(f"User ID: {data['user']['user_id']}")
print(f"Mnemonic: {data['mnemonic']}")
```

### Get User by Nickname
**GET** `/api/user/nickname/:nickname`

### Search Users
**GET** `/api/user/search?q=query`

### Check Nickname Availability
**GET** `/api/user/check-nickname/:nickname`

---

## 💼 Wallet APIs

### Create Wallet
**POST** `/api/wallet/create`
Creates a new wallet for an existing user.

### List Wallets
**GET** `/api/wallet/list/:userId`

### Get Wallet Details
**GET** `/api/wallet/:walletId`

---

## 💬 Messaging APIs (Secure)

### Send Encrypted Message
**POST** `/api/messaging/send`
Sends an end-to-end encrypted message. **Message must be encrypted client-side.**

**Body:**
```json
{
  "from_wallet": "TRN...",
  "to_wallet": "TRN...",
  "encrypted_message": "...", // Encrypted with recipient's public key
  "sender_public_key": "...",
  "sender_signature": "..."
}
```

#### JavaScript
```javascript
// 1. Encrypt message client-side
const encryptedMessage = KeyManager.encryptForUser(
  "Hello World",
  myEncryptionPrivateKey,
  recipientEncryptionPublicKey
);

// 2. Send
const response = await fetch('http://localhost:3000/api/messaging/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from_wallet: 'TRN...',
    to_wallet: 'TRN...',
    encrypted_message: encryptedMessage,
    sender_public_key: senderPublicKey,
    sender_signature: signature
  })
});
```

#### Python
```python
# 1. Encrypt message client-side
encrypted_message = encrypt_for_user(
    "Hello World",
    my_encryption_private_key,
    recipient_encryption_public_key
)

# 2. Send
response = requests.post('http://localhost:3000/api/messaging/send', json={
    'from_wallet': 'TRN...',
    'to_wallet': 'TRN...',
    'encrypted_message': encrypted_message,
    'sender_public_key': sender_public_key,
    'sender_signature': signature
})
```

### Get Inbox (New!)
**GET** `/api/messaging/inbox/:walletId`
Retrieves encrypted messages for a wallet.

#### JavaScript
```javascript
const response = await fetch('http://localhost:3000/api/messaging/inbox/TRN...');
const data = await response.json();
data.messages.forEach(msg => {
    console.log('From:', msg.from);
    console.log('Encrypted Content:', msg.encrypted_content);
    // Decrypt client-side using KeyManager.decryptFromUser()
});
```

#### Python
```python
response = requests.get('http://localhost:3000/api/messaging/inbox/TRN...')
data = response.json()
for msg in data['messages']:
    print(f"From: {msg['from']}")
    print(f"Encrypted: {msg['encrypted_content']}")
```

---

## ❤️ Social APIs

### Like Content
**POST** `/api/social/like`

### Follow User
**POST** `/api/social/follow`

### Get Followers
**GET** `/api/social/followers/:walletId`

---

## 📝 Content APIs

### Create Content
**POST** `/api/content/create`

### Get Content Feed
**GET** `/api/content/feed`

### Get User Content
**GET** `/api/content/user/:walletId`
