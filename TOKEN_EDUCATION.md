# LockTrace Token (LT) - Unit Sistem Açıklaması

## Token Bilgileri

- **Sembol**: LT (LockTrace)
- **Ondalık Hassasiyet**: 8 (Bitcoin benzeri)
- **Total Supply**: 100,000,000 LT (Sabit)

## Birim Sistemi

### En Küçük Birim (Satoshis)
Blockchain içinde tüm işlemler **en küçük birimle** (satoshi benzeri) yapılır:

```
1 LT = 100,000,000 (smallest unit)
```

### Örnek Dönüşümler

| Displayed Amount | Internal Value (smallest units) |
|------------------|--------------------------------|
| 0.00000001 LT   | 1                              |
| 0.00001 LT      | 1,000                          |
| 0.00625 LT      | 625,000                        |
| 1.00 LT         | 100,000,000                    |
| 100 LT          | 10,000,000,000                 |

## Airdrop Sistemi

### İlk Kullanıcı Bonusu
Her yeni kullanıcı **ilk cüzdan oluşturduğunda** otomatik airdrop alır:

**Airdrop Miktarı:**
- **Internal Value**: 625,000 (smallest units)
- **Displayed Value**: 0.00625 LT
- **Transaction Type**: REWARD

### Kodda Kullanım

```typescript
// ✅ DOĞRU - En küçük birim kullan
const airdropAmount = 625000; // = 0.00625 LT

// ✅ DOĞRU - Transaction oluştur
TransactionModel.create(
    'SYSTEM',      // from
    walletId,      // to  
    'REWARD',      // type
    625000,        // amount (en küçük birim)
    0,             // fee
    { type: 'initial_airdrop' }
);
```

### API Response'da Görüntüleme

API yanıtlarında kullanıcılara **okunabilir format** gösterilmeli:

```typescript
// Internal amount
const internalAmount = 625000;

// Convert to LT for display
const displayAmount = (internalAmount / 100000000).toFixed(8);
// Result: "0.00625000"

// Formatted for user
const formatted = `${displayAmount} LT`;
// Result: "0.00625000 LT"
```

## Reward Transactions

### Airdrop Flow

1. **Kullanıcı Kaydı**
   ```
   POST /api/user/create
   {
     "nickname": "alice",
     "name": "Alice"
   }
   ```

2. **Otomatik İşlemler**
   - Cüzdan oluşturulur
   - Airdrop transaction oluşturulur (625,000 units)
   - Transaction mempool'a eklenir
   - Sonraki blokta blockchain'e kaydedilir

3. **Blockchain'de Kayıt**
   ```json
   {
     "tx_id": "...",
     "type": "REWARD",
     "from_wallet": "SYSTEM",
     "to_wallet": "TRN...",
     "amount": 625000,
     "fee": 0,
     "metadata": {
       "type": "initial_airdrop",
       "user_id": "...",
       "description": "Welcome bonus for first wallet"
     }
   }
   ```

### Explorer'da Görüntüleme

Blockchain Explorer'da transaction'lar görüntülenirken:

```javascript
// Explorer'da amount'u formatla
function formatAmount(amount) {
    const lt = (amount / 100000000).toFixed(8);
    return `${lt} LT`;
}

// Örnek kullanım
const tx = {
    amount: 625000,
    type: "REWARD"
};

console.log(formatAmount(tx.amount));
// Output: "0.00625000 LT"
```

## Önemli Notlar

### ⚠️ Ortak Hatalar

❌ **YANLIŞ - Ondalık kullanımı**
```typescript
const amount = 0.00625; // ❌ Floating point hataları!
```

✅ **DOĞRU - Tam sayı kullanımı**
```typescript
const amount = 625000; // ✅ Güvenli, hassas
```

### ✅ Best Practices

1. **Dahili İşlemler**: Her zaman en küçük birim kullan
2. **Görüntüleme**: Kullanıcıya göstermeden önce formatla
3. **Validation**: Amount > 0 ve Number.isSafeInteger() kontrol et
4. **Precision**: Floating point yerine BigInt veya tam sayı kullan

## Chain Üzerinde Doğrulama

Blockchain'de herhangi bir reward transaction'ı kontrol etmek için:

```bash
# Status endpoint
curl http://localhost:3000/rpc/status

# Blockchain tümü
curl http://localhost:3000/chain

# Airdrop filtreleme (example in JS)
const chain = await fetch('/chain').then(r => r.json());
const airdrops = chain.chain
    .flatMap(block => block.transactions)
    .filter(tx => tx.type === 'REWARD' && 
                  tx.metadata?.type === 'initial_airdrop');

console.log(`Total airdrops: ${airdrops.length}`);
console.log(`Total distributed: ${airdrops.reduce((sum, tx) => sum + tx.amount, 0) / 100000000} LT`);
```

## Özet

- **625,000** = En küçük birim (internal value)  
- **0.00625 LT** = Kullanıcıya gösterilen değer  
- Her yeni kullanıcı = 1 airdrop
- Transaction type = **REWARD**
- Blockchain'de kalıcı kayıt ✅
