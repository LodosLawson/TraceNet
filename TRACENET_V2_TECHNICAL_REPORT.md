# TraceNet V2 Technical Report
**Version:** 2.0.0
**Date:** December 2025
**Author:** TraceNet Core Team & LodosLawson

## 1. Executive Summary

TraceNet V2 represents a significant evolution of the TraceNet blockchain protocol, introducing a novel **Time-Weighted Fee Mechanism**, a **Batch Messaging System** for high-throughput communication, and enhanced security primitives. This report details the technical architecture, economic model, and security guarantees of the V2 release.

## 2. System Architecture

TraceNet operates as a Layer-1 blockchain with a specialized focus on decentralized communication and social interaction.

### 2.1 Core Components

- **Blockchain Core (`Blockchain.ts`)**: The central ledger manager responsible for block validation, state management, and transaction execution.
- **Consensus Engine (`ValidatorPool.ts`)**: Implements a Proof-of-Stake (PoS) mechanism where validators propose and attest to blocks.
- **Message Pool (`MessagePool.ts`)**: A new stateless memory pool introduced in V2 specifically for handling off-chain message batching.
- **RPC Server (`RPCServer.ts`)**: The gateway for external clients to interact with the network, now updated with improved security and new endpoints for the V2 protocol.

### 2.2 Data Models

#### 2.2.1 Transaction Types
V2 introduces distinct transaction types to separate financial settlements from data transmission:
- `TRANSFER`: Standard coin transfer (LT tokens).
- `SOCIAL`: Social interactions (Like, Comment, Follow).
- `MESSAGE`: Legacy single-message transaction (deprecated in favor of Batch).
- **`BATCH` (New)**: A container transaction that includes multiple inner messages.
- **`CONVERSATION_BATCH` (New)**: A specialized batch for thread-specific message groups.

#### 2.2.2 The Batch Structure
To improve scalability, individual messages are no longer direct on-chain transactions. Instead, they are aggregated into `InnerTransaction` objects:

```typescript
interface InnerTransaction {
    id: string;              // UUID
    type: string;            // 'MESSAGE'
    from_wallet: string;     // Sender Address
    to_wallet: string;       // Recipient Address(es)
    payload: any;            // Encrypted Content
    timestamp: number;
    signature: string;       // Sender's Signature of the inner content
    sender_public_key: string; // Key for stateless verification
}
```

Validators collect these valid `InnerTransaction`s from the `MessagePool` and commit them to the chain in a single `BATCH` transaction.

## 3. Economic Model: Time-Weighted Fees

One of the most innovative features of TraceNet V2 is the dynamic fee market, designed to balance network load and user urgency.

### 3.1 Fee Calculation Formula
The transfer fee is calculated as:

$$ Fee = (Amount \times \text{BaseRate}) + \text{PrioritySurcharge} $$

### 3.2 Base Rate Tiers
The `BaseRate` is dynamic, determined by the recipient's **incoming transaction volume** over the last year. This mechanism ensures that high-volume accounts (commercial entities, popular creators) contribute more to network security.

| Tier | Annual Incoming Tx Count | Base Rate |
| :--- | :--- | :--- |
| **Tier 0** | 0 - 49 | 0.01% |
| **Tier 1** | 50 - 99 | 0.025% |
| **Tier 2** | 100 - 199 | 0.05% |
| **Tier 3** | 200+ | 0.10% |

### 3.3 Priority Surcharges
Users can opt for faster processing by paying specific priority rates:

| Priority | Surcharge (Additive) |
| :--- | :--- |
| **STANDARD** | +0% |
| **LOW** | +0.20% |
| **MEDIUM** | +0.60% |
| **HIGH** | +1.00% |

### 3.4 Messaging Fee Schedule (Time-Locks)
Unlike coin transfers, data messages follows a strict "Time-Weighted" priority system to prevent spam and network bloat.

| Tier | Fee Requirement (LT) | Time-Lock (System Wait) |
| :--- | :--- | :--- |
| **🚀 Fast Lane** | `>= 0.00001` | **0 Seconds** (Instant Mining) |
| **⏳ Normal** | `>= 0.000005` | **10 Minutes** (Batch Delay) |
| **🐢 Economy** | `< 0.000005` | **1 Hour** (Batch Delay) |

> **Note:** "Saving Money = Spending Time". The network enforces these delays protocol-level. No validator can mine a "Normal" message before 10 minutes have passed.


## 4. Messaging Protocol V2

### 4.1 Flow
1. **Client**: Signs an `InnerTransaction` (message) locally.
2. **Submission**: Client posts the signed object to `/api/messaging/pool`.
3. **Pooling**: The node validates the signature and stores it in the `MessagePool`.
4. **Batching**: A validator selects pending messages from the pool.
5. **Commitment**: The validator wraps them into a `BATCH` transaction and mines a block.

### 4.2 Security & Privacy
- **End-to-End Encryption**: All message payloads are encrypted using the recipient's public key (Curve25519) before entering the network.
- **Stateless Verification**: `InnerTransaction`s include the `sender_public_key`, allowing any node to verify the signature without querying the full blockchain state.
- **Replay Protection**: Each inner transaction has a unique UUID and timestamp checks.

## 5. Security Enhancements

### 5.1 Signature Verification
V2 enforcing strict signature verification on all API endpoints. The `MAX_WAIT_TIME` parameter prevents transaction withholding attacks.

### 5.2 Validator Slashing (Prepared)
The infrastructure for validator slashing has been solidified. Validators who sign invalid batches or double-sign blocks are subject to stake removal.

## 6. Migration Guide

Frontend applications must update their transaction construction logic to:
1. Include `sender_public_key` in all transaction payloads.
2. Use the new `/api/transfer/calculate-fee` endpoint to estimate fees before sending.
3. Switch from direct `MESSAGE` transactions to the `MessagePool` API for chat functionality.

---
*TraceNet Core Dev Team*
