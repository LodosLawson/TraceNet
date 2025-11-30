# TraceNet Mesajlaşma Şifreleme Örnekleri

Bu klasörde blockchain'den şifreli mesaj okuma, şifre çözme ve tüm API endpoint kullanım örnekleri bulunmaktadır.

## 📁 Dosyalar

### 1. `api_examples.js` **[YENİ!]**
**Tüm API endpoint'lerinin kullanım örnekleri** - 7 kategori, 40+ endpoint

**Kapsamı:**
- ✅ RPC Endpoints (blockchain core)
- ✅ Wallet Management
- ✅ User Profiles
- ✅ Content Management
- ✅ Social Interactions (like, comment, follow)
- ✅ Encrypted Messaging
- ✅ Validator Management (node wallet dahil)

**Çalıştırma:**
```bash
# Bağımlılıkları yükle
npm install axios

# Node'u başlat (başka terminal)
npm run dev

# Örnekleri çalıştır
node examples/api_examples.js
```

### 2. `CURL_EXAMPLES.md` **[YENİ!]**
**cURL ile API kullanım örnekleri** - Terminal'den hızlı test için

**İçerik:**
- Hazır cURL komutları
- Tüm endpoint'ler için örnekler
- Test akışı senaryoları
- Troubleshooting

**Kullanım:**
```bash
# Örneğin status kontrolü
curl http://localhost:3000/rpc/status | jq .

# Yeni kullanıcı oluştur
curl -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{"nickname": "alice", "name": "Alice"}'
```

### 3. `decrypt_blockchain_messages.ts` (TypeScript)
Tam özellikli örnek - TraceNet blockchain sistemini kullanarak şifreli mesajların nasıl okunup çözüleceğini gösterir.

**Özellikler:**
- ✅ Gerçek blockchain kullanımı
- ✅ Birden fazla mesaj gönderme/okuma
- ✅ Detaylı açıklamalar
- ✅ Zaman damgalı mesajlar

**Çalıştırma:**
```bash
npm run ts-node examples/decrypt_blockchain_messages.ts
```

### 2. `simple_message_decrypt.js` (JavaScript)
Basitleştirilmiş örnek - Sadece şifreleme/şifre çözme mekanizmasını gösterir.

**Özellikler:**
- ✅ Minimal bağımlılık
- ✅ Anlaması kolay
- ✅ Simüle edilmiş blockchain
- ✅ Hata senaryoları

**Çalıştırma:**
```bash
# Önce bağımlılıkları yükle (sadece bir kez)
npm install tweetnacl

# Örneği çalıştır
node examples/simple_message_decrypt.js
```

## 🔐 Şifreleme Nasıl Çalışır?

### Alice → Bob Mesaj Gönderme

```javascript
// 1. Alice mesajı şifreler
const encrypted = encryptMessage(
    "Merhaba Bob!",
    alice.privateKey,      // Alice'in private key'i
    bob.publicKey          // Bob'un public key'i
);

// 2. Blockchain'e kaydedilir (şifreli halde)
blockchain.addTransaction({
    from: alice.address,
    to: bob.address,
    encrypted_message: encrypted
});
```

### Bob Mesajı Okuma

```javascript
// 1. Blockchain'den Bob'a gönderilen mesajları bul
const messages = blockchain.findMessagesFor(bob.address);

// 2. Her mesajın şifresini çöz
messages.forEach(msg => {
    const decrypted = decryptMessage(
        msg.encrypted_message,
        bob.privateKey,       // Bob'un private key'i
        alice.publicKey       // Alice'in public key'i
    );
    
    console.log(decrypted); // "Merhaba Bob!"
});
```

## 🔑 Anahtar Yönetimi

Her kullanıcı cüzdanı **2 anahtar çifti** içerir:

### 1. İmza Anahtarları (Ed25519)
```
publicKey: "a1b2c3d4..."     → İşlem imzalarını doğrula
privateKey: "e5f6g7h8..."    → İşlemleri imzala (GİZLİ!)
```

