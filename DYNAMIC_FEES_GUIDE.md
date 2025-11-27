# TraceNet Blockchain - Dinamik Ücret Sistemi Rehberi

## 📋 Genel Bakış

TraceNet blockchain, **dinamik ücret sistemi** kullanır. Her transfer için ücret, alıcının popülerliğine (gelen transfer sayısı) ve istenen işlem önceliğine göre hesaplanır.

## 💰 Ücret Yapısı

### Temel Ücret (Alıcının Popülerliğine Göre)

Alıcının son 1 yıl içinde aldığı transfer sayısına göre:

| Gelen Transfer Sayısı | Ücret Oranı | Örnek (100 LT transfer) |
|----------------------|-------------|-------------------------|
| 0-49                 | 0.01%       | 0.01 LT                |
| 50-99                | 0.025%      | 0.025 LT               |
| 100-199              | 0.05%       | 0.05 LT                |
| 200+                 | 0.10%       | 0.10 LT                |

### Öncelik Ücreti (İşlem Hızı)

İsteğe bağlı, temel ücrete eklenir:

| Öncelik  | Ek Ücret | Açıklama                    |
|----------|----------|-----------------------------|
| STANDARD | +0%      | Normal hız                  |
| LOW      | +0.20%   | Düşük öncelik, daha ucuz    |
| MEDIUM   | +0.60%   | Orta öncelik                |
| HIGH     | +1%      | Yüksek öncelik, en hızlı    |

### Toplam Ücret Hesaplama

```
Toplam Ücret = (Temel Ücret + Öncelik Ücreti) × Transfer Miktarı
```

**Örnek:**
- Alıcı 150 transfer almış (Tier 2: 0.05%)
- Öncelik: MEDIUM (+0.60%)
- Transfer: 1000 LT

```
Toplam Ücret = (0.05% + 0.60%) × 1000 LT = 0.65% × 1000 = 6.5 LT
```

## 🔧 Kullanım

### Option 1: TraceNet SDK (Önerilen)

```typescript
import { TraceNetSDK } from './sdk/TraceNetSDK';

// SDK'yı başlat
const sdk = new TraceNetSDK('http://localhost:3000', wallet);

// Transfer gönder (ücret otomatik hesaplanır)
const result = await sdk.transfer(
    'TRN4a3b2c1...',      // Alıcı adresi
    100 * 100000000,      // 100 LT
    { priority: 'MEDIUM' } // Öncelik
);

console.log('TX ID:', result.tx_id);
```

### Option 2: Manuel API Kullanımı

#### Adım 1: Ücreti Hesapla

```javascript
const response = await fetch('http://localhost:3000/rpc/calculateTransferFee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        recipient_address: 'TRN4a3b2c1...',
        amount: 100 * 100000000,  // 100 LT
        priority: 'STANDARD'
    })
});

const feeData = await response.json();
console.log('Gerekli Ücret:', feeData.total_fee_readable);
console.log('Alıcı Tier:', feeData.base_tier);
```

**Response Örneği:**
```json
{
  "recipient_address": "TRN4a3b2c1...",
  "amount": 10000000000,
  "priority": "MEDIUM",
  "recipient_incoming_transfers": 75,
  "base_tier": "TIER_1",
  "base_rate": 0.00025,
  "priority_rate": 0.006,
  "total_fee": 65000000,
  "total_fee_readable": "0.65 LT"
}
```

#### Adım 2: Transfer İşlemini Oluştur

```javascript
import { TransactionModel, TransactionType } from './blockchain/models/Transaction';
import { KeyManager } from './blockchain/crypto/KeyManager';

// İşlem oluştur
const tx = TransactionModel.create(
    fromAddress,
    toAddress,
    TransactionType.TRANSFER,
    100 * 100000000,      // Miktar
    feeData.total_fee,    // Hesaplanan ücret
    { priority: 'MEDIUM' } // Öncelik bilgisi
);

// İmzala
tx.sender_public_key = wallet.publicKey;
tx.sender_signature = KeyManager.sign(
    tx.getSignableData(),
    wallet.privateKey
);

// Gönder
const result = await fetch('http://localhost:3000/rpc/sendRawTx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
});
```

## ⚠️ Önemli Notlar

### 1. Sabit Ücret Artık Yok

❌ **YANLIŞ (Eski Yöntem):**
```typescript
const tx = TransactionModel.create(
    from, to, TransactionType.TRANSFER,
    100 * 100000000,
    10000,  // ❌ Sabit ücret - REDDEDİLİR!
    {}
);
```

