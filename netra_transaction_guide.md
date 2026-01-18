# Netra Frontend Guide: Financial Transactions & Batches

**Target Audience:** Netra Frontend Developers
**Base URL:** `https://tracenet-blockchain-136028201808.us-central1.run.app`

This guide covers **Token Transfers (LT)** and **Batch Transactions**.

---

## 1. Financial Transfer (Send LT)

**Endpoint:** `POST /rpc/transfer` (or `/api/users/transaction`)

Used to send TraceToken (LT) from one wallet to another.

### Payload Structure
```typescript
interface TransferPayload {
    from_wallet: string;      // Sender Wallet ID
    to_wallet: string;        // Receiver Wallet ID (Address)
    amount: number;           // Amount in Microunits (1 LT = 100,000,000 microunits)
    fee: number;              // Fee (Standard: 1000 microunits)
    priority: string;         // 'STANDARD', 'HIGH', 'INSTANT'
    sender_public_key: string;
    sender_signature: string;
    timestamp?: number;       // Optional, but recommended for nonce generation logic
}
```

### Signature Generation (CRITICAL)
The signature must sign the specific transaction data.
**Format:** `${from_wallet}:${to_wallet}:${amount}:${nonce}`

> **Note on Nonce:** The backend currently uses `Date.now() % 1000000` as a nonce for simplicity in some helpers, but for strict transfers, you should fetch the current `nonce` from `/api/wallet/{id}` and increment it.

**Recommended Flow:**
1.  Fetch `nonce` from `/rpc/balance/{wallet_id}` or use a timestamp-based nonce if the node allows loose ordering.
2.  Sign data.
3.  Send.

---

## 2. Batch Transactions

**Endpoint:** `POST /rpc/sendRawTx`
**Type:** `BATCH`

Used to send multiple inner transactions (e.g., multiple likes, comments, or transfers) in a single blockchain transaction to save on overhead/fees.

### Payload Structure
```typescript
interface BatchPayload {
    from_wallet: string;
    to_wallet: "BATCH_PROCESSOR"; // Fixed target
    type: "BATCH";
    amount: 0;
    fee: number;              // Calculated total fee
    nonce: number;
    timestamp: number;
    sender_public_key: string;
    sender_signature: string; // Signs the OUTER transaction
    payload: {
        transactions: InnerTransaction[]; // Array of signed inner transactions
    }
}
```

### Inner Transaction Structure
Each item in the `transactions` array must be a fully formed, **individually signed** object:
```typescript
interface InnerTransaction {
    type: "LIKE" | "COMMENT" | "TRANSFER";
    from_wallet: string;
    to_wallet: string;
    amount: number;
    nonce: number;
    timestamp: number;
    payload: any;             // Specific to the type (e.g. content_id)
    signature: string;        // Signature for THIS specific inner action
}
```

### Signature Logic
1.  **Sign Inner Txs:** Loop through the list, generate signature for each item (e.g., `wallet:LIKE:contentID...`).
2.  **Assemble Batch:** Create the outer `BatchPayload` object containing the list.
3.  **Sign Outer Tx:** Sign the outer batch shell. Format: `${from_wallet}:${to_wallet}:${amount}:${nonce}`.

---

## 3. Code Example (API Client)

```typescript
// api.ts helper
async sendTransfer(wallet, toAddress, amountLT) {
    const amountMicro = amountLT * 100_000_000;
    const fee = 1000; 
    const nonce = Date.now() % 1000000; // Simplified
    
    // Sign
    const msg = `${wallet.id}:${toAddress}:${amountMicro}:${nonce}`;
    const signature = await wallet.sign(msg);

    // Send
    // Note: Implicitly backend creates the Tx object from these params
    return api.post('/rpc/transfer', {
        from_wallet: wallet.id,
        to_wallet: toAddress,
        amount: amountMicro,
        fee: fee,
        sender_public_key: wallet.publicKey,
        sender_signature: signature,
        priority: 'STANDARD'
    });
}
```
