# TraceNet Blockchain ⛓️

**Delegated Proof of Activity (DPoA) blockchain with social features and LT token economy.**

[![Cloud Build](https://img.shields.io/badge/Cloud%20Build-Automated-blue)](https://console.cloud.google.com/cloud-build/builds?project=blockchain-message-economy)
[![Cloud Run](https://img.shields.io/badge/Cloud%20Run-Live-green)](https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
copy .env.example .env

# Build TypeScript
npm run build

# Start node
npm start
```

**Access:** http://localhost:3000

### Deploy to Production

```bash
# Option 1: Use deploy script
deploy.bat

# Option 2: Manual commands
npm run build
git add .
git commit -m "Your message"
git push origin main
```

✅ **Auto-deploys to Cloud Run in ~3 minutes!**

**Live Service:** https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app

---

## 📦 Features

### Blockchain Core
- ✅ **DPoA Consensus** - Delegated Proof of Activity
- ✅ **Fast Finality** - 5-second block time
- ✅ **High Throughput** - 1000 TPS capacity
- ✅ **Auto Backups** - Every 100 blocks

### Token Economy
- ✅ **LT Token** - Native currency
- ✅ **Dynamic Pricing** - Market-driven value
- ✅ **Staking Rewards** - Validator incentives
- ✅ **Treasury Management** - Automated fund distribution

### Infrastructure
- ✅ **Multi-Wallet System** - HD wallet support
- ✅ **Supabase Integration** - Off-chain data storage
- ✅ **WebSocket API** - Real-time updates
- ✅ **RESTful RPC** - Standard JSON-RPC interface

### DevOps
- ✅ **CI/CD Pipeline** - GitHub → Cloud Build → Cloud Run
- ✅ **Auto-Scaling** - 1-10 instances
- ✅ **Health Monitoring** - Built-in health checks
- ✅ **Secret Management** - Google Secret Manager

---

## 🌐 API Endpoints

### Health & Status
```bash
GET /health              # Health check
GET /rpc/status          # Blockchain status
```

### Blockchain
```bash
GET  /rpc/block/:index   # Get block by index
GET  /rpc/transaction/:txId  # Get transaction
POST /rpc/sendRawTx      # Submit transaction
```

### Wallet
```bash
POST /api/wallet/create           # Create new wallet
GET  /api/wallet/list/:userId     # List user wallets
GET  /api/wallet/:walletId        # Wallet details
```

### Economy
```bash
GET /economy/tokenPrice      # Token price & market data
GET /economy/treasury        # Treasury statistics
GET /economy/distribution    # Token distribution
```

**Full API Documentation:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Complete deployment guide |
| [GCP-DEPLOYMENT.md](GCP-DEPLOYMENT.md) | Google Cloud Platform setup |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/tokenomics-system.md](docs/tokenomics-system.md) | Token economics |
| [supabase/SETUP-GUIDE.md](supabase/SETUP-GUIDE.md) | Supabase configuration |

---

## 🔧 Development

### Build

```bash
npm run build        # Compile TypeScript
npm run build:watch  # Watch mode
```

### Testing

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode
```

### Linting

```bash
npm run lint        # Check code style
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend/Client                    │
│              (Static HTML + JavaScript)              │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP/WebSocket
┌───────────────────▼─────────────────────────────────┐
│                   RPC Server                         │
│           (Express + WebSocket Server)               │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼─────┐ ┌──▼────┐ ┌────▼────────┐
│  Blockchain │ │Mempool│ │   Wallet    │
│    Core     │ │       │ │   Service   │
└───────┬─────┘ └───────┘ └─────────────┘
        │
┌───────▼─────────────────────────────────────────────┐
│             Consensus Layer (DPoA)                   │
│  Validator Pool │ Block Producer │ Rewards           │
└──────────────────────────────────────────────────────┘
```

---

## 🔗 Links

- **Live Service:** https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app
- **GitHub:** https://github.com/LodosLawson/TraceNet
- **Cloud Build:** https://console.cloud.google.com/cloud-build/builds?project=blockchain-message-economy
- **Cloud Run:** https://console.cloud.google.com/run?project=blockchain-message-economy
- **Supabase:** https://ojvozdzludrslnqcxydf.supabase.co

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

**Last Updated:** 2025-11-25 - Simplified Deployment Pipeline ✅

