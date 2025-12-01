# TraceNet Şifreleme API Dokümantasyonu

## 🔐 Genel Bakış

TraceNet blockchain'inde kullanıcılar arası güvenli mesajlaşma için uçtan uca şifreleme sistemi. Her kullanıcının ayrı **şifreleme anahtarı** (Curve25519) ve **imza anahtarı** (Ed25519) vardır.

---

## 📋 Endpoint'ler

### 1. Şifreleme Anahtarını Al
Bir kullanıcının public encryption key'ini almak için.

```http
GET /api/user/encryption-key/:identifier
```

**Parametreler:**
- `identifier`: Kullanıcı ID, nickname veya wallet ID

**Örnek İstek:**
```bash
curl http://localhost:3000/api/user/encryption-key/alice
```

**Başarılı Yanıt (200):**
```json
{
  "user_id": "usr_123abc",
  "nickname": "alice",
  "wallet_id": "TRNabc123...",
  "encryption_public_key": "a1b2c3d4e5f6...",
  "messaging_privacy": "public"
}
```

**Hata Yanıtları:**
- `404`: Kullanıcı bulunamadı
- `500`: Sunucu hatası

---

### 2. Mesajlaşma Gizliliğini Güncelle
Kullanıcının mesajlaşma gizlilik ayarını değiştir.

```http
POST /api/user/:userId/messaging-privacy
Content-Type: application/json
```

**Body:**
```json
{
  "privacy": "public" | "followers" | "private"
}
```

**Gizlilik Seviyeleri:**
- `public`: Herkes mesaj gönderebilir
- `followers`: Sadece takipçiler mesaj gönderebilir
- `private`: Kimse mesaj gönderemez (DM istekleri)

**Örnek İstek:**
```bash
curl -X POST http://localhost:3000/api/user/usr_123/messaging-privacy \
  -H "Content-Type: application/json" \
  -d '{"privacy": "followers"}'
```

**Başarılı Yanıt (200):**
```json
{
  "success": true,
  "privacy": "followers"
}
```

---

### 3. QR Kod Verisi Oluştur
Mesajlaşma için QR kod verisi oluştur.

```http
GET /api/user/:userId/qr-code
```

**Örnek İstek:**
```bash
curl http://localhost:3000/api/user/usr_123/qr-code
```

**Başarılı Yanıt (200):**
```json
{
  "qr_data": {
    "type": "tracenet_messaging",
    "nickname": "alice",
    "wallet_id": "TRNabc123...",
    "encryption_public_key": "a1b2c3d4e5f6...",
    "messaging_privacy": "public"
  },
  "qr_string": "tracenet://msg?key=a1b2c3d4e5f6&wallet=TRNabc123&nick=alice"
}
```

---

## 💻 JavaScript/Node.js Örnekleri

### Kullanıcı Oluşturma ve Şifreleme Anahtarı Alma

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// 1. Yeni kullanıcı oluştur
async function createUser() {
  try {
    const response = await axios.post(`${BASE_URL}/api/user/create`, {
      nickname: 'alice',
      email: 'alice@example.com',
      password: 'SecurePass123!',
      name: 'Alice',
      surname: 'Smith',
      birth_date: '1990-01-15'
    });

    console.log('✅ Kullanıcı oluşturuldu:');
    console.log('User ID:', response.data.user.user_id);
    console.log('Encryption Public Key:', response.data.user.encryption_public_key);
    console.log('Messaging Privacy:', response.data.user.messaging_privacy);
    console.log('Mnemonic (GÜVENLİ SAK!):', response.data.mnemonic);

    return response.data;
  } catch (error) {
    console.error('❌ Hata:', error.response?.data || error.message);
  }
}

