# 💬 Mesajlaşma API Dokümantasyonu

TraceNet blockchain'de kullanıcılar arasında ücretli mesaj gönderimi.

---

## 📨 Mesaj Gönderme

Blockchain üzerinden başka bir kullanıcıya mesaj göndermek için `MESSAGE_PAYMENT` türünde transaction oluşturulur.

### Adım 1: Mesaj Transaction Oluşturma

```javascript
const crypto = require('crypto');

async function sendMessage(fromWallet, toWallet, messageContent, messageFee) {
  // Mesaj ücreti (LT cinsinden)
  const messageFeeInSmallest = messageFee * 100000000;
  const txFee = 0.01 * 100000000; // Transaction fee
  
  const timestamp = Date.now();
  
  // TX ID oluştur
  const txData = `${fromWallet}${toWallet}${messageFeeInSmallest}${timestamp}`;
  const txId = crypto.createHash('sha256').update(txData).digest('hex');
  
  // Mesaj transaction'ı
  const transaction = {
    tx_id: txId,
    from_wallet: fromWallet,
    to_wallet: toWallet,
    type: 'MESSAGE_PAYMENT',
    amount: messageFeeInSmallest,
    fee: txFee,
    payload: {
      message: messageContent,
      message_type: 'text', // text, image, file
      timestamp: timestamp,
      encrypted: false // Şifreleme durumu
    },
    timestamp: timestamp,
    signatures: []
  };
  
  return transaction;
}
```

### Adım 2: Mesaj Gönderme

```javascript
async function sendMessageToUser(fromWallet, toWallet, message, fee = 0.1) {
  const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';
  
  try {
    // 1. Bakiye kontrolü
    const balanceResponse = await fetch(`${API_URL}/rpc/balance/${fromWallet}`);
    const balanceData = await balanceResponse.json();
    const balance = balanceData.balance / 100000000;
    
    const totalCost = fee + 0.01; // Mesaj ücreti + TX fee
    
    if (balance < totalCost) {
      throw new Error(`Yetersiz bakiye! Gerekli: ${totalCost} LT, Mevcut: ${balance} LT`);
    }
    
    // 2. Transaction oluştur
    const transaction = await sendMessage(fromWallet, toWallet, message, fee);
    
    // 3. Gönder
    const response = await fetch(`${API_URL}/rpc/sendRawTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Mesaj gönderildi!');
      console.log('TX ID:', result.tx_id);
      console.log('Mesaj ücreti:', fee, 'LT');
      
      // 4. Onay bekle
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const txStatus = await fetch(`${API_URL}/rpc/transaction/${result.tx_id}`);
      const tx = await txStatus.json();
      
      if (tx.status === 'confirmed') {
        console.log('🎉 Mesaj blockchain\'e eklendi!');
        console.log('Blok:', tx.block_index);
      }
      
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Mesaj gönderilemedi:', error.message);
    throw error;
  }
}

// Kullanım
await sendMessageToUser(
  'LT_user1_001',
  'LT_user2_002',
  'Merhaba! TraceNet üzerinden ilk mesajım.',
  0.1 // 0.1 LT mesaj ücreti
);
```

---

## 💰 Mesaj Ücret Hesaplama

```javascript
// Dinamik mesaj ücreti hesaplama
async function calculateMessageFee(messageLength, messageType = 'text') {
  const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';
  
  // Economy API'den fee bilgisi al
  const response = await fetch(`${API_URL}/economy/fees/message`);
  const feeData = await response.json();
  
  if (feeData.success) {
    const baseFee = feeData.data.baseFee / 100000000; // LT cinsine çevir
    
    // Mesaj tipine göre ek ücret
    let multiplier = 1;
    if (messageType === 'image') multiplier = 5;
    if (messageType === 'file') multiplier = 10;
    
    // Uzunluğa göre ek ücret (her 100 karakter için)
    const lengthFee = Math.ceil(messageLength / 100) * 0.01;
    
    const totalFee = (baseFee * multiplier) + lengthFee;
    
    console.log('Mesaj ücreti:', totalFee, 'LT');
    return totalFee;
  }
  
  // Default ücret
  return 0.1;
}

// Kullanım
const message = "Uzun bir mesaj içeriği...";
const fee = await calculateMessageFee(message.length, 'text');
```

---

## 📬 Mesaj Alma (Gelen Mesajları Okuma)

```javascript
// Bir wallet'a gelen mesajları getir
async function getIncomingMessages(walletId) {
  const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';
  
  try {
    // Blockchain'i getir
    const chainResponse = await fetch(`${API_URL}/chain`);
    const chainData = await chainResponse.json();
    
    const messages = [];
    
    // Tüm bloklardaki MESSAGE_PAYMENT türündeki TX'leri filtrele
    for (const block of chainData.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'MESSAGE_PAYMENT' && tx.to_wallet === walletId) {
          messages.push({
            from: tx.from_wallet,
            to: tx.to_wallet,
            message: tx.payload.message,
            amount: tx.amount / 100000000,
            timestamp: new Date(tx.timestamp).toLocaleString(),
            block: block.index,
            tx_id: tx.tx_id
          });
        }
      }
    }
    
    // En yeniden eskiye sırala
    messages.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`📨 ${messages.length} mesaj bulundu`);
    return messages;
  } catch (error) {
    console.error('Mesajlar alınamadı:', error);
    return [];
  }
}

