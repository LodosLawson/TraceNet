# 📝 TraceNet Blockchain - Transaction Gönderme Rehberi

Blockchain'e transaction (işlem) göndermek için kapsamlı rehber.

---

## 📋 Transaction Yapısı

```json
{
  "tx_id": "string",           // Transaction ID (otomatik oluşturulur)
  "from_wallet": "string",     // Gönderen wallet ID
  "to_wallet": "string",       // Alıcı wallet ID  
  "type": "TRANSFER",          // İşlem türü
  "amount": 100000000,         // Miktar (8 decimal)
  "fee": 1000000,              // İşlem ücreti
  "payload": {},               // Ek veri
  "timestamp": 1234567890,     // Unix timestamp
  "signatures": []             // Validator imzaları
}
```

### Transaction Türleri
- **TRANSFER**: Standart coin transferi
- **REWARD**: Validator ödülleri (sistem)
- **POST_ACTION**: Sosyal medya paylaşımı
- **LIKE**: Beğeni işlemi
- **FOLLOW**: Takip işlemi
- **MESSAGE_PAYMENT**: Mesaj ücreti ödemesi

---

## 🔐 Adım 1: Wallet Oluşturma

Önce bir wallet oluşturmalısınız:

```javascript
const createWallet = async (userId) => {
  const response = await fetch('https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/api/wallet/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  
  const data = await response.json();
  console.log('Wallet ID:', data.wallet.wallet_id);
  console.log('Public Key:', data.wallet.public_key);
  console.log('Mnemonic:', data.mnemonic); // GÜVENLİ SAKLAYIN!
  
  return data.wallet;
};

// Kullanım
const myWallet = await createWallet('user_123');
```

> ⚠️ **ÖNEMLİ:** Mnemonic (12 kelime) ve private key'i GÜVENLİ bir yerde saklayın! Kaybederseniz wallet'a erişemezsiniz.

---

## 💸 Adım 2: Transaction Oluşturma

```javascript
const crypto = require('crypto');

// Transaction parametreleri
const fromWallet = 'LT_user123_001';
const toWallet = 'LT_user456_002';
const amount = 150 * 100000000;  // 150 LT (8 decimal)
const fee = 0.01 * 100000000;     // 0.01 LT
const timestamp = Date.now();

// Transaction ID oluşturma (SHA-256)
const txData = `${fromWallet}${toWallet}${amount}${timestamp}`;
const txId = crypto.createHash('sha256').update(txData).digest('hex');

// Transaction objesi
const transaction = {
  tx_id: txId,
  from_wallet: fromWallet,
  to_wallet: toWallet,
  type: 'TRANSFER',
  amount: amount,
  fee: fee,
  payload: { note: 'Ödeme' },
  timestamp: timestamp,
  signatures: []
};
```

---

## 📤 Adım 3: Transaction Gönderme

```javascript
const sendTransaction = async (transaction) => {
  try {
    const response = await fetch('https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/rpc/sendRawTx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ İşlem başarılı!');
      console.log('TX ID:', result.tx_id);
      console.log('Mempool\'a eklendi');
    } else {
      console.error('❌ Hata:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Bağlantı hatası:', error);
  }
};

// Kullanım
await sendTransaction(transaction);
```

---

## 🔍 Adım 4: İşlem Durumu Kontrolü

```javascript
// TX durumunu kontrol etme
const checkTransaction = async (txId) => {
  const response = await fetch(`https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/rpc/transaction/${txId}`);
  const tx = await response.json();
  
  if (tx.status === 'pending') {
    console.log('⏳ İşlem mempool\'da, onay bekleniyor...');
    console.log('Validator imzaları:', tx.signatures?.length || 0);
  } else if (tx.status === 'confirmed') {
    console.log('✅ İşlem onaylandı!');
    console.log('Blok:', tx.block_index);
    console.log('Blok Hash:', tx.block_hash);
  }
  
  return tx;
};

// Otomatik polling (her 5 saniyede bir kontrol)
const pollTransaction = (txId, maxAttempts = 12) => {
  let attempts = 0;
  
  const interval = setInterval(async () => {
    const tx = await checkTransaction(txId);
    attempts++;
    
    if (tx.status === 'confirmed' || attempts >= maxAttempts) {
      clearInterval(interval);
      if (tx.status === 'confirmed') {
        console.log('🎉 İşlem blockchain\'e eklendi!');
      } else {
        console.log('⏱️ Süre doldu');
      }
    }
  }, 5000);
};
```

---

## 📊 Tam Örnek: Coin Transfer