// 2. Başka bir kullanıcının encryption key'ini al
async function getEncryptionKey(identifier) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/user/encryption-key/${identifier}`
    );

    console.log('✅ Encryption key alındı:');
    console.log('Nickname:', response.data.nickname);
    console.log('Public Key:', response.data.encryption_public_key);
    console.log('Privacy:', response.data.messaging_privacy);

    return response.data;
  } catch (error) {
    console.error('❌ Hata:', error.response?.data || error.message);
  }
}

// Kullanım
(async () => {
  // Kullanıcı oluştur
  const newUser = await createUser();
  
  // Encryption key'i al
  await getEncryptionKey('alice');
})();
```

---

### Gizlilik Ayarlarını Değiştirme

```javascript
async function updatePrivacy(userId, privacyLevel) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/user/${userId}/messaging-privacy`,
      { privacy: privacyLevel }
    );

    console.log('✅ Gizlilik güncellendi:', response.data.privacy);
    return response.data;
  } catch (error) {
    console.error('❌ Hata:', error.response?.data || error.message);
  }
}

// Kullanım
updatePrivacy('usr_123', 'private'); // Sadece private mesajlar
```

---

### QR Kod Oluşturma

```javascript
async function generateQRCode(userId) {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/user/${userId}/qr-code`
    );

    console.log('✅ QR kod verisi:');
    console.log('QR String:', response.data.qr_string);
    console.log('QR Data:', response.data.qr_data);

    // QR kod kütüphanesi ile görselleştir
    // const QRCode = require('qrcode');
    // await QRCode.toFile('messaging-qr.png', response.data.qr_string);

    return response.data;
  } catch (error) {
    console.error('❌ Hata:', error.response?.data || error.message);
  }
}

// Kullanım
generateQRCode('usr_123');
```

---

## 🔒 Güvenlik En İyi Uygulamaları

### 1. Anahtar Yönetimi
```javascript
// ✅ DOĞRU: Private key'leri asla sunucuya gönderme
const userKeys = {
  encryptionPublicKey: 'a1b2c3...',  // ✅ Paylaşılabilir
  encryptionPrivateKey: 'secret...'   // ❌ ASLA PAYLAŞMA!
};

// Private key'i güvenli sakla (örn: encrypted local storage)
localStorage.setItem(
  'encryption_private_key',
  encrypt(userKeys.encryptionPrivateKey, userPassword)
);
```

### 2. Mesaj Şifreleme
```javascript
// Client-side encryption örneği (tweetnacl kullanarak)
const nacl = require('tweetnacl');

function encryptMessage(message, recipientPublicKey, senderPrivateKey) {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  
  const encrypted = nacl.box(
    Buffer.from(message, 'utf8'),
    nonce,
    Buffer.from(recipientPublicKey, 'hex'),
    Buffer.from(senderPrivateKey, 'hex')
  );

  return {
    encrypted: Buffer.from(encrypted).toString('hex'),
    nonce: Buffer.from(nonce).toString('hex')
  };
}

function decryptMessage(encryptedHex, nonceHex, senderPublicKey, recipientPrivateKey) {
  const decrypted = nacl.box.open(
    Buffer.from(encryptedHex, 'hex'),
    Buffer.from(nonceHex, 'hex'),
    Buffer.from(senderPublicKey, 'hex'),
    Buffer.from(recipientPrivateKey, 'hex')
  );

  return Buffer.from(decrypted).toString('utf8');
}
```

### 3. Gizlilik Kontrolü
```javascript
async function canSendMessage(recipientId, senderWalletId) {
  const recipient = await getEncryptionKey(recipientId);
  
  if (recipient.messaging_privacy === 'private') {
    console.log('❌ Kullanıcı private mesajları kabul etmiyor');
    return false;
  }
  
  if (recipient.messaging_privacy === 'followers') {
    // Takipçi kontrolü yap
    const isFollower = await checkFollowerStatus(recipientId, senderWalletId);
    if (!isFollower) {
      console.log('❌ Sadece takipçiler mesaj gönderebilir');
      return false;
    }
  }
  
  console.log('✅ Mesaj gönderilebilir');
  return true;
}
```

---

## 🌐 Python Örnekleri

```python
import requests
import json

BASE_URL = 'http://localhost:3000'

# Kullanıcı oluştur
def create_user(nickname, email, password):
    response = requests.post(f'{BASE_URL}/api/user/create', json={
        'nickname': nickname,
        'email': email,
        'password': password,
        'name': 'Test',
        'surname': 'User'
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Kullanıcı oluşturuldu: {data['user']['nickname']}")
        print(f"Encryption Key: {data['user']['encryption_public_key']}")
        return data
    else:
        print(f"❌ Hata: {response.json()}")
        return None

# Encryption key al
def get_encryption_key(identifier):
    response = requests.get(f'{BASE_URL}/api/user/encryption-key/{identifier}')
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Key alındı: {data['nickname']}")
        return data['encryption_public_key']
    else:
        print(f"❌ Hata: {response.json()}")
        return None

# Kullanım
create_user('bob', 'bob@example.com', 'SecurePass456!')
key = get_encryption_key('bob')
```

---

## 📱 React/React Native Örneği

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function MessagingSetup() {
  const [privacy, setPrivacy] = useState('public');
  const [qrCode, setQrCode] = useState(null);

  const updatePrivacy = async (level) => {
    try {
      const response = await axios.post(
        `/api/user/${userId}/messaging-privacy`,
        { privacy: level }
      );
      setPrivacy(response.data.privacy);
      alert('✅ Gizlilik ayarı güncellendi!');
    } catch (error) {
      alert('❌ Hata: ' + error.message);
    }
  };

  const generateQR = async () => {
    try {
      const response = await axios.get(`/api/user/${userId}/qr-code`);
      setQrCode(response.data.qr_string);
    } catch (error) {
      alert('❌ Hata: ' + error.message);
    }
  };

  return (
    <div>
      <h2>Mesajlaşma Ayarları</h2>
      
      <select value={privacy} onChange={(e) => updatePrivacy(e.target.value)}>
        <option value="public">Herkese Açık</option>
        <option value="followers">Sadece Takipçiler</option>
        <option value="private">Özel</option>
      </select>

      <button onClick={generateQR}>QR Kod Oluştur</button>
      
      {qrCode && (
        <div>
          <QRCodeDisplay value={qrCode} />
          <p>{qrCode}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🔐 Güvenlik Kontrol Listesi

### Sunucu Tarafı
- [x] JWT secret environment variable'dan alınıyor
- [x] Password'ler bcrypt ile hash'leniyor
- [x] Private key'ler asla API'den dönmüyor
- [x] Encryption key'ler ayrı tutuluyor (signing key'lerden)
- [x] Rate limiting önerilir (production için)
- [x] HTTPS kullanımı zorunlu (production için)

### Client Tarafı
- [ ] Private key'leri güvenli sakla (encrypted storage)
- [ ] Mnemonic'i kullanıcıya yedeklet
- [ ] Mesajları client-side şifrele
- [ ] Public key'leri doğrula
- [ ] Gizlilik ayarlarını kontrol et

---

## 🚀 Hızlı Başlangıç

### 1. Kullanıcı Oluştur
```bash
curl -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "alice",
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }'
```

### 2. Encryption Key Al
```bash
curl http://localhost:3000/api/user/encryption-key/alice
```

### 3. Gizlilik Ayarla
```bash
curl -X POST http://localhost:3000/api/user/usr_123/messaging-privacy \
  -H "Content-Type: application/json" \
  -d '{"privacy": "followers"}'
```

### 4. QR Kod Oluştur
```bash
curl http://localhost:3000/api/user/usr_123/qr-code
```

---

## 📞 Destek

Sorularınız için:
- GitHub Issues: [TraceNet Repository](https://github.com/LodosLawson/TraceNet)
- Dokümantasyon: `/docs` klasörü
- API Örnekleri: `/examples` klasörü
