# TraceNet Blockchain

A production-ready blockchain ecosystem with **Delegated Proof of Activity (DPoA)** consensus mechanism.

## Features

- 🔗 **Custom Blockchain** with Merkle tree verification
- 🔐 **ED25519 Cryptography** with BIP39 mnemonic wallets
- 👥 **Multi-Wallet System** per user with automatic airdrops
- ⚡ **DPoA Consensus** with online validator selection
- 🌐 **Full RPC API** (REST + WebSocket)
- 💰 **Reward System** for validators and on-chain actions
- 📊 **Real-time Events** via WebSocket
- 🔒 **Enterprise Security** (JWT, mTLS ready)

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Running the Node

```bash
# Development mode with auto-reload
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

## API Endpoints

### RPC Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rpc/sendRawTx` | Submit signed transaction |
| GET | `/rpc/status` | Node status |
| GET | `/rpc/block/:indexOrHash` | Get block details |
| GET | `/rpc/transaction/:txId` | Get transaction details |
| GET | `/rpc/balance/:walletId` | Get wallet balance |

### Wallet API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wallet/create` | Create new wallet |
| GET | `/api/wallet/list/:userId` | List user wallets |
| GET | `/api/wallet/:walletId` | Get wallet details |
| POST | `/api/wallet/sign` | Sign transaction |

### Validator API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/validator/register` | Register as validator |
| POST | `/api/validator/heartbeat` | Update validator status |
| GET | `/api/validator/list` | List validators |

## WebSocket Events

Subscribe to real-time events:

```javascript
const socket = io('ws://localhost:3000');

// Subscribe to events
socket.emit('subscribe', { events: ['newBlock', 'txConfirmed'] });

// Listen for new blocks
socket.on('newBlock', (data) => {
  console.log('New block:', data.block);
});

// Listen for transaction confirmations
socket.on('txConfirmed', (data) => {
  console.log('Transaction confirmed:', data.tx_id);
});
```

Available events:
- `newBlock` - New block added to chain
- `txConfirmed` - Transaction confirmed in block
- `signRequest` - Validator signature request
- `rewardPaid` - Reward distributed to validator

## Configuration

Key environment variables:

```env
# Node Configuration
PORT=3000
NODE_ID=node-1

# Blockchain Configuration
BLOCK_TIME_MS=5000
MAX_TRANSACTIONS_PER_BLOCK=1000

# Consensus (DPoA)
VALIDATOR_THRESHOLD_PERCENT=66
VALIDATORS_PER_TRANSACTION=7

# Token Configuration
TOKEN_NAME=TraceNet
TOKEN_SYMBOL=TRN
TOKEN_DECIMALS=8
INITIAL_AIRDROP_AMOUNT=10000000000

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_byte_encryption_key
```

## Architecture

```
┌─────────────────┐
│   RPC Server    │ ← REST API
├─────────────────┤
│ WebSocket Server│ ← Real-time events
├─────────────────┤
│   Blockchain    │ ← State management
│   Core          │
├─────────────────┤
│ DPoA Consensus  │ ← Validator coordination
│   Engine        │
├─────────────────┤
│ Wallet Service  │ ← Multi-wallet management
└─────────────────┘
```

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Load tests
npm run test:load
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
