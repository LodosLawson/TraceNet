# 📚 TraceNet Mesajlaşma Tutorial

Adım adım blockchain üzerinde mesajlaşma kullanım kılavuzu.

## 🚀 Hızlı Başlangıç

### 1. Kullanıcı Oluştur

```javascript
const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';

const response = await fetch(`${API_URL}/api/user/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nickname: 'alice',
    name: 'Alice',
    surname: 'Smith'
  })
});

const { user, wallet, mnemonic } = await response.json();
console.log('Wallet ID:', wallet.wallet_id);
```

**⚠️ ÖNEMLİ:** Mnemonic'i güvenli bir yerde saklayın!

## 📨 Mesaj Gönderme

### Basit Mesaj

```javascript
const crypto = require('crypto');

async function sendMessage(from, to, message) {
  const timestamp = Date.now();
  const txData = `${from}${to}${timestamp}`;
  const txId = crypto.createHash('sha256').update(txData).digest('hex');
  
  const tx = {
    tx_id: `TX_${txId}`,
    from_wallet: from,
    to_wallet: to,
    type: 'MESSAGE_PAYMENT',
    amount: 10000000,  // 0.1 LT
    fee: 1000000,      // 0.01 LT
    payload: {
      message: message,
      message_type: 'text',
      timestamp: timestamp,
      encrypted: false
    },
    timestamp: timestamp,
    signatures: []
  };
  
  const response = await fetch(`${API_URL}/rpc/sendRawTx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  });
  
  return await response.json();
}

// Kullanım
await sendMessage(
  'LT_alice_001',
  'LT_bob_002',
  'Merhaba Bob!'
);
```

### Şifreli Mesaj

```javascript
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

async function sendEncryptedMessage(from, to, message, senderPrivKey, recipientPubKey) {
  // 1. Mesajı şifrele
  const messageBytes = naclUtil.decodeUTF8(message);
  const nonce = nacl.randomBytes(24);
  
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    Buffer.from(recipientPubKey, 'hex'),
    Buffer.from(senderPrivKey, 'hex')
  );
  
  // 2. Transaction oluştur
  const timestamp = Date.now();
  const txData = `${from}${to}${timestamp}`;
  const txId = crypto.createHash('sha256').update(txData).digest('hex');
  
  const tx = {
    tx_id: `TX_${txId}`,
    from_wallet: from,
    to_wallet: to,
    type: 'MESSAGE_PAYMENT',
    amount: 15000000,  // 0.15 LT (şifreli mesaj ücreti)
    fee: 1000000,
    payload: {
      encrypted_message: naclUtil.encodeBase64(encrypted),
      nonce: naclUtil.encodeBase64(nonce),
      message_type: 'encrypted',
      timestamp: timestamp,
      encrypted: true
    },
    timestamp: timestamp,
    signatures: []
  };
  
  // 3. Gönder
  const response = await fetch(`${API_URL}/rpc/sendRawTx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  });
  
  return await response.json();
}
```

## 📬 Mesaj Alma

```javascript
async function getMessages(walletId) {
  // Blockchain'i al
  const response = await fetch(`${API_URL}/chain`);
  const { chain } = await response.json();
  
  const messages = [];
  
  // Tüm mesajları filtrele
  for (const block of chain) {
    for (const tx of block.transactions) {
      if (tx.type === 'MESSAGE_PAYMENT' && tx.to_wallet === walletId) {
        messages.push({
          from: tx.from_wallet,
          message: tx.payload.message || tx.payload.encrypted_message,
          encrypted: tx.payload.encrypted,
          nonce: tx.payload.nonce,
          fee: tx.amount / 100000000,
          time: new Date(tx.timestamp),
          block: block.index,
          tx_id: tx.tx_id
        });
      }
    }
  }
  
  return messages.sort((a, b) => b.time - a.time);
}

// Kullanım
const messages = await getMessages('LT_bob_002');
messages.forEach(msg => {
  console.log(`From: ${msg.from}`);
  console.log(`Message: ${msg.message}`);
  console.log(`Time: ${msg.time.toLocaleString()}`);
  console.log('---');
});
```

## 🔓 Şifreli Mesajı Çözme

```javascript
function decryptMessage(encryptedMsg, nonce, senderPubKey, recipientPrivKey) {
  const decrypted = nacl.box.open(
    naclUtil.decodeBase64(encryptedMsg),
    naclUtil.decodeBase64(nonce),
    Buffer.from(senderPubKey, 'hex'),
    Buffer.from(recipientPrivKey, 'hex')
  );
  
  if (!decrypted) {
    throw new Error('Şifre çözülemedi');
  }
  
  return naclUtil.encodeUTF8(decrypted);
}

// Şifreli mesajları okurken
const messages = await getMessages('LT_bob_002');
messages.forEach(msg => {
  if (msg.encrypted) {
    const decrypted = decryptMessage(
      msg.message,
      msg.nonce,
      aliceEncryptionPublicKey,
      bobEncryptionPrivateKey
    );
    console.log('Çözülmüş mesaj:', decrypted);
  } else {
    console.log('Düz mesaj:', msg.message);
  }
});
```

## 💡 Best Practices

### Güvenlik
- ✅ Her zaman end-to-end encryption kullanın
- ✅ Private key'leri asla paylaşmayın
- ✅ Her mesaj için yeni nonce oluşturun
- ✅ Mnemonic'i güvenli saklayın

### Ücretlendirme
- 📊 Minimum mesaj ücreti: 0.01 LT
- 📊 Önerilen (spam önleme): 0.1 LT
- 📊 Şifreli mesajlar: +%50 ücret
- 📊 Her TX için +0.01 LT network fee

### Performans
- ⚡ Mesaj gönderme: ~10 saniye (mining süresi)
- ⚡ Mesaj okuma: Anında (blockchain query)
- ⚡ Pagination kullanın (çok mesaj varsa)

## 🎯 Tam Örnek

```javascript
const MessagingSystem = require('../examples/messaging_simple');

// Alice'den Bob'a mesaj
await MessagingSystem.sendMessage(
  'LT_alice_001',
  'LT_bob_002',
  'Merhaba Bob! Nasılsın?',
  0.1
);

// 10 saniye bekle (mining)
await new Promise(r => setTimeout(r, 10000));

// Bob'un mesajlarını oku
const messages = await MessagingSystem.getMessages('LT_bob_002');
console.log(`${messages.length} mesaj bulundu`);
```

## 🔗 Daha Fazla

- [Mesajlaşma API](./MESSAGING_API.md)
- [Çalışan Örnekler](../examples/messaging_simple.js)
- [Şifreli Mesajlaşma](../examples/messaging_encrypted.js)
- [Interactive Demo](http://localhost:3000/messaging.html)