// Kullanım
const messages = await getIncomingMessages('LT_user2_002');
messages.forEach(msg => {
  console.log(`From: ${msg.from}`);
  console.log(`Message: ${msg.message}`);
  console.log(`Fee paid: ${msg.amount} LT`);
  console.log(`Time: ${msg.timestamp}`);
  console.log('---');
});
```

---

## 📊 Tam Örnek: Mesajlaşma Sistemi

```javascript
class MessagingSystem {
  constructor(apiUrl = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app') {
    this.apiUrl = apiUrl;
  }
  
  // Mesaj gönder
  async send(fromWallet, toWallet, message, fee = 0.1) {
    const crypto = require('crypto');
    
    const messageFeeInSmallest = fee * 100000000;
    const txFee = 0.01 * 100000000;
    const timestamp = Date.now();
    
    const txData = `${fromWallet}${toWallet}${messageFeeInSmallest}${timestamp}`;
    const txId = crypto.createHash('sha256').update(txData).digest('hex');
    
    const transaction = {
      tx_id: txId,
      from_wallet: fromWallet,
      to_wallet: toWallet,
      type: 'MESSAGE_PAYMENT',
      amount: messageFeeInSmallest,
fee: txFee,
      payload: { message, timestamp },
      timestamp,
      signatures: []
    };
    
    const response = await fetch(`${this.apiUrl}/rpc/sendRawTx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    
    return await response.json();
  }
  
  // Gelen mesajları getir
  async getInbox(walletId) {
    const chainResponse = await fetch(`${this.apiUrl}/chain`);
    const chainData = await chainResponse.json();
    
    const messages = [];
    
    for (const block of chainData.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'MESSAGE_PAYMENT' && tx.to_wallet === walletId) {
          messages.push({
            from: tx.from_wallet,
            message: tx.payload.message,
            fee: tx.amount / 100000000,
            time: new Date(tx.timestamp),
            tx_id: tx.tx_id
          });
        }
      }
    }
    
    return messages.sort((a, b) => b.time - a.time);
  }
  
  // Giden mesajları getir
  async getSent(walletId) {
    const chainResponse = await fetch(`${this.apiUrl}/chain`);
    const chainData = await chainResponse.json();
    
    const messages = [];
    
    for (const block of chainData.chain) {
      for (const tx of block.transactions) {
        if (tx.type === 'MESSAGE_PAYMENT' && tx.from_wallet === walletId) {
          messages.push({
            to: tx.to_wallet,
            message: tx.payload.message,
            fee: tx.amount / 100000000,
            time: new Date(tx.timestamp),
            tx_id: tx.tx_id
          });
        }
      }
    }
    
    return messages.sort((a, b) => b.time - a.time);
  }
}

// Kullanım
const messaging = new MessagingSystem();

// Mesaj gönder
await messaging.send(
  'LT_user1_001',
  'LT_user2_002',
  'Merhaba! Nasılsın?',
  0.1
);

// Gelen mesajları kontrol et
const inbox = await messaging.getInbox('LT_user2_002');
console.log('Gelen Mesajlar:', inbox);

// Giden mesajları kontrol et
const sent = await messaging.getSent('LT_user1_001');
console.log('Giden Mesajlar:', sent);
```

---

## 💡 Best Practices

### Güvenlik
- ✅ Mesajları client-side şifreleyin (end-to-end encryption)
- ✅ Private key'i asla sunucuya göndermeyin
- ✅ Hassas bilgileri payload'da saklamayın

### Ücretlendirme
- 📊 Minimum mesaj ücreti: 0.01 LT
- 📊 Önerilen: 0.1 LT (spam önleme için)
- 📊 Dosya/resim: Daha yüksek ücret

### Performans
- ⚡ Toplu mesaj gönderimi için batch transaction kullanın
- ⚡ Mesaj geçmişini cache'leyin
- ⚡ Pagination uygulayın (çok mesaj varsa)

---

## 🔗 İlgili Dokümantasyon

- [Ana Transaction Rehberi](./TRANSACTION_GUIDE.md)
- [Wallet API](./README.md#-api-endpoints)
- [Economy API](./README.md#-economy-api)

---

**Son Güncelleme:** 2025-11-25  
**API Versiyonu:** 1.0
