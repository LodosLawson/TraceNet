# Frontend Implementation Corrections (v1.1.0)

This document lists the specific technical corrections required in the **TraceNet Explorer / Frontend** codebase to ensure compatibility with the TraceNet v1.1.0 Backend.

## 1. Transaction ID Generation (CRITICAL)
**Issue:** The Transaction ID hash formula in the frontend might be missing the `valid_until` field or using incorrect concatenation.
**Correction:**
Use the exact string concatenation order before hashing:

```javascript
// JavaScript / TypeScript Implementation
const crypto = require('crypto'); // or window.crypto.subtle

function generateTxId(from, to, amount, timestamp, valid_until) {
    // 1. Concatenate fields as strings
    // valid_until is optional. If undefined/null, use empty string "".
    // If it has a value (e.g., number), convert to string.
    const validUntilStr = valid_until ? valid_until.toString() : "";
    
    const rawData = from + to + amount.toString() + timestamp.toString() + validUntilStr;
    
    // 2. SHA-256 Hash
    // Return as Hex string
    return sha256(rawData); 
}
```

## 2. End-to-End Encryption Format
**Issue:** The backend `KeyManager.decryptFromUser` expects a specific `NONCE:DATA` string format. Raw byte arrays or different delimiters will cause decryption failures.
**Correction:**
Ensure encrypted fields (like in Private Messages) are formatted as follows:

```javascript
// Using tweetnacl-js
const nonce = nacl.randomBytes(nacl.box.nonceLength);
const encrypted = nacl.box(messageBytes, nonce, recipientPub, senderPriv);

// MUST use colon ':' delimiter and Hex encoding
const payload = Buffer.from(nonce).toString('hex') + ':' + Buffer.from(encrypted).toString('hex');

// Result example: "a1b2...c3d4:e5f6...7890"
```

## 3. Key Derivation Paths
**Issue:** If the frontend uses different derivation paths, the keys will not match the backend's expectations/recovery.
**Correction:**
Verify `BIP32` paths:
*   **Identity (Signing):** Use the `ed25519` key from the first 32 bytes of the seed (standard `nacl.sign.keyPair.fromSeed`).
*   **Encryption (Messaging):** `m/44'/0'/0'/1'/0'` (Standard)
*   *Note: Ensure the encryption key is derived using the same curve (Curve25519) logic as `@scure/bip32` or compatible library.*

## 4. Transaction Fields
**Issue:** Ensure the `nonce` and `fee` are valid numbers and `type` matches the Enum exactly.
**Correction:**
*   **`nonce`**: Must be strictly greater than the account's current nonce (fetch from backend if unsure).
*   **`fee`**: Send in **atomic units** (e.g., `100` not `0.000001`).
*   **`type`**: Use exact strings: `TRANSFER`, `PRIVATE_MESSAGE`, `POST_CONTENT`.

## 5. Message Pool Submission (V2)
**Structure:**
When submitting to `/api/messaging/pool`, the payload is an `InnerTransaction`, **NOT** a full `Transaction`.
*   Do **NOT** include `tx_id`.
*   Do **NOT** include `signatures` array.
*   **DO** include `signature` (singular) signed by the sender.

```typescript
interface InnerTransaction {
    type: "PRIVATE_MESSAGE";
    from_wallet: string;
    to_wallet: string;
    amount: number; // Fee to pay
    payload: any;   // { content: "HEX_NONCE:HEX_DATA" }
    timestamp: number;
    nonce: number;
    max_wait_time: number; // e.g., 3600000 (1 hour)
    signature: string;     // Sign(JSON.stringify(fields_above))
}
```