```javascript
// Tam transfer örneği
async function transferCoins(fromWallet, toWallet, amount) {
  const crypto = require('crypto');
  const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';
  
  try {
    // 1. Transaction verilerini hazırla
    const timestamp = Date.now();
    const fee = 0.01 * 100000000;
    const amountInSmallestUnit = amount * 100000000;
    
    const txData = `${fromWallet}${toWallet}${amountInSmallestUnit}${timestamp}`;
    const txId = crypto.createHash('sha256').update(txData).digest('hex');
    
    const transaction = {
      tx_id: txId,
      from_wallet: fromWallet,
      to_wallet: toWallet,
      type: 'TRANSFER',
      amount: amountInSmallestUnit,
      fee: fee,
      payload: { note: 'Transfer örneği' },
      timestamp: timestamp,
      signatures: []
    };
    
    // 2. Gönder
    const response = await fetch(`${API_URL}/rpc/sendRawTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${amount} LT başarıyla gönderildi!`);
      console.log(`TX ID: ${result.tx_id}`);
      
      // 3. Onay bekle
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 saniye
      
      const txStatus = await fetch(`${API_URL}/rpc/transaction/${result.tx_id}`);
      const tx = await txStatus.json();
      
      console.log('Durum:', tx.status);
      if (tx.block_index) {
        console.log('Blok:', tx.block_index);
      }
    } else {
      console.error('❌ İşlem başarısız:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Hata:', error);
    throw error;
  }
}

// Kullanım
transferCoins('LT_user1_001', 'LT_user2_002', 50);
```

---

## 💡 Önemli Notlar

### Decimal (Ondalık)
- 1 LT = 100,000,000 smallest unit (8 decimal)
- Örnek: 1.5 LT = 150,000,000 smallest unit

### İşlem Ücretleri
- **Minimum Fee:** 0.001 LT
- **Önerilen Fee:** 0.01 LT (hızlı işlem için)
- **Yüksek öncelik:** 0.1 LT

### Onay Süresi
- DPoA konsensüsü ile ~5-10 saniye
- Validator imzaları: En az 5/7 gereklidir
- Network yoğunluğuna bağlı olarak değişebilir

### Balance Kontrolü
İşlem göndermeden önce bakiyenizi kontrol edin:

```javascript
const checkBalance = async (walletId) => {
  const response = await fetch(`https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app/rpc/balance/${walletId}`);
  const data = await response.json();
  console.log('Balance:', data.balance / 100000000, 'LT');
  return data.balance;
};
```

###  Hata Kodları

| Kod | Açıklama |
|-----|---------|
| `400` | Invalid transaction struktur |
| `401` | Yetersiz bakiye |
| `404` | Wallet veya TX bulunamadı |
| `500` | Sunucu hatası |

---

## 🐍 Python Örneği

```python
import requests
import hashlib
import time

API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app'

def transfer_coins(from_wallet, to_wallet, amount):
    # Transaction hazırla
    timestamp = int(time.time() * 1000)
    fee = int(0.01 * 100000000)
    amount_smallest = int(amount * 100000000)
    
    tx_data = f"{from_wallet}{to_wallet}{amount_smallest}{timestamp}"
    tx_id = hashlib.sha256(tx_data.encode()).hexdigest()
    
    transaction = {
        'tx_id': tx_id,
        'from_wallet': from_wallet,
        'to_wallet': to_wallet,
        'type': 'TRANSFER',
        'amount': amount_smallest,
        'fee': fee,
        'payload': {},
        'timestamp': timestamp,
        'signatures': []
    }
    
    # Gönder
    response = requests.post(
        f'{API_URL}/rpc/sendRawTx',
        json=transaction
    )
    
    result = response.json()
    
    if result.get('success'):
        print(f"✅ {amount} LT gönderildi!")
        print(f"TX ID: {result['tx_id']}")
        
        # Status kontrol
        time.sleep(10)
        tx_response = requests.get(f"{API_URL}/rpc/transaction/{result['tx_id']}")
        tx = tx_response.json()
        print(f"Durum: {tx.get('status')}")
    else:
        print(f"❌ Hata: {result.get('error')}")
    
    return result

# Kullanım
transfer_coins('LT_user1_001', 'LT_user2_002', 50)
```

---

## 🔗 Faydalı Linkler

- [Ana Dokümantasyon](https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app)
- [API Endpoints](./DEPLOYMENT.md)
- [GitHub Repository](https://github.com/LodosLawson/TraceNet)
- [Cloud Build Status](https://console.cloud.google.com/cloud-build/builds?project=blockchain-message-economy)

---

## 🆘 Sık Sorulan Sorular

### Q: Private key nerede saklanmalı?
**A:** Asla sunucuda saklamayın! Client-side (tarayıcı/mobil app) güvenli storage kullanın. Production için hardware wallet veya encrypted storage önerilir.

### Q: Transaction neden pending durumda takılı kaldı?
**A:** 
- Validator sayısı yeterli mi kontrol edin
- Fee çok düşük olabilir, daha yüksek fee deneyin
- Network sorunları olabilir, birkaç dakika bekleyin

### Q: Yanlış adrese gönderim yaptım, geri alabir miyim?
**A:** Hayır, blockchain'deki işlemler geri alınamaz. Her zaman adres doğrulaması yapın!

### Q: Test amaçlı nasıl coin alabilirim?
**A:** İlk wallet oluşturduğunuzda otomatik airdrop alırsınız.

---

**Son Güncelleme:** 2025-11-25  
**API Versiyonu:** 1.0
