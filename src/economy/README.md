# Economy Module

Token economics system for TraceNet blockchain.

## Features

- **TokenConfig**: Token constants and configuration
- **TreasuryManager**: Treasury account management with income/outflow tracking
- **PriceCalculator**: Dynamic token price calculation based on market cap
- **FeeHandler**: Fee calculation and distribution for transfers and social interactions
- **EconomyAPI**: REST API endpoints for economic data

## Usage

```typescript
import { TreasuryManager } from './TreasuryManager';
import { TokenPriceCalculator } from './PriceCalculator';
import { FeeHandler } from './FeeHandler';
import { EconomyAPI } from './EconomyAPI';
import { TREASURY_ADDRESSES } from './TokenConfig';

// Initialize
const treasuryManager = new TreasuryManager(TREASURY_ADDRESSES.main);
const priceCalculator = new TokenPriceCalculator();
const feeHandler = new FeeHandler(treasuryManager);
const economyAPI = new EconomyAPI(priceCalculator, treasuryManager, feeHandler);

// Use in Express app
app.use('/economy', economyAPI.getRouter());
```

## API Endpoints

- `GET /economy/tokenPrice` - Current token price and market data
- `GET /economy/userValue/:userId` - User's token value in USD
- `GET /economy/treasury` - Treasury statistics
- `GET /economy/distribution` - Token distribution breakdown
- `GET /economy/priceHistory?period=24h` - Price history chart data
- `GET /economy/fees/:action?amount=100` - Fee breakdown for actions