### 2. Şifreleme Anahtarları (Curve25519)
```
encryptionPublicKey: "x1y2z3..."   → Mesaj almak için kullan
encryptionPrivateKey: "w4v5u6..."  → Mesajları aç (GİZLİ!)
```

## 📊 Güvenlik

### ✅ Uçtan Uca Şifreleme
- Sadece gönderen ve alıcı mesajı okuyabilir
- Blockchain düğümleri mesajı okuyamaz
- Validatörler mesajı okuyamaz

### ✅ Authenticated Encryption
- Mesajın kimden geldiği doğrulanır
- Mesaj değiştirilemez (Poly1305 MAC)
- Replay saldırıları önlenir (Nonce)

### ❌ Sınırlamalar
- Forward secrecy yok (aynı anahtarlar kullanılıyor)
- Grup mesajlaşma yok (1-1 mesajlaşma)
- Anahtar kaybedilirse mesajlar okunamaz

## 🧪 Test Senaryoları

### Senaryo 1: Temel Mesajlaşma
```bash
node examples/simple_message_decrypt.js
```
- Alice → Bob: 5 mesaj
- Tüm mesajlar başarıyla şifrelenir ve açılır

### Senaryo 2: Yanlış Anahtar
```bash
# simple_message_decrypt.js içinde bonus bölüm
```
- Charlie, Bob'un mesajını okumaya çalışır
- Şifre çözme başarısız olur (güvenlik testi)

### Senaryo 3: Çoklu Kullanıcı
```bash
npm run ts-node examples/decrypt_blockchain_messages.ts
```
- Gerçek blockchain üzerinde test
- Birden fazla mesaj
- Zaman damgalı sıralama

## 📖 API Referansı

### `encryptMessage(message, senderPrivateKey, recipientPublicKey)`
Mesajı şifreler (Alice → Bob)

**Parametreler:**
- `message` (string): Şifrelenecek mesaj
- `senderPrivateKey` (hex string): Gönderenin private key'i
- `recipientPublicKey` (hex string): Alıcının public key'i

**Döner:** `string` - Format: `"nonce:encryptedData"`

### `decryptMessage(encryptedMessage, recipientPrivateKey, senderPublicKey)`
Mesajın şifresini çözer (Bob ← Alice)

**Parametreler:**
- `encryptedMessage` (string): Format: `"nonce:encryptedData"`
- `recipientPrivateKey` (hex string): Alıcının private key'i
- `senderPublicKey` (hex string): Gönderenin public key'i

**Döner:** `string` - Orijinal mesaj

**Hata:** `Error` - Şifre çözme başarısız

## 🛠️ Troubleshooting

### Hata: "Invalid encrypted message format"
**Sebep:** Şifreli mesaj formatı yanlış
**Çözüm:** Mesajın `"nonce:data"` formatında olduğundan emin olun

### Hata: "Failed to decrypt message"
**Sebep:** Yanlış anahtarlar veya bozuk veri
**Çözüm:**
- Doğru private/public key kullanıldığından emin olun
- Gönderen ve alıcı anahtarlarının eşleştiğini kontrol edin

### Hata: "Module not found: tweetnacl"
**Sebep:** Bağımlılık yüklenmemiş
**Çözüm:**
```bash
npm install tweetnacl
```

## 📚 Daha Fazla Bilgi

Detaylı şifreleme açıklaması için:
```
C:\Users\mehem\.gemini\antigravity\brain\[conversation-id]\sifreleme_aciklama.md
```

## 💡 Öneriler

1. **Private Key'leri Saklamayın**: Kodda private key saklamamaya dikkat edin
2. **Güvenli Depolama**: Private key'leri güvenli bir şekilde saklayın
3. **Anahtar Yedekleme**: Mnemonic (24 kelime) yedekleyin
4. **Test Edin**: Üretim ortamına geçmeden önce test edin

## 🤝 Katkıda Bulunma

Örnekleri geliştirmek için pull request gönderebilirsiniz!