✅ **DOĞRU (Yeni Yöntem):**
```typescript
// Önce ücreti hesapla
const fee = await sdk.calculateTransferFee(to, amount, 'STANDARD');

// Sonra transfer oluştur
const tx = TransactionModel.create(
    from, to, TransactionType.TRANSFER,
    amount,
    fee,  // ✅ Dinamik ücret
    { priority: 'STANDARD' }
);
```

### 2. Yetersiz Ücret Hatası

Eğer yeterli ücret ödemezseniz:

```
Error: "Insufficient fee. Required: 500000, Provided: 10000"
```

**Çözüm:** Her zaman `/rpc/calculateTransferFee` endpoint'ini kullanın veya TraceNet SDK kullanın.

### 3. Yıllık Sıfırlama

- Her alıcının `incomingTransferCount` değeri yılda bir sıfırlanır
- `lastYearReset` timestamp'i ile takip edilir
- Otomatik olarak blockchain tarafından yönetilir

## 📊 Gerçek Dünya Örnekleri

### Örnek 1: Yeni Kullanıcıya Transfer

```typescript
// Alıcı: Hiç transfer almamış (0 transfer)
// Miktar: 50 LT
// Öncelik: STANDARD

Temel Ücret: 0.01% (Tier 0)
Öncelik: +0%
Toplam: 0.01% × 50 = 0.005 LT
```

### Örnek 2: Popüler Kullanıcıya Transfer

```typescript
// Alıcı: 250 transfer almış (Tier 3)
// Miktar: 1000 LT
// Öncelik: HIGH

Temel Ücret: 0.10% (Tier 3)
Öncelik: +1% (HIGH)
Toplam: 1.10% × 1000 = 11 LT
```

### Örnek 3: Orta Kullanıcıya Hızlı Transfer

```typescript
// Alıcı: 85 transfer almış (Tier 1)
// Miktar: 200 LT
// Öncelik: MEDIUM

Temel Ücret: 0.025% (Tier 1)
Öncelik: +0.60% (MEDIUM)
Toplam: 0.625% × 200 = 1.25 LT
```

## 🛠️ Troubleshooting

### "Insufficient fee" Hatası

**Sebep:** Hesaplanan ücretin altında ücret verdiniz.

**Çözüm:**
```typescript
// TraceNet SDK kullanın (otomatik hesaplar)
const sdk = new TraceNetSDK(apiUrl, wallet);
await sdk.transfer(recipient, amount, { priority: 'STANDARD' });
```

### Ücret Çok Yüksek

**Sebep:** Alıcı çok popüler (Tier 3) ve/veya HIGH priority seçtiniz.

**Çözüm:**
- Önceliği düşürün (STANDARD veya LOW)
- Daha az popüler bir cüzdana gönderin
- Daha küçük miktarlarda gönderin

## 📝 Best Practices

1. ✅ **Her Zaman SDK Kullanın**
   ```typescript
   const sdk = new TraceNetSDK(url, wallet);
   await sdk.transfer(to, amount, { priority: 'STANDARD' });
   ```

2. ✅ **Önce Ücreti Gösterin**
   ```typescript
   const fee = await sdk.calculateTransferFee(to, amount, 'MEDIUM');
   console.log(`Bu transfer ${fee / 100000000} LT ücret gerektirir.`);
   // Kullanıcı onayından sonra transfer yap
   ```

3. ✅ **Uygun Önceliği Seçin**
   - Acil değilse: `STANDARD`
   - Ücret önemliyse: `LOW`
   - Hızlı olmalıysa: `MEDIUM` veya `HIGH`

4. ❌ **Sabit Ücret Kullanmayın**
   ```typescript
   // ❌ YANLIŞ
   const tx = create(..., hardcodedFee, {});
   
   // ✅ DOĞRU
   const fee = await calculateFee(...);
   const tx = create(..., fee, {});
   ```

## 🔗 İlgili Kaynaklar

- [TraceNet SDK Dokümantasyonu](./sdk/TraceNetSDK.ts)
- [API Examples](../public/examples.html)
- [Token Configuration](./economy/TokenConfig.ts)

## 💡 Özet

- ✅ Dinamik ücretler alıcının popülerliğine göre belirlenir
- ✅ 4 temel tier: 0.01%, 0.025%, 0.05%, 0.10%
- ✅ 4 öncelik seviyesi: STANDARD, LOW, MEDIUM, HIGH
- ✅ TraceNet SDK otomatik hesaplar
- ✅ `/rpc/calculateTransferFee` endpoint'i manuel hesaplama için
- ❌ Sabit ücretler artık desteklenmiyor
