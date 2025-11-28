# TraceNet Full API Documentation

This document provides a complete list of all available API endpoints on the TraceNet node, categorized by functionality.

## 1. RPC Endpoints (Blockchain Core)
These endpoints allow interaction with the core blockchain data and transaction submission.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/rpc/status` | Returns current blockchain status (height, tx count, chain ID). |
| **GET** | `/rpc/block/:indexOrHash` | Retrieves a block by its height (index) or hash. |
| **GET** | `/rpc/transaction/:txId` | Retrieves a specific transaction by its ID. |
| **GET** | `/rpc/balance/:walletId` | Returns the current balance of a wallet address. |
| **GET** | `/rpc/accounts` | Lists all accounts with non-zero balances or activity. |
| **POST** | `/rpc/sendRawTx` | Submits a pre-signed raw transaction to the mempool. |
| **POST** | `/rpc/calculateTransferFee` | Calculates the dynamic fee for a transfer based on recipient activity and priority. |
| **POST** | `/rpc/transfer` | Simplified endpoint to send a transfer (requires signature). |

## 2. Wallet Endpoints
Manage wallets and keys.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/wallet/create` | Creates a new wallet for a user. Returns mnemonic and keys. |
| **GET** | `/api/wallet/list/:userId` | Lists all wallets associated with a specific user ID. |
| **GET** | `/api/wallet/:walletId` | Retrieves public details of a specific wallet. |
| **POST** | `/api/wallet/sign` | Utility to sign data (server-side signing - use with caution). |

## 3. User Endpoints
Manage user profiles and identity.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/user/create` | Registers a new user profile on the blockchain. |
| **GET** | `/api/user/nickname/:nickname` | Finds a user by their unique nickname. |
| **GET** | `/api/user/:userId` | Retrieves user profile by User ID. |
| **GET** | `/api/user/search` | Searches for users by name or nickname (`?q=query`). |
| **GET** | `/api/user/check-nickname/:nickname` | Checks if a nickname is available for registration. |

## 4. Content Endpoints
Create and retrieve content (posts, media).

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/content/create` | Publishes new content to the blockchain. |
| **GET** | `/api/content/feed` | Retrieves the global content feed (paginated). |
| **GET** | `/api/content/user/:walletId` | Retrieves all content published by a specific wallet. |
| **GET** | `/api/content/:contentId` | Retrieves a specific content item by ID. |

## 5. Social Endpoints
Social interactions like following, liking, and commenting.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/social/like` | Likes a content item. |
| **POST** | `/api/social/comment` | Adds a comment to a content item. |
| **POST** | `/api/social/follow` | Follows another user/wallet. |
| **POST** | `/api/social/unfollow` | Unfollows a user. |
| **GET** | `/api/social/likes/:contentId` | Lists all likes for a specific content. |
| **GET** | `/api/social/comments/:contentId` | Lists all comments for a specific content. |
| **GET** | `/api/social/followers/:walletId` | Lists followers of a wallet. |
| **GET** | `/api/social/following/:walletId` | Lists who a wallet is following. |

## 6. Messaging Endpoints (Secure)
End-to-end encrypted messaging.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/messaging/send` | Sends an encrypted message. **Encryption must happen client-side.** |
| **GET** | `/api/messaging/inbox/:walletId` | Retrieves encrypted messages for a wallet. **Decryption must happen client-side.** |
| **POST** | `/api/messaging/decrypt` | **DEPRECATED**. Returns instructions to use client-side decryption. |

## 7. Validator Endpoints
Network validator management.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/validator/register` | Registers a new validator node. |
| **POST** | `/api/validator/heartbeat` | Sends a heartbeat signal to keep validator active status. |
| **GET** | `/api/validator/list` | Lists all active validators in the network. |
