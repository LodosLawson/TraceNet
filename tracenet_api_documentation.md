# TraceNet API Documentation

**Version:** 1.0 (Consolidated)
**Base URL:** `https://tracenet-blockchain-136028201808.us-central1.run.app`
**Audience:** Netra Frontend Developers & Integrators

This is the **Master Documentation** for interacting with the TraceNet Blockchain. It supersedes all previous guides.

---

## 1. Authentication & Signatures

All write operations require a cryptographic signature using the user's wallet keypair.

### Standard Signature Flow
1.  Construct the **Message String** exactly as defined for each endpoint.
2.  Sign the string using the Wallet's Private Key.
3.  Include `public_key` and `signature` (hex string) in the JSON payload.

---

## 2. Social Interactions

TraceNet supports **Instant** (High Fee, Real-time) and **Batch** (Low Fee, Slower) modes for social actions.

### Global Social Payload Fields
| Field | Type | Description |
| :--- | :--- | :--- |
| `wallet_id` | string | User's Wallet ID |
| `timestamp` | number | `Date.now()` |
| `instant` | boolean | `true` = Instant (Mempool), `false` = Batch (SocialPool) |

### A. Like Content
**Target:** Post OR Comment.
**Endpoint:** `POST /api/social/like`

#### Payload
```json
{
  "wallet_id": "WALLET_ID",
  "content_id": "POST_OR_COMMENT_ID",
  "timestamp": 12345678,
  "public_key": "PUB_KEY",
  "signature": "HEX_SIG",
  "instant": true
}
```

#### Signing Format
```
{wallet_id}:LIKE:{content_id}:{timestamp}
```

### B. Comment on Content
**Target:** Post.
**Endpoint:** `POST /api/social/comment`

#### Payload
```json
{
  "wallet_id": "WALLET_ID",
  "content_id": "POST_ID",
  "comment_text": "Hello World",
  "timestamp": 12345678,
  "public_key": "PUB_KEY",
  "signature": "HEX_SIG",
  "instant": true
}
```

#### Signing Format
```
{wallet_id}:COMMENT:{content_id}:{timestamp}:{comment_text}
```

### C. Reply to Comment
**Target:** A Comment (within a Post thread).
**Endpoint:** `POST /api/social/comment`

#### Payload
```json
{
  "wallet_id": "WALLET_ID",
  "content_id": "ROOT_POST_ID",          // <--- IMPORTANT: The MAIN POST ID
  "parent_comment_id": "COMMENT_ID",     // <--- The comment you are replying to
  "comment_text": "I agree",
  "timestamp": 12345678,
  "public_key": "PUB_KEY",
  "signature": "HEX_SIG",
  "instant": true
}
```

#### Signing Format
**CRITICAL:** Do NOT include `parent_comment_id` in the signature.
```
{wallet_id}:COMMENT:{content_id}:{timestamp}:{comment_text}
```

---

## 3. Financial Transactions

**Endpoint:** `POST /rpc/transfer`
**Alias:** `POST /api/transaction` (Frontend Friendly)

Used to send TraceTokens (LT). 1 LT = 100,000,000 microunits.

### Payload
```typescript
{
    "from_wallet": "SENDER_ID",
    "to_wallet": "RECEIVER_ID",
    "amount": 5000000,          // 0.05 LT (in microunits)
    "fee": 1000,                // Standard Fee
    "priority": "STANDARD",
    "sender_public_key": "PUB_KEY",
    "sender_signature": "HEX_SIG",
    "timestamp": 12345678
}
```

### Signing Format
```
{from_wallet}:{to_wallet}:{amount}:{nonce}
```
*   **Nonce:** Currently derived from timestamp or fetched from `/rpc/balance/{id}`.

---

## 4. Batch Processing

**Endpoint:** `POST /rpc/sendRawTx`
**Type:** `BATCH`

Send multiple actions in one transaction to save fees.

### Payload Structure
```json
{
  "type": "BATCH",
  "from_wallet": "SENDER_ID",
  "to_wallet": "BATCH_PROCESSOR",
  "amount": 0,
  "sender_public_key": "PUB_KEY",
  "sender_signature": "OUTER_SIG",
  "payload": {
    "transactions": [
       // Array of fully signed Inner Transactions
       { "type": "LIKE", "from_wallet": "...", "signature": "INNER_SIG", ... },
       { "type": "COMMENT", "from_wallet": "...", "signature": "INNER_SIG", ... }
    ]
  }
}
```

---

## 5. Error Handling Reference

| Error | Meaning | Solution |
| :--- | :--- | :--- |
| `Content not found` | ID does not exist. | If new post, ensure backend is updated (Mempool fix applied). |
| `Invalid signature` | Sig mismatch. | Check string format carefully. No extra spaces. |
| `Cannot POST /api/transaction` | Endpoint missing. | Update backend. Valid alias added in latest patch. |
