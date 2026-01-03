# TraceNet Unit System (Integer-Based)

## Overview

TraceNet blockchain uses **integer units** internally, similar to Ethereum's Wei system. The frontend converts these to user-friendly decimal values.

## Conversion

```
1 TNN = 100,000,000 units (10^8)
```

### Examples:

| TNN (Frontend) | Units (Blockchain) | Use Case |
|----------------|---------------------|----------|
| 0.00625 TNN | 625,000 | Wallet creation (ONLY initial reward) |
| 0.00001 TNN | 1,000 | Like fee |
| 0.00002 TNN | 2,000 | Comment fee |
| 0.0000001 TNN | 10 | Standard message |
| 0.00000001 TNN | 1 | Low priority message |

## Updated Fee Structure (in Units)

### Sosyal İşlemler
```typescript
MIN_LIKE_FEE = 1,000 units        // 0.00001 TNN
MIN_COMMENT_FEE = 2,000 units     // 0.00002 TNN
MIN_FOLLOW_FEE = 1,000 units      // 0.00001 TNN
```

### Mesajlaşma
```typescript
MESSAGE_FAST = 1,000 units        // 0.00001 TNN (instant)
MESSAGE_STANDARD = 10 units       // 0.0000001 TNN (10 min)
MESSAGE_LOW = 1 unit              // 0.00000001 TNN (1 hour)
```

### İlk Cüzdan Bonusu (TEK ÖDÜL)
```typescript
WALLET_CREATION_REWARD = 625,000  // 0.00625 TNN (wallet açılışında)
```

### Coin Kazanma Yöntemleri

Kullanıcılar **sadece** şu şekilde coin kazanır:

1. **Postuna beğeni geldiğinde:**
   - Beğenen kişi: 1,000 units (0.00001 TNN) öder
   - İçerik sahibi alır: %50 = 500 units
   - Node sahibi alır: %25 = 250 units
   - Hazine alır: %25 = 250 units

2. **Postuna yorum geldiğinde:**
   - Yorum yapan: 2,000 units (0.00002 TNN) öder
   - İçerik sahibi alır: %50 = 1,000 units
   - Node sahibi alır: %25 = 500 units
   - Hazine alır: %25 = 500 units

3. **Yorumuna beğeni geldiğinde:**
   - Beğenen kişi: 1,000 units öder
   - Yorum sahibi alır: %50 = 500 units
   - Node + Hazine: Kalan %50

> **Not:** İlk kayıt bonusu, profil bonusu, takipçi bonusu gibi ekstra ödüller **YOK**. Sadece wallet açılışında 625,000 units verilir.

## Frontend Implementation

### Display (Units → TNN)
```typescript
import { unitsToTNN, formatTNN } from '@/utils/TokenUnits';

// Display balance
const balance = 625000; // units from blockchain
console.log(formatTNN(balance)); // "0.00625 TNN"

// Display fee
const fee = 1000;
console.log(`Fee: ${unitsToTNN(fee)} TNN`); // "Fee: 0.00001 TNN"
```

### Input (TNN → Units)
```typescript
import { tnnToUnits, parseTNN } from '@/utils/TokenUnits';

// User enters "0.00625 TNN"
const userInput = "0.00625";
const units = parseTNN(userInput); // 625000
```

## Backend Changes Required

### 1. Update Blockchain.ts
```typescript
import { FEES } from '../utils/TokenUnits';

// Replace decimal fees with unit-based
const MIN_LIKE_FEE = FEES.MIN_LIKE_FEE; // 1000 instead of 0.00001
```

### 2. Update Transaction amounts
All `amount` and `fee` fields should be integers (units), not floats.

### 3. Update API Responses
Frontend will handle conversion, backend returns raw units.

## Benefits

✅ **Precision:** No floating-point errors  
✅ **Performance:** Integer arithmetic is faster  
✅ **Compatibility:** Standard blockchain pattern (BTC, ETH)  
✅ **Security:** Prevents precision-based exploits  

## Migration Note

**Current System:** Uses small decimals (0.00001)  
**New System:** Uses large integers (1000)  

Frontend will need to import `TokenUnits` helper to display correctly.

---

*This change requires deployment coordination between backend and frontend.*
