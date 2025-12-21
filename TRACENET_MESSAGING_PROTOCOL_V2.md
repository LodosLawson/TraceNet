# TraceNet Messaging Protocol V2

**Version**: 1.1.0  
**Status**: Active  
**Features**: Time-Based Fees, Batch Processing, High throughput

## Overview
The V2 Messaging Protocol introduces a scalable, cost-effective messaging layer on top of the TraceNet blockchain. It utilizes **Time-Weighted Fees** to prioritize urgent messages while allowing cost-effective delivery for non-urgent traffic, and **Batch Transactions** to bundle thousands of messages into single on-chain commits.

## 1. Time-Based Fees (Quality of Service)

Users can choose their delivery speed by adjusting the transaction `fee` and their willingness to wait.

| Priority | Fee (TRN) | Max Wait Time | Description |
|---|---|---|---|
| **FAST LANE** | `0.00001` | **0 mins** | Included in the next block immediately. |
| **STANDARD** | `0.0000001` | **10 mins** | Must wait in the pool for at least 10 minutes. |
| **LOW** | `0.00000001` | **1 hour** | Must wait in the pool for at least 1 hour. |

### Client Implementation Logic
1.  **Fast**: Pay `0.00001`. Submit immediately.
2.  **Standard**: Pay `0.0000001`. The validator *will not* include it until `timestamp + 10 mins`.
3.  **Low**: Pay `0.00000001`. The validator *will not* include it until `timestamp + 60 mins`.

> **Note**: If you pay a Low fee but the validator tries to include it too early, the blockchain will **REJECT** the block.

## 2. Inner Transaction Structure
Messages are no longer direct on-chain transactions. They are `InnerTransaction` objects signed by the user and sent to the Validator's **Message Pool**.

```typescript
interface InnerTransaction {
    type: 'PRIVATE_MESSAGE' | 'GROUP_MESSAGE';
    from_wallet: string; // Sender Public Key
    to_wallet: string;   // Recipient Address (or Group ID)
    amount: number;      // Fee Amount (e.g., 0.00001)
    payload: any;        // Encrypted content
    timestamp: number;   // Creation time
    nonce: number;       // Account nonce
    max_wait_time?: number; // Optional: Expiry (ms)
    signature: string;   // Signed by from_wallet
}
```

## 3. API Endpoints

### Submit Message
**POST** `/api/messaging/pool`

Submits a message to the validator's pool.

**Request Body**: `InnerTransaction` (JSON)

**Example (Fast Lane Message)**:
```json
{
  "type": "PRIVATE_MESSAGE",
  "from_wallet": "TRN...",
  "to_wallet": "TRN...",
  "amount": 0.00001,
  "payload": {
    "encrypted": true,
    "content": "a8f923... (encrypted data)"
  },
  "timestamp": 1709420000000,
  "nonce": 5,
  "signature": "381y..."
}
```

### Fetch Messages (For Validators)
**GET** `/api/validator/messages`

Fetches pending messages to build a Batch.

**Query Parameters**:
- `limit`: (Optional) Max messages (default: 50)
- `minWaitTime`: (Optional) Filter for messages waiting > X ms.

## 4. Example: Sending an Encrypted Message

### TypeScript / JavaScript

```typescript
import { KeyManager } from './crypto';

// 1. Prepare Payload
const messageContent = "Hello TraceNet V2!";
const recipientPublicKey = "..."; // Get from /api/user/encryption-key/:userId
const sharedKey = KeyManager.deriveSharedKey(myPrivateKey, recipientPublicKey);
const encryptedContent = KeyManager.encrypt(messageContent, sharedKey);

// 2. define Priority
const PRIORITY = {
  FAST: 0.00001,
  STANDARD: 0.0000001
};

// 3. Construct Inner Transaction
const innerTx = {
    type: 'PRIVATE_MESSAGE',
    from_wallet: myPublicKey,
    to_wallet: recipientAddress,
    amount: PRIORITY.FAST, // Paying for speed
    payload: {
        encrypted: true,
        content: encryptedContent
    },
    timestamp: Date.now(),
    nonce: myNonce + 1, // Fetch latest nonce first
    max_wait_time: 0 // No expiry strictly enforced yet
};

// 4. Sign
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
innerTx.signature = KeyManager.sign(signableData, myPrivateKey);

// 5. Submit to Pool
await axios.post('https://node.tracenet.org/api/messaging/pool', innerTx);
```
