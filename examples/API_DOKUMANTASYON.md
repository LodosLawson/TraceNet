# TraceNet API Tam Kapsamlı Döküman

**TraceNet Blockchain API'si** - Tüm endpoint'lerin detaylı açıklamaları ve kullanım örnekleri

> **Sunucu Adresi:** `http://localhost:3000`  
> **API Versiyonu:** v1.0  
> **Son Güncelleme:** Aralık 2025

---

## 📑 İçindekiler

1. [RPC Endpoints](#1-rpc-endpoints) - Blockchain temel işlemleri
2. [Wallet Endpoints](#2-wallet-endpoints) - Cüzdan yönetimi
3. [User Endpoints](#3-user-endpoints) - Kullanıcı profilleri
4. [Content Endpoints](#4-content-endpoints) - İçerik yönetimi
5. [Social Endpoints](#5-social-endpoints) - Sosyal etkileşimler
6. [Messaging Endpoints](#6-messaging-endpoints) - Şifreli mesajlaşma
7. [Validator Endpoints](#7-validator-endpoints) - Validatör işlemleri

---

## 1. RPC ENDPOINTS

Blockchain'in temel işlemlerini gerçekleştiren endpoint'ler.

### 1.1 Blockchain Durumu

**Endpoint:** `GET /rpc/status`

**Açıklama:** Blockchain'in mevcut durumunu, istatistiklerini ve ağ bilgilerini getirir.

**Parametreler:** Yok

**Yanıt:**
```json
{
  "blockchain": {
    "height": 1250,
    "totalTransactions": 5420,
    "totalAccounts": 342,
    "totalDistributedCoins": 2137500000,
    "latestBlockHash": "abc123..."
  },
  "mempool": {
    "pending_transactions": 15,
    "total_fees": 150000
  },
  "validators": {
    "total": 5,
    "online": 4,
    "offline": 1
  },
  "timestamp": 1701432000000
}
```

**JavaScript Örneği:**
```javascript
const axios = require('axios');

async function getBlockchainStatus() {
  const response = await axios.get('http://localhost:3000/rpc/status');
  console.log('Blockchain Yüksekliği:', response.data.blockchain.height);
  console.log('Toplam İşlem:', response.data.blockchain.totalTransactions);
  console.log('Aktif Validatör:', response.data.validators.online);
}
```

**cURL Örneği:**
```bash
curl http://localhost:3000/rpc/status | jq .
```

---

### 1.2 Block Bilgisi Al

**Endpoint:** `GET /rpc/block/:indexOrHash`

**Açıklama:** Belirli bir bloğun tüm detaylarını getirir. Index (sayı) veya hash kullanabilirsiniz.

**Parametreler:**
- `indexOrHash` (path) - Block index'i (örn: `0`) veya block hash'i

**Yanıt:**
```json
{
  "index": 0,
  "hash": "genesis_hash_abc123...",
  "previousHash": "0",
  "timestamp": 1700000000000,
  "transactions": [...],
  "validator": "genesis",
  "signatures": []
}
```

**JavaScript Örneği:**
```javascript
// Index ile
const block = await axios.get('http://localhost:3000/rpc/block/0');
console.log('Genesis Block:', block.data);

// Hash ile
const blockByHash = await axios.get('http://localhost:3000/rpc/block/abc123...');
console.log('Block:', blockByHash.data);
```

**cURL Örneği:**
```bash
# Genesis block
curl http://localhost:3000/rpc/block/0

# Belirli bir block
curl http://localhost:3000/rpc/block/1234
```

---

### 1.3 İşlem Detayları

**Endpoint:** `GET /rpc/transaction/:txId`

**Açıklama:** Belirli bir işlemin detaylarını getirir. Hem mempool hem de blockchain'de arama yapar.

**Parametreler:**
- `txId` (path) - İşlem ID'si

**Yanıt:**
```json
{
  "tx_id": "tx_abc123...",
  "from_wallet": "TRN123...",
  "to_wallet": "TRN456...",
  "type": "TRANSFER",
  "amount": 10000000000,
  "fee": 5000000,
  "timestamp": 1701432000000,
  "status": "confirmed",
  "block_index": 1250,
  "block_hash": "block_abc..."
}
```

**JavaScript Örneği:**
```javascript
async function getTransaction(txId) {
  try {
    const response = await axios.get(`http://localhost:3000/rpc/transaction/${txId}`);
    const tx = response.data;
    
    if (tx.status === 'pending') {
      console.log('İşlem mempool\'da bekliyor...');
    } else {
      console.log(`İşlem ${tx.block_index}. blokta onaylandı`);
    }
    
    return tx;
  } catch (error) {
    console.error('İşlem bulunamadı:', error.message);
  }
}
```

**cURL Örneği:**
```bash
curl http://localhost:3000/rpc/transaction/tx_abc123...
```

---

### 1.4 Cüzdan Bakiyesi

**Endpoint:** `GET /rpc/balance/:walletId`

**Açıklama:** Belirli bir cüzdanın güncel bakiyesini getirir.

**Parametreler:**
- `walletId` (path) - Cüzdan adresi (TRN ile başlar)

**Yanıt:**
```json
{
  "wallet_id": "TRN123456...",
  "balance": 625000000
}
```

**Not:** Bakiye değeri en küçük birimde (satoshi benzeri) verilir. 1 LT = 100,000,000 birim

**JavaScript Örneği:**
```javascript
async function getBalance(walletId) {
  const response = await axios.get(`http://localhost:3000/rpc/balance/${walletId}`);
  const balanceInLT = response.data.balance / 100000000;
  console.log(`Bakiye: ${balanceInLT} LT`);
  return balanceInLT;
}
```

**cURL Örneği:**
```bash
curl http://localhost:3000/rpc/balance/TRN123456...
```

---

### 1.5 Tüm Hesaplar

**Endpoint:** `GET /rpc/accounts`

**Açıklama:** Blockchain'deki tüm hesapları listeler.

**Parametreler:** Yok

**Yanıt:**
```json
{
  "accounts": [
    {
      "address": "TRN123...",
      "balance": 625000000,
      "nonce": 5
    },
    {
      "address": "TRN456...",
      "balance": 1000000000,
      "nonce": 12
    }
  ],
  "count": 342
}
```

**JavaScript Örneği:**
```javascript
async function getAllAccounts() {
  const response = await axios.get('http://localhost:3000/rpc/accounts');
  const accounts = response.data.accounts;
  
  accounts.forEach(acc => {
    const balanceInLT = acc.balance / 100000000;
    console.log(`${acc.address}: ${balanceInLT} LT (${acc.nonce} işlem)`);
  });
  
  return accounts;
}
```

---

### 1.6 Transfer Ücreti Hesapla

**Endpoint:** `POST /rpc/calculateTransferFee`

**Açıklama:** Bir transfer işlemi için gerekli ücreti dinamik olarak hesaplar. Alıcının geçmiş işlem sayısına göre ücret değişir.

**Body:**
```json
{
  "recipient_address": "TRN456...",
  "amount": 10000000000,
  "priority": "STANDARD"
}
```

**Parametreler:**
- `recipient_address` (string, zorunlu) - Alıcı cüzdan adresi
- `amount` (number, zorunlu) - Transfer miktarı (en küçük birim)
- `priority` (string, opsiyonel) - İşlem önceliği: `"STANDARD"`, `"HIGH"`, `"URGENT"`

**Yanıt:**
```json
{
  "recipient_address": "TRN456...",
  "amount": 10000000000,
  "priority": "STANDARD",
  "recipient_incoming_transfers": 25,
  "base_tier": "TIER_1",
  "base_rate": 0.001,
  "priority_rate": 1.0,
  "total_fee": 10000000,
  "total_fee_readable": "0.1 LT"
}
```

**JavaScript Örneği:**
```javascript
async function calculateFee(recipientAddress, amount, priority = 'STANDARD') {
  const response = await axios.post('http://localhost:3000/rpc/calculateTransferFee', {
    recipient_address: recipientAddress,
    amount: amount,
    priority: priority
  });
  
  const fee = response.data;
  console.log(`Transfer Ücreti: ${fee.total_fee_readable}`);
  console.log(`Alıcı Tier: ${fee.base_tier} (${fee.recipient_incoming_transfers} işlem)`);
  
  return fee.total_fee;
}
```

---

### 1.7 Transfer Gönder

**Endpoint:** `POST /rpc/transfer`

**Açıklama:** Para transferi gerçekleştirir. İşlem otomatik olarak mempool'a eklenir.

**Body:**
```json
{
  "from_wallet": "TRN123...",
  "to_wallet": "TRN456...",
  "amount": 10000000000,
  "priority": "STANDARD",
  "sender_public_key": "abc123...",
  "sender_signature": "def456..."
}
```

**Parametreler:**
- `from_wallet` (string, zorunlu) - Gönderen cüzdan
- `to_wallet` (string, zorunlu) - Alıcı cüzdan
- `amount` (number, zorunlu) - Miktar
- `priority` (string, opsiyonel) - Öncelik seviyesi
- `sender_public_key` (string, opsiyonel) - Gönderen public key
- `sender_signature` (string, opsiyonel) - İşlem imzası

**Yanıt:**
```json
{
  "success": true,
  "tx_id": "tx_abc123...",
  "amount": 10000000000,
  "fee": 10000000,
  "fee_readable": "0.1 LT",
  "priority": "STANDARD",
  "message": "Transfer transaction added to mempool"
}
```

**JavaScript Örneği:**
```javascript
async function sendTransfer(fromWallet, toWallet, amount, priority = 'STANDARD') {
  const response = await axios.post('http://localhost:3000/rpc/transfer', {
    from_wallet: fromWallet,
    to_wallet: toWallet,
    amount: amount,
    priority: priority
  });
  
  console.log('Transfer başarılı!');
  console.log('TX ID:', response.data.tx_id);
  console.log('Ücret:', response.data.fee_readable);
  
  return response.data.tx_id;
}
```

---

### 1.8 Madencilik Tetikle

**Endpoint:** `POST /rpc/mine`

**Açıklama:** Manuel olarak yeni bir block üretimini tetikler.

**Body:** `{}` (boş nesne)

**Yanıt:**
```json
{
  "success": true,
  "message": "Mining triggered successfully",
  "block_index": 1251
}
```

**JavaScript Örneği:**
```javascript
async function triggerMining() {
  const response = await axios.post('http://localhost:3000/rpc/mine', {});
  console.log(`Yeni block üretildi: #${response.data.block_index}`);
}
```

---

### 1.9 Ham İşlem Gönder

**Endpoint:** `POST /rpc/sendRawTx`

**Açıklama:** Önceden hazırlanmış ham bir işlemi blockchain'e gönderir.

**Body:** Transaction nesnesi (tam format)

**JavaScript Örneği:**
```javascript
const tx = {
  tx_id: "...",
  from_wallet: "TRN123...",
  to_wallet: "TRN456...",
  type: "TRANSFER",
  amount: 10000000000,
  fee: 5000000,
  timestamp: Date.now(),
  sender_public_key: "...",
  sender_signature: "...",
  payload: {}
};

const response = await axios.post('http://localhost:3000/rpc/sendRawTx', tx);
console.log('TX ID:', response.data.tx_id);
```

---

## 2. WALLET ENDPOINTS

Cüzdan oluşturma ve yönetimi için endpoint'ler.

### 2.1 Yeni Cüzdan Oluştur

**Endpoint:** `POST /api/wallet/create`

**Açıklama:** Kullanıcı için yeni bir cüzdan oluşturur. Her kullanıcının birden fazla cüzdanı olabilir.

**Body:**
```json
{
  "userId": "user_abc123"
}
```

**Yanıt:**
```json
{
  "wallet": {
    "wallet_id": "TRNabc123...",
    "user_id": "user_abc123",
    "public_key": "pubkey_hex...",
    "is_first_wallet": true,
    "created_at": 1701432000000
  },
  "mnemonic": "word1 word2 word3 ... word24"
}
```

**⚠️ ÖNEMLİ:** Mnemonic kelimeleri güvenli bir şekilde saklamanız gerekir. Sunucu tekrar gösteremez!

**JavaScript Örneği:**
```javascript
async function createWallet(userId) {
  const response = await axios.post('http://localhost:3000/api/wallet/create', {
    userId: userId
  });
  
  const { wallet, mnemonic } = response.data;
  
  console.log('Yeni cüzdan oluşturuldu!');
  console.log('Adres:', wallet.wallet_id);
  console.log('⚠️ Bu kelimeleri güvenli bir yerde saklayın:');
  console.log(mnemonic);
  
  // İlk cüzdan mı?
  if (wallet.is_first_wallet) {
    console.log('✅ Airdrop alındı: 0.00625 LT');
  }
  
  return wallet;
}
```

---

### 2.2 Kullanıcının Cüzdanlarını Listele

**Endpoint:** `GET /api/wallet/list/:userId`

**Açıklama:** Bir kullanıcının tüm cüzdanlarını listeler.

**Parametreler:**
- `userId` (path) - Kullanıcı ID'si

**Yanıt:**
```json
{
  "user_id": "user_abc123",
  "wallets": [
    {
      "wallet_id": "TRN123...",
      "public_key": "pubkey1...",
      "is_first_wallet": true,
      "created_at": 1701432000000
    },
    {
      "wallet_id": "TRN456...",
      "public_key": "pubkey2...",
      "is_first_wallet": false,
      "created_at": 1701532000000
    }
  ]
}
```

**JavaScript Örneği:**
```javascript
async function listUserWallets(userId) {
  const response = await axios.get(`http://localhost:3000/api/wallet/list/${userId}`);
  const wallets = response.data.wallets;
  
  console.log(`Toplam ${wallets.length} cüzdan:`);
  wallets.forEach((w, index) => {
    console.log(`${index + 1}. ${w.wallet_id} ${w.is_first_wallet ? '(Ana)' : ''}`);
  });
  
  return wallets;
}
```

---

### 2.3 Cüzdan Detayları

**Endpoint:** `GET /api/wallet/:walletId`

**Açıklama:** Belirli bir cüzdanın detaylı bilgilerini ve güncel bakiyesini getirir.

**Parametreler:**
- `walletId` (path) - Cüzdan adresi

**Yanıt:**
```json
{
  "wallet_id": "TRN123...",
  "user_id": "user_abc123",
  "public_key": "pubkey_hex...",
  "balance": 625000000,
  "is_first_wallet": true,
  "created_at": 1701432000000
}
```

**JavaScript Örneği:**
```javascript
async function getWalletDetails(walletId) {
  const response = await axios.get(`http://localhost:3000/api/wallet/${walletId}`);
  const wallet = response.data;
  
  const balanceInLT = wallet.balance / 100000000;
  console.log(`Cüzdan: ${wallet.wallet_id}`);
  console.log(`Bakiye: ${balanceInLT} LT`);
  console.log(`Kullanıcı: ${wallet.user_id}`);
  
  return wallet;
}
```

---

### 2.4 Veri İmzala

**Endpoint:** `POST /api/wallet/sign`

**Açıklama:** Sunucu tarafında cüzdan ile veri imzalar.

**⚠️ GÜVENLİK NOTU:** Üretim ortamında bu işlem client tarafında yapılmalıdır!

**Body:**
```json
{
  "wallet_id": "TRN123...",
  "transaction_data": "data_to_sign"
}
```

**Yanıt:**
```json
{
  "wallet_id": "TRN123...",
  "signature": "signature_hex...",
  "timestamp": 1701432000000
}
```

**JavaScript Örneği:**
```javascript
async function signData(walletId, data) {
  const response = await axios.post('http://localhost:3000/api/wallet/sign', {
    wallet_id: walletId,
    transaction_data: data
  });
  
  return response.data.signature;
}
```

---

## 3. USER ENDPOINTS

Kullanıcı profil yönetimi endpoint'leri.

### 3.1 Yeni Kullanıcı Oluştur

**Endpoint:** `POST /api/user/create`

**Açıklama:** Yeni kullanıcı kaydı oluşturur. Otomatik olarak ilk cüzdan ve encryption key'ler oluşturulur. İlk cüzdana 0.00625 LT airdrop verilir.

**Body:**
```json
{
  "nickname": "alice",
  "email": "alice@example.com",
  "name": "Alice",
  "surname": "Johnson",
  "birth_date": "1995-05-15"
}
```

**Not:** Tüm alanlar opsiyoneldir, ancak `nickname` önerilir.

**Yanıt:**
```json
{
  "user": {
    "user_id": "uuid-abc-123",
    "nickname": "alice",
    "name": "Alice",
    "surname": "Johnson",
    "created_at": 1701432000000,
    "encryption_public_key": "encryption_pubkey_hex...",
    "messaging_privacy": "followers"
  },
  "wallet": {
    "wallet_id": "TRNabc123...",
    "public_key": "pubkey_hex...",
    "created_at": 1701432000000
  },
  "mnemonic": "word1 word2 ... word24",
  "airdrop_amount": "0.00625 LT"
}
```

**JavaScript Örneği:**
```javascript
async function createUser(nickname, email, name, surname, birthDate) {
  const response = await axios.post('http://localhost:3000/api/user/create', {
    nickname,
    email,
    name,
    surname,
    birth_date: birthDate
  });
  
  const { user, wallet, mnemonic } = response.data;
  
  console.log('✅ Kullanıcı oluşturuldu!');
  console.log(`Kullanıcı ID: ${user.user_id}`);
  console.log(`Nickname: @${user.nickname}`);
  console.log(`Cüzdan: ${wallet.wallet_id}`);
  console.log(`Airdrop: 0.00625 LT alındı!`);
  console.log(`⚠️ Mnemonic'i kaydedin: ${mnemonic}`);
  
  return { user, wallet, mnemonic };
}
```

---

### 3.2 Kullanıcı Bul (Nickname)

**Endpoint:** `GET /api/user/nickname/:nickname`

**Açıklama:** Nickname ile kullanıcı arar.

**Parametreler:**
- `nickname` (path) - Kullanıcı nickname'i

**Yanıt:**
```json
{
  "user": {
    "user_id": "uuid-abc-123",
    "nickname": "alice",
    "name": "Alice",
    "surname": "Johnson",
    "created_at": 1701432000000,
    "encryption_public_key": "...",
    "messaging_privacy": "followers"
  },
  "wallet_id": "TRNabc123...",
  "balance": 625000000,
  "total_wallets": 2
}
```

**JavaScript Örneği:**
```javascript
async function findUserByNickname(nickname) {
  try {
    const response = await axios.get(`http://localhost:3000/api/user/nickname/${nickname}`);
    const { user, wallet_id, balance } = response.data;
    
    console.log(`@${user.nickname}`);
    console.log(`İsim: ${user.name} ${user.surname}`);
    console.log(`Ana Cüzdan: ${wallet_id}`);
    console.log(`Bakiye: ${balance / 100000000} LT`);
    
    return user;
  } catch (error) {
    console.error('Kullanıcı bulunamadı');
    return null;
  }
}
```

---

### 3.3 Kullanıcı Bul (ID)

**Endpoint:** `GET /api/user/:userId`

**Açıklama:** User ID ile kullanıcı arar.

**Parametreler:**
- `userId` (path) - Kullanıcı ID'si

**Yanıt:** 3.2 ile aynı format

---

### 3.4 Kullanıcı Ara

**Endpoint:** `GET /api/user/search?q=alice&limit=20`

**Açıklama:** Nickname, isim veya soyisimde arama yapar.

**Query Parametreleri:**
- `q` (string, zorunlu) - Arama terimi
- `limit` (number, opsiyonel) - Maksimum sonuç sayısı (varsayılan: 20)

**Yanıt:**
```json
{
  "users": [
    {
      "user_id": "uuid-1",
      "nickname": "alice",
      "name": "Alice",
      "surname": "Johnson",
      "created_at": 1701432000000,
      "encryption_public_key": "...",
      "messaging_privacy": "public"
    }
  ],
  "count": 1
}
```

**JavaScript Örneği:**
```javascript
async function searchUsers(query, limit = 20) {
  const response = await axios.get('http://localhost:3000/api/user/search', {
    params: { q: query, limit }
  });
  
  console.log(`${response.data.count} kullanıcı bulundu:`);
  response.data.users.forEach(u => {
    console.log(`@${u.nickname} - ${u.name} ${u.surname}`);
  });
  
  return response.data.users;
}
```

---

### 3.5 Nickname Müsaitlik Kontrolü

**Endpoint:** `GET /api/user/check-nickname/:nickname`

**Açıklama:** Bir nickname'in kullanılıp kullanılmadığını kontrol eder.

**Yanıt:**
```json
{
  "nickname": "alice",
  "available": false
}
```

**JavaScript Örneği:**
```javascript
async function checkNickname(nickname) {
  const response = await axios.get(`http://localhost:3000/api/user/check-nickname/${nickname}`);
  
  if (response.data.available) {
    console.log(`✅ @${nickname} kullanılabilir!`);
  } else {
    console.log(`❌ @${nickname} zaten alınmış`);
  }
  
  return response.data.available;
}
```

---

### 3.6 Encryption Public Key Al

**Endpoint:** `GET /api/user/encryption-key/:identifier`

**Açıklama:** Mesajlaşma için kullanıcının encryption public key'ini getirir. Nickname, user ID veya wallet ID ile çalışır.

**Parametreler:**
- `identifier` (path) - Nickname, user ID veya wallet ID

**Yanıt:**
```json
{
  "user_id": "uuid-abc-123",
  "nickname": "alice",
  "wallet_id": "TRNabc123...",
  "encryption_public_key": "encryption_key_hex...",
  "messaging_privacy": "public"
}
```

**JavaScript Örneği:**
```javascript
async function getEncryptionKey(identifier) {
  const response = await axios.get(`http://localhost:3000/api/user/encryption-key/${identifier}`);
  const keyInfo = response.data;
  
  console.log(`@${keyInfo.nickname} için encryption key alındı`);
  console.log(`Privacy: ${keyInfo.messaging_privacy}`);
  
  return keyInfo.encryption_public_key;
}
```

---

### 3.7 Mesajlaşma Gizliliği Güncelle

**Endpoint:** `POST /api/user/:userId/messaging-privacy`

**Açıklama:** Kullanıcının mesajlaşma gizlilik ayarını değiştirir.

**Body:**
```json
{
  "privacy": "public"
}
```

**Privacy Seçenekleri:**
- `"public"` - Herkes mesaj gönderebilir
- `"followers"` - Sadece takipçiler (varsayılan)
- `"private"` - Kimse mesaj gönderemez

**Yanıt:**
```json
{
  "success": true,
  "privacy": "public"
}
```

**JavaScript Örneği:**
```javascript
async function updateMessagingPrivacy(userId, privacy) {
  const response = await axios.post(
    `http://localhost:3000/api/user/${userId}/messaging-privacy`,
    { privacy }
  );
  
  console.log(`Mesajlaşma ayarı güncellendi: ${privacy}`);
  return response.data;
}
```

---

### 3.8 QR Code Verisi Oluştur

**Endpoint:** `GET /api/user/:userId/qr-code`

**Açıklama:** Mesajlaşma için QR code verisi oluşturur.

**Yanıt:**
```json
{
  "qr_data": {
    "type": "tracenet_messaging",
    "nickname": "alice",
    "wallet_id": "TRNabc123...",
    "encryption_public_key": "...",
    "messaging_privacy": "public"
  },
  "qr_string": "tracenet://msg?key=...&wallet=TRN...&nick=alice"
}
```

**JavaScript Örneği:**
```javascript
async function generateQRCode(userId) {
  const response = await axios.get(`http://localhost:3000/api/user/${userId}/qr-code`);
  const { qr_data, qr_string } = response.data;
  
  console.log('QR Code URI:', qr_string);
  // QR kütüphanesi ile görselleştirin
  
  return qr_string;
}
```

---

## 4. CONTENT ENDPOINTS

İçerik oluşturma ve yönetimi.

### 4.1 İçerik Oluştur

**Endpoint:** `POST /api/content/create`

**Açıklama:** Yeni içerik (post, video, resim vb.) oluşturur ve blockchain'e kaydeder.

**Body:**
```json
{
  "wallet_id": "TRNabc123...",
  "content_type": "POST",
  "title": "İlk Blockchain Gönderim",
  "description": "Bu benim ilk blockchain içeriğim!",
  "content_url": "https://example.com/image.jpg",
  "media_type": "image/jpeg",
  "duration": null,
  "size": 1024000,
  "tags": ["blockchain", "first-post", "tracenet"]
}
```

**Parametreler:**
- `wallet_id` (string, zorunlu) - İçerik sahibinin cüzdanı
- `content_type` (string, zorunlu) - `"POST"`, `"VIDEO"`, `"IMAGE"`, `"AUDIO"`, `"ARTICLE"`
- `title` (string, opsiyonel) - İçerik başlığı
- `description` (string, opsiyonel) - Açıklama
- `content_url` (string, opsiyonel) - Medya URL'i (POST için opsiyonel)
- `media_type` (string, opsiyonel) - MIME type
- `duration` (number, opsiyonel) - Video/audio için süre (saniye)
- `size` (number, opsiyonel) - Dosya boyutu (byte)
- `tags` (array, opsiyonel) - Etiketler

**Yanıt:**
```json
{
  "success": true,
  "content": {
    "content_id": "content_uuid_123",
    "wallet_id": "TRNabc123...",
    "content_type": "POST",
    "title": "İlk Blockchain Gönderim",
    "description": "...",
    "created_at": 1701432000000,
    "likes_count": 0,
    "comments_count": 0
  },
  "tx_id": "tx_abc123..."
}
```

**JavaScript Örneği:**
```javascript
async function createPost(walletId, title, description, tags = []) {
  const response = await axios.post('http://localhost:3000/api/content/create', {
    wallet_id: walletId,
    content_type: 'POST',
    title,
    description,
    tags
  });
  
  console.log('✅ İçerik oluşturuldu!');
  console.log('Content ID:', response.data.content.content_id);
  console.log('TX ID:', response.data.tx_id);
  
  return response.data.content;
}

// Örnek kullanım
await createPost(
  'TRNabc123...',
  'Blockchain Deneyimi',
  'TraceNet çok hızlı!',
  ['blockchain', 'tracenet']
);
```

---

### 4.2 İçerik Detayları

**Endpoint:** `GET /api/content/:contentId`

**Açıklama:** Belirli bir içeriğin detaylarını getirir.

**Yanıt:**
```json
{
  "success": true,
  "content": {
    "content_id": "content_uuid_123",
    "wallet_id": "TRNabc123...",
    "content_type": "POST",
    "title": "...",
    "description": "...",
    "created_at": 1701432000000,
    "likes_count": 15,
    "comments_count": 8,
    "tags": ["blockchain"]
  }
}
```

---

### 4.3 Kullanıcı İçerikleri

**Endpoint:** `GET /api/content/user/:walletId?limit=50`

**Açıklama:** Belirli bir kullanıcının tüm içeriklerini listeler.

**Query Parametreleri:**
- `limit` (number, opsiyonel) - Maksimum sonuç (varsayılan: 50)

**Yanıt:**
```json
{
  "success": true,
  "wallet_id": "TRNabc123...",
  "contents": [...],
  "count": 25
}
```

**JavaScript Örneği:**
```javascript
async function getUserContent(walletId, limit = 50) {
  const response = await axios.get(
    `http://localhost:3000/api/content/user/${walletId}`,
    { params: { limit } }
  );
  
  console.log(`${response.data.count} içerik bulundu`);
  response.data.contents.forEach(c => {
    console.log(`- ${c.title} (${c.likes_count} beğeni, ${c.comments_count} yorum)`);
  });
  
  return response.data.contents;
}
```

---

### 4.4 Global Feed

**Endpoint:** `GET /api/content/feed?limit=20&offset=0`

**Açıklama:** Tüm kullanıcıların içeriklerini en yeniden eskiye sıralar.

**Query Parametreleri:**
- `limit` (number, opsiyonel) - Sayfa başına içerik (varsayılan: 20)
- `offset` (number, opsiyonel) - Başlangıç noktası (varsayılan: 0)

**Yanıt:**
```json
{
  "success": true,
  "contents": [...],
  "total": 523,
  "limit": 20,
  "offset": 0
}
```

**JavaScript Örneği:**
```javascript
async function getContentFeed(page = 0, limit = 20) {
  const offset = page * limit;
  const response = await axios.get('http://localhost:3000/api/content/feed', {
    params: { limit, offset }
  });
  
  console.log(`Sayfa ${page + 1} (${response.data.total} toplam)`);
  return response.data.contents;
}
```

---

## 5. SOCIAL ENDPOINTS

Sosyal etkileşim endpoint'leri (beğeni, yorum, takip).

### 5.1 İçerik Beğen

**Endpoint:** `POST /api/social/like`

**Açıklama:** Bir içeriği beğenir. Ücret: 0.00002 LT (Yaratıcıya %25, Node'a %50, Treasury'e %25)

**Body:**
```json
{
  "wallet_id": "TRNabc123...",
  "content_id": "content_uuid_456"
}
```

**Yanıt:**
```json
{
  "success": true,
  "tx_id": "tx_abc123...",
  "fee_breakdown": {
    "total_fee": 2000,
    "creator_received": 500,
    "treasury_received": 500,
    "fee_split": "50% creator / 50% treasury"
  }
}
```

**JavaScript Örneği:**
```javascript
async function likeContent(walletId, contentId) {
  const response = await axios.post('http://localhost:3000/api/social/like', {
    wallet_id: walletId,
    content_id: contentId
  });
  
  console.log('❤️ Beğenildi!');
  console.log('Yaratıcı kazandı:', response.data.fee_breakdown.creator_received / 100000000, 'LT');
  
  return response.data.tx_id;
}
```

---

### 5.2 Yorum Ekle

**Endpoint:** `POST /api/social/comment`

**Açıklama:** İçeriğe yorum ekler. Ücret: 0.00002 LT

**Body:**
```json
{
  "wallet_id": "TRNabc123...",
  "content_id": "content_uuid_456",
  "comment_text": "Harika bir gönderi!",
  "parent_comment_id": null
}
```

**Parametreler:**
- `parent_comment_id` (string, opsiyonel) - Yanıt için üst yorum ID'si

**Yanıt:** 5.1 ile benzer

**JavaScript Örneği:**
```javascript
async function addComment(walletId, contentId, text, parentId = null) {
  const response = await axios.post('http://localhost:3000/api/social/comment', {
    wallet_id: walletId,
    content_id: contentId,
    comment_text: text,
    parent_comment_id: parentId
  });
  
  console.log('💬 Yorum eklendi!');
  return response.data.tx_id;
}
```

---

### 5.3 Kullanıcı Takip Et

**Endpoint:** `POST /api/social/follow`

**Açıklama:** Bir kullanıcıyı takip eder. ÜCRETSİZ!

**Body:**
```json
{
  "wallet_id": "TRNfollower...",
  "target_wallet_id": "TRNtarget..."
}
```

**Yanıt:**
```json
{
  "success": true,
  "tx_id": "tx_abc123...",
  "message": "Following user (FREE - no fee)"
}
```

**JavaScript Örneği:**
```javascript
async function followUser(followerWalletId, targetWalletId) {
  const response = await axios.post('http://localhost:3000/api/social/follow', {
    wallet_id: followerWalletId,
    target_wallet_id: targetWalletId
  });
  
  console.log('✅ Takip edildi! (ÜCRETSİZ)');
  return response.data.tx_id;
}
```

---

### 5.4 Takibi Bırak

**Endpoint:** `POST /api/social/unfollow`

**Açıklama:** Takibi bırakır. ÜCRETSİZ!

**Body:** 5.3 ile aynı

---

### 5.5 Beğenileri Listele

**Endpoint:** `GET /api/social/likes/:contentId`

**Açıklama:** İçeriğin tüm beğenilerini listeler.

**Yanıt:**
```json
{
  "success": true,
  "content_id": "content_uuid_456",
  "likes": [
    {
      "wallet_id": "TRNabc...",
      "timestamp": 1701432000000
    }
  ],
  "count": 15
}
```

---

### 5.6 Yorumları Listele

**Endpoint:** `GET /api/social/comments/:contentId`

**Açıklama:** İçeriğin tüm yorumlarını listeler.

**Yanıt:**
```json
{
  "success": true,
  "content_id": "content_uuid_456",
  "comments": [
    {
      "comment_id": "comment_uuid_789",
      "wallet_id": "TRNabc...",
      "comment_text": "Harika!",
      "timestamp": 1701432000000,
      "parent_comment_id": null
    }
  ],
  "count": 8
}
```

---

### 5.7 Takipçileri Listele

**Endpoint:** `GET /api/social/followers/:walletId`

**Açıklama:** Kullanıcının takipçilerini listeler.

---

### 5.8 Takip Edilenleri Listele

**Endpoint:** `GET /api/social/following/:walletId`

**Açıklama:** Kullanıcının takip ettiklerini listeler.

---

## 6. MESSAGING ENDPOINTS

Uçtan uca şifreli mesajlaşma.

### 6.1 Şifreli Mesaj Gönder

**Endpoint:** `POST /api/messaging/send`

**Açıklama:** Şifreli özel mesaj gönderir. Ücret: 0.000002 LT

**⚠️ ÖNEMLİ:** Mesaj CLIENT tarafında şifrelenmeli! Sunucu şifreleme yapmaz.

**Body:**
```json
{
  "from_wallet": "TRNsender...",
  "to_wallet": "TRNrecipient...",
  "encrypted_message": "nonce_hex:encrypted_data_hex",
  "sender_public_key": "pubkey_hex...",
  "sender_signature": "signature_hex..."
}
```

**Yanıt:**
```json
{
  "success": true,
  "tx_id": "tx_abc123...",
  "message": "Encrypted private message sent to blockchain"
}
```

**JavaScript Örneği (Şifreleme ile):**
```javascript
const { KeyManager } = require('../src/blockchain/crypto/KeyManager');

async function sendEncryptedMessage(fromWallet, toWallet, message, senderPrivateKey, recipientPublicKey) {
  // 1. Mesajı şifrele
  const encryptedMessage = KeyManager.encryptForUser(
    message,
    senderPrivateKey,
    recipientPublicKey
  );
  
  // 2. Blockchain'e gönder
  const response = await axios.post('http://localhost:3000/api/messaging/send', {
    from_wallet: fromWallet,
    to_wallet: toWallet,
    encrypted_message: encryptedMessage
  });
  
  console.log('📨 Şifreli mesaj gönderildi!');
  console.log('TX ID:', response.data.tx_id);
  
  return response.data.tx_id;
}
```

---

### 6.2 Gelen Kutusu

**Endpoint:** `GET /api/messaging/inbox/:walletId?limit=50&offset=0`

**Açıklama:** Cüzdana gelen şifreli mesajları listeler.

**Query Parametreleri:**
- `limit` (number, opsiyonel) - Maksimum mesaj sayısı
- `offset` (number, opsiyonel) - Sayfalama

**Yanıt:**
```json
{
  "success": true,
  "wallet_id": "TRNabc123...",
  "messages": [
    {
      "tx_id": "tx_abc123...",
      "from": "TRNsender...",
      "timestamp": 1701432000000,
      "encrypted_content": "nonce:data",
      "sender_public_key": "pubkey..."
    }
  ],
  "total": 42
}
```

**JavaScript Örneği (Şifre Çözme ile):**
```javascript
async function getInbox(walletId, recipientPrivateKey) {
  // 1. Şifreli mesajları al
  const response = await axios.get(`http://localhost:3000/api/messaging/inbox/${walletId}`);
  const messages = response.data.messages;
  
  // 2. Her mesajın şifresini çöz
  const decryptedMessages = messages.map(msg => {
    try {
      const decrypted = KeyManager.decryptFromUser(
        msg.encrypted_content,
        recipientPrivateKey,
        msg.sender_public_key
      );
      
      return {
        from: msg.from,
        message: decrypted,
        timestamp: new Date(msg.timestamp)
      };
    } catch (error) {
      return {
        from: msg.from,
        message: '[Şifre çözülemedi]',
        timestamp: new Date(msg.timestamp)
      };
    }
  });
  
  console.log(`📬 ${decryptedMessages.length} mesaj alındı`);
  decryptedMessages.forEach(m => {
    console.log(`${m.from}: ${m.message}`);
  });
  
  return decryptedMessages;
}
```

---

### 6.3 Mesaj Şifre Çöz (DEPRECATED)

**Endpoint:** `POST /api/messaging/decrypt`

**⚠️ BU ENDPOINT ARTIK KULLANILMIYOR!**

**Sebep:** Güvenlik. Private key'ler asla sunucuya gönderilmemeli.

**Yanıt:**
```json
{
  "error": "This endpoint is deprecated for security reasons.",
  "message": "Private messages must be decrypted CLIENT-SIDE using your private key."
}
```

**Doğru Kullanım:** Client tarafında `KeyManager.decryptFromUser()` kullanın.

---

## 7. VALIDATOR ENDPOINTS

Validatör node yönetimi.

### 7.1 Validator Kaydı

**Endpoint:** `POST /api/validator/register`

**Açıklama:** Yeni bir validator kaydeder.

**Body:**
```json
{
  "validator_id": "validator_001",
  "user_id": "user_abc123",
  "public_key": "pubkey_hex..."
}
```

**Yanıt:**
```json
{
  "success": true,
  "validator_id": "validator_001",
  "message": "Validator registered successfully"
}
```

---

### 7.2 Validator Cüzdanı Kaydet

**Endpoint:** `POST /api/validator/:validatorId/wallet`

**Açıklama:** Validator için cüzdan kaydeder. Ücret gelirlerinin %50'si bu cüzdana gider.

**Body:**
```json
{
  "wallet_address": "TRNvalidator..."
}
```

**Yanıt:**
```json
{
  "success": true,
  "validator_id": "validator_001",
  "wallet_address": "TRNvalidator...",
  "message": "Wallet registered successfully for validator"
}
```

**JavaScript Örneği:**
```javascript
async function registerValidatorWallet(validatorId, walletAddress) {
  const response = await axios.post(
    `http://localhost:3000/api/validator/${validatorId}/wallet`,
    { wallet_address: walletAddress }
  );
  
  console.log('✅ Validator cüzdanı kaydedildi!');
  console.log('Artık ücret gelirleri alacaksınız');
  
  return response.data;
}
```

---

### 7.3 Validator Cüzdanını Sorgula

**Endpoint:** `GET /api/validator/:validatorId/wallet`

**Yanıt:**
```json
{
  "validator_id": "validator_001",
  "wallet_address": "TRNvalidator..."
}
```

---

### 7.4 Heartbeat Gönder

**Endpoint:** `POST /api/validator/heartbeat`

**Açıklama:** Validator'ın aktif olduğunu bildirir.

**Body:**
```json
{
  "validator_id": "validator_001"
}
```

**Yanıt:**
```json
{
  "success": true,
  "validator_id": "validator_001",
  "timestamp": 1701432000000
}
```

---

### 7.5 Validator'ları Listele

**Endpoint:** `GET /api/validator/list?online=true`

**Query Parametreleri:**
- `online` (boolean, opsiyonel) - Sadece aktif olanlar için `true`

**Yanıt:**
```json
{
  "validators": [
    {
      "validator_id": "validator_001",
      "user_id": "user_abc123",
      "is_online": true,
      "reputation": 100,
      "total_blocks_produced": 523,
      "total_signatures": 1247,
      "last_active": 1701432000000
    }
  ],
  "count": 5
}
```

---

## 🔥 TAM ÖRNEK SENARYOLAR

### Senaryo 1: Yeni Kullanıcı Kaydı ve İlk Post

```javascript
async function completeUserOnboarding() {
  // 1. Kullanıcı oluştur
  const { user, wallet, mnemonic } = await createUser(
    'johndoe',
    'john@example.com',
    'John',
    'Doe',
    '1990-01-01'
  );
  
  console.log('✅ Kullanıcı oluşturuldu!');
  console.log('🎁 Airdrop: 0.00625 LT alındı');
  
  // 2. Bakiyeyi kontrol et
  const balance = await getBalance(wallet.wallet_id);
  console.log(`💰 Bakiye: ${balance} LT`);
  
  // 3. İlk post'u oluştur
  const post = await createPost(
    wallet.wallet_id,
    'Merhaba TraceNet!',
    'Bu benim ilk blockchain post\'um. Çok heyecanlıyım! 🚀',
    ['blockchain', 'first-post']
  );
  
  console.log('📝 İlk post oluşturuldu!');
  
  return { user, wallet, post };
}
```

---

### Senaryo 2: Sosyal Etkileşim

```javascript
async function socialInteraction(userWallet, targetPost) {
  // 1. Post'u beğen
  await likeContent(userWallet, targetPost.content_id);
  console.log('❤️ Beğenildi');
  
  // 2. Yorum ekle
  await addComment(userWallet, targetPost.content_id, 'Harika bir gönderi!');
  console.log('💬 Yorum eklendi');
  
  // 3. İçerik sahibini takip et
  await followUser(userWallet, targetPost.wallet_id);
  console.log('✅ Takip edildi');
  
  // 4. Güncel beğeni ve yorum sayılarını al
  const likes = await axios.get(`http://localhost:3000/api/social/likes/${targetPost.content_id}`);
  const comments = await axios.get(`http://localhost:3000/api/social/comments/${targetPost.content_id}`);
  
  console.log(`📊 ${likes.data.count} beğeni, ${comments.data.count} yorum`);
}
```

---

### Senaryo 3: Şifreli Mesajlaşma

```javascript
const { KeyManager } = require('../src/blockchain/crypto/KeyManager');

async function sendAndReceiveMessage(alice, bob) {
  // 1. Bob'un encryption key'ini al
  const bobKeyInfo = await axios.get(
    `http://localhost:3000/api/user/encryption-key/${bob.nickname}`
  );
  
  // 2. Mesajı şifrele ve gönder
  const message = 'Merhaba Bob! Bu gizli bir mesaj 🔐';
  const encryptedMsg = KeyManager.encryptForUser(
    message,
    alice.encryptionPrivateKey,
    bobKeyInfo.data.encryption_public_key
  );
  
  await axios.post('http://localhost:3000/api/messaging/send', {
    from_wallet: alice.walletId,
    to_wallet: bob.walletId,
    encrypted_message: encryptedMsg
  });
  
  console.log('📨 Alice → Bob: Mesaj gönderildi');
  
  // 3. Bob mesajları alıyor
  const inbox = await axios.get(
    `http://localhost:3000/api/messaging/inbox/${bob.walletId}`
  );
  
  // 4. İlk mesajın şifresini çöz
  const firstMsg = inbox.data.messages[0];
  const decrypted = KeyManager.decryptFromUser(
    firstMsg.encrypted_content,
    bob.encryptionPrivateKey,
    firstMsg.sender_public_key
  );
  
  console.log('📬 Bob aldı:', decrypted);
}
```

---

### Senaryo 4: Transfer İşlemi

```javascript
async function transferMoney(fromWallet, toWallet, amountInLT) {
  const amount = amountInLT * 100000000; // LT'yi en küçük birime çevir
  
  // 1. Önce ücreti hesapla
  const feeInfo = await axios.post('http://localhost:3000/rpc/calculateTransferFee', {
    recipient_address: toWallet,
    amount: amount,
    priority: 'STANDARD'
  });
  
  console.log(`💸 Transfer: ${amountInLT} LT`);
  console.log(`💰 Ücret: ${feeInfo.data.total_fee_readable}`);
  console.log(`📊 Alıcı Tier: ${feeInfo.data.base_tier}`);
  
  // 2. Kullanıcıdan onay al
  const confirmed = true; // Gerçek uygulamada kullanıcıdan onay alın
  
  if (confirmed) {
    // 3. Transfer'i gönder
    const tx = await axios.post('http://localhost:3000/rpc/transfer', {
      from_wallet: fromWallet,
      to_wallet: toWallet,
      amount: amount,
      priority: 'STANDARD'
    });
    
    console.log('✅ Transfer başarılı!');
    console.log('TX ID:', tx.data.tx_id);
    
    return tx.data.tx_id;
  }
}
```

---

## 🎯 EN İYİ UYGULAMALAR

### 1. Hata Yönetimi

```javascript
async function safeApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.response) {
      // Sunucu hata yanıtı verdi
      console.error('API Hatası:', error.response.data.error);
      console.error('Status Code:', error.response.status);
    } else if (error.request) {
      // İstek gönderildi ama yanıt alınamadı
      console.error('Bağlantı hatası: Sunucu yanıt vermiyor');
    } else {
      // İstek oluşturulurken hata
      console.error('Hata:', error.message);
    }
    throw error;
  }
}

// Kullanım
await safeApiCall(async () => {
  return await createUser('alice', 'alice@example.com');
});
```

---

### 2. Retry Mekanizması

```javascript
async function apiCallWithRetry(apiFunction, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiFunction();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      console.log(`Deneme ${i + 1}/${maxRetries} başarısız. Tekrar deneniyor...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

### 3. Rate Limiting

```javascript
class ApiClient {
  constructor(baseURL) {
    this.axios = axios.create({ baseURL });
    this.lastRequest = 0;
    this.minInterval = 100; // ms
  }
  
  async request(config) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
    return await this.axios.request(config);
  }
}

const client = new ApiClient('http://localhost:3000');
```

---

## 📚 EK KAYNAKLAR

- **Şifreleme Detayları:** `/examples/encryption_examples.js`
- **cURL Örnekleri:** `/examples/CURL_EXAMPLES.md`
- **API JavaScript SDK:** `/examples/api_examples.js`
- **Mesaj Şifre Çözme:** `/examples/decrypt_blockchain_messages.ts`

---

## 💡 İPUÇLARI

1. **Mnemonic Güvenliği:** Hiçbir zaman mnemonic kelimeleri sunucuya göndermeyin veya kodda saklamayın
2. **Client-side Şifreleme:** Tüm mesajlar client tarafında şifrelenmeli
3. **Fee Hesaplama:** Transfer öncesi mutlaka ücreti hesaplayın
4. **Error Handling:** Her API çağrısında hata yönetimi yapın
5. **Rate Limiting:** API'yi aşırı yüklemekten kaçının

---

**🚀 Başarılar! TraceNet ile blockchain geliştirme keyfi!**
