# TraceNet V2 Frontend Integration Guide

This guide details the integration steps for the TraceNet V2 Protocol, focusing on **Time-Weighted Fees**, **Coin Transfers**, and the new **Batch Messaging System** (Privacy V2).

---

## 1. Coin Transfer & Fee Calculation

### 1.1 Calculate Fee (Pre-flight)

Before sending a transaction, you **MUST** calculate the fee to present to the user. V2 uses a tiered base rate + priority surcharge.

**Endpoint:** `POST /rpc/calculateTransferFee`

**Request:**
```json
{
  "recipient_address": "TRN...",
  "amount": 100, // Amount in smallest unit (integer) or float? 
                 // Note: System expects number. 100 satoshis or 100 tokens? 
                 // Verify: Token decimals = 8.
                 // Recommendation: Send amount in smallest unit if possible, but endpoint handles numbers.
  "priority": "STANDARD" // Options: "STANDARD", "HIGH", "URGENT"
}
```

**Response:**
```json
{
  "total_fee": 1.01,          // THE VALUE TO USE IN TRANSACTION
  "total_fee_readable": "0.00000001 LT", 
  "fee_breakdown": { ... }
}
```

### 1.2 Send Transaction (`/rpc/sendRawTx`)

**Flow:**
1.  Construct Transaction Object.
2.  Sign it (Order matters!).
3.  Submit.

**Transaction Structure:**
```typescript
const tx = {
    tx_id: "...", // SHA256(from + to + amount + timestamp)
    from_wallet: "TRN_SENDER",
    to_wallet: "TRN_RECIPIENT",
    type: "TRANSFER",
    amount: 100,
    fee: 1.01, // Must match or exceed calculateTransferFee result
    timestamp: Date.now(),
    nonce: 1, // Sender's current nonce + 1
    payload: { priority: "HIGH" }, // Optional but recommended for consistency
    sender_public_key: "..." // REQUIRED for V2 Verification
};
```

**Signing Process (Client-Side):**
1.  Create `signableData` JSON string **EXCLUDING** signature and public key (usually).
    *   *Correction for V2*: The server verifies `sender_public_key` if provided in the object, but usually `KeyManager.verify` takes the data.
    *   **CRITICAL**: `sender_public_key` MUST be in the `Transaction` object sent to the server.
2.  Sign `signableData`.
3.  Attach `sender_signature` and `sender_public_key` to object.

**Request:**
```json
{
  "tx_id": "...",
  "from_wallet": "...",
  ...
  "sender_signature": "HEX_SIGNATURE",
  "sender_public_key": "HEX_PUBLIC_KEY"
}
```

---

## 2. Secure Messaging (V2 Privacy Pool)

Messages are no longer direct transactions. They are `InnerTransaction`s submitted to a memory pool. Validators batch them.

**Endpoint:** `POST /api/messaging/pool`

### 2.1 Construct Inner Transaction

```typescript
const innerTx = {
    type: "PRIVATE_MESSAGE",
    from_wallet: "TRN_SENDER",
    to_wallet: "TRN_RECIPIENT",
    amount: 1, // Nominal burn/fee amount (e.g. 1 unit) to prevent spam
    payload: {
        content: "ENCRYPTED_CONTENT_HEX" // Encrypted via NaCl Box
    },
    timestamp: Date.now(),
    nonce: 1, // Sender's Nonce + 1
    max_wait_time: 3600000, // 1 Hour (example)
    sender_public_key: "HEX_PUBLIC_KEY" // REQUIRED
};
```

### 2.2 Signing (V2 Strict Order)

You must verify `signableData` matches EXACTLY what the server reconstructs.

**Fields to Sign (in JSON order):**
```json
{
    "type": "PRIVATE_MESSAGE",
    "from_wallet": "...",
    "to_wallet": "...",
    "amount": 1,
    "payload": { ... },
    "timestamp": 12345678,
    "nonce": 1,
    "max_wait_time": 3600000,
    "sender_public_key": "..." // NOW REQUIRED IN SIGNING DATA
}
```
*Note: Ensure `JSON.stringify` order matches. Libraries usually sort keys or use a deterministic serializer.*

### 2.3 Submit

**Request:**
```json
{
    ...innerTx,
    "signature": "HEX_SIGNATURE"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message added to pool",
  "pool_id": "..."
}
```

---

## 3. Social Interaction (Likes, Follows)

**Endpoint:** `POST /api/social/like` (Helper) OR `POST /rpc/sendRawTx` (Direct)

The helper endpoint builds the transaction for you but requires you to trust the server or sign a "template".
**Preferred Method (Direct):** Use `sendRawTx` with `type: "LIKE"`.

**Structure:**
```typescript
{
    type: "LIKE",
    payload: { content_id: "..." },
    fee: 2000, // 0.00002 LT (Fixed Social Fee)
    ...
}
```

---
## 4. Key Updates & Breaking Changes

1.  **Strict Fee Validation**: If you pay a "Standard" fee but expect "High" priority speed, the transaction might be rejected or delayed by the Time-Weighted logic.
2.  **Public Key Requirement**: `sender_public_key` is now **MANDATORY** in transaction payloads for stateless verification.
3.  **Messaging Flow**: Do **NOT** send `PRIVATE_MESSAGE` via `sendRawTx`. Use `api/messaging/pool`.

