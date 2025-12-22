# TraceNet v1.1.0 API Endpoints

This document lists all available API endpoints for the TraceNet Blockchain node.

## Base URL
Default: `http://localhost:3000`

## Core RPC / Blockchain
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Node health check |
| `GET` | `/chain` | Fetch the full blockchain |
| `GET` | `/rpc/status` | Node statistics (height, mempool, peers) |
| `GET` | `/rpc/block/:indexOrHash` | Get block by Height or Hash |
| `GET` | `/rpc/transaction/:txId` | Get transaction by ID |
| `GET` | `/rpc/balance/:walletId` | Get wallet balance (in smallest unit) |
| `GET` | `/rpc/accounts` | List all accounts on chain |
| `POST` | `/rpc/sendRawTx` | Submit a raw signed transaction |
| `POST` | `/rpc/mine` | Trigger manual block production (Dev/Test) |

## Wallet & Transactions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/wallet/create` | Create a new wallet |
| `GET` | `/api/wallet/list/:userId` | List wallets for a user |
| `GET` | `/api/wallet/:walletId` | Get wallet details |
| `POST` | `/api/wallet/sign` | Sign arbitrary data |
| `POST` | `/rpc/transfer` | Send tokens (convenience wrapper) |
| `POST` | `/rpc/calculateTransferFee` | Calculate dynamic fee for transfer |
| `POST` | `/api/users/transaction` | Alias for `/rpc/transfer` |

## User & Identity
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/user/create` | Register a new user profile |
| `GET` | `/api/user/:userId` | Get user profile by ID |
| `GET` | `/api/user/nickname/:nickname` | Get user by nickname |
| `GET` | `/api/user/check-nickname/:nickname` | Check nickname availability |
| `GET` | `/api/user/search` | Search users by query |
| `GET` | `/api/user/:userId/qr-code` | Generate QR code for user |

## Messaging (V2)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/messaging/pool` | **[NEW]** Submit signed message to Message Pool |
| `GET` | `/api/validator/messages` | **[NEW]** Fetch prioritized messages (Validators only) |
| `POST` | `/api/messaging/send` | Send a standard private message |
| `GET` | `/api/messaging/inbox/:walletId` | Get user inbox |
| `POST` | `/api/messaging/decrypt` | Decrypt a private message |
| `POST` | `/api/user/privacy` | Update messaging privacy settings |
| `POST` | `/api/user/rotate-key` | Rotate encryption key |
| `GET` | `/api/user/encryption-key/:identifier`| Get public encryption key for a user |

## Social Graph
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/content/create` | Create a post |
| `GET` | `/api/content/feed` | Get global content feed |
| `GET` | `/api/content/:contentId` | Get specific post |
| `GET` | `/api/content/user/:walletId` | Get user's posts |
| `POST` | `/api/social/like` | Like a post |
| `POST` | `/api/social/comment` | Comment on a post |
| `POST` | `/api/social/follow` | Follow a user |
| `POST` | `/api/social/unfollow` | Unfollow a user |
| `GET` | `/api/social/likes/:contentId` | Get likes for a post |
| `GET` | `/api/social/comments/:contentId` | Get comments for a post |
| `GET` | `/api/social/followers/:walletId` | Get user followers |
| `GET` | `/api/social/following/:walletId` | Get user following |

## Validators
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/validator/register` | Register as a validator |
| `POST` | `/api/validator/heartbeat` | Send heartbeat signal |
| `GET` | `/api/validator/list` | List all validators |
| `POST` | `/api/validator/:validatorId/wallet` | Set reward wallet for validator |
| `GET` | `/api/validator/:validatorId/wallet` | Get reward wallet |

## Economy (Base path: `/economy`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/economy/tokenPrice` | Current token price & market data |
| `GET` | `/economy/userValue/:userId` | Get portfolio value for a user |
| `GET` | `/economy/treasury` | Get treasury statistics |
| `GET` | `/economy/distribution` | Token distribution stats |
| `GET` | `/economy/priceHistory` | Price history (24h, 7d, 30d) |
| `GET` | `/economy/fees/:action` | Fee breakdown for actions (transfer, like, etc.) |
