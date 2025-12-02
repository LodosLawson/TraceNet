# 💬 TraceNet Mesajlaşma API

Blockchain tabanlı uçtan uca şifrelenmiş mesajlaşma sistemi.

## 🌐 API Base URL

```
https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app
```

## 📨 Mesaj Gönderme

### Endpoint
```
POST /rpc/sendRawTx
```

### Basit Mesaj

```javascript
const transaction = {
  tx_id: `TX_${hash}`,
  from_wallet: 'LT_sender_001',
  to_wallet: 'LT_receiver_002',
  type: 'MESSAGE_PAYMENT',
  amount: 10000000, // 0.1 LT (mesaj ücreti)
  fee: 1000000,     // 0.01 LT (network fee)
  payload: {
    message: 'Merhaba!',
    message_type: 'text',
    timestamp: Date.now(),
    encrypted: false
  },
  timestamp: Date.now(),
  signatures: []
};
```

### Şifreli Mesaj

```javascript
const transaction = {
  tx_id: `TX_${hash}`,
  from_wallet: 'LT_sender_001',
  to_wallet: 'LT_receiver_002', 
  type: 'MESSAGE_PAYMENT',
  amount: 10000000,
  fee: 1000000,
  payload: {
    encrypted_message: 'base64EncodedCiphertext',
    nonce: 'base64EncodedNonce',
    message_type: 'encrypted',
    timestamp: Date.now(),
    encrypted: true
  },
  timestamp: Date.now(),
  signatures: []
};
```

## 📬 Mesaj Alma

### Blockchain Üzerinden Mesaj Okuma

```javascript
// Tüm blockchain'i al
const response = await fetch(`${API_URL}/chain`);
const { chain } = await response.json();

// Mesajları filtrele
const messages = [];
for (const block of chain) {
  for (const tx of block.transactions) {
    if (tx.type === 'MESSAGE_PAYMENT' && tx.to_wallet === yourWallet) {
      messages.push({
        from: tx.from_wallet,
        message: tx.payload.message || tx.payload.encrypted_message,
        encrypted: tx.payload.encrypted,
        nonce: tx.payload.nonce,
        time: new Date(tx.timestamp),
        block: block.index
      });
    }
  }
}
```

## 🔐 Şifreleme (TweetNaCl)

### Mesaj Şifreleme

```javascript
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

function encryptMessage(message, recipientPublicKey, senderPrivateKey) {
  const messageBytes = naclUtil.decodeUTF8(message);
  const nonce = nacl.randomBytes(24);
  
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    Buffer.from(recipientPublicKey, 'hex'),
    Buffer.from(senderPrivateKey, 'hex')
  );
  
  return {
    encrypted: naclUtil.encodeBase64(encrypted),
    nonce: naclUtil.encodeBase64(nonce)
  };
}
```

### Mesaj Şifresini Çözme

```javascript
function decryptMessage(encrypted, nonce, senderPublicKey, recipientPrivateKey) {
  const decrypted = nacl.box.open(
    naclUtil.decodeBase64(encrypted),
    naclUtil.decodeBase64(nonce),
    Buffer.from(senderPublicKey, 'hex'),
    Buffer.from(recipientPrivateKey, 'hex')
  );
  
  return naclUtil.encodeUTF8(decrypted);
}
```

## 💰 Ücretlendirme

| Mesaj Tipi | Minimum Ücret | Önerilen |
|------------|---------------|----------|
| Text       | 0.01 LT       | 0.1 LT   |
| Encrypted  | 0.05 LT       | 0.15 LT  |
| File/Image | 0.1 LT        | 1.0 LT   |

**Network Fee:** Her transaction için +0.01 LT

## 📊 Response Format

### Başarılı
```json
{
  "success": true,
  "tx_id": "TX_abc123...",
  "message": "Transaction added to mempool"
}
```

### Hata
```json
{
  "success": false,
  "error": "Insufficient balance"
}
```

## 🔗 İlgili Kaynaklar

- [Mesajlaşma Tutorial](./MESSAGING_TUTORIAL.md)
- [Çalışan Örnekler](../examples/)
- [Full API Documentation](../FULL_API_DOCUMENTATION.md)
- [Demo Sayfası](http://localhost:3000/messaging.html)
