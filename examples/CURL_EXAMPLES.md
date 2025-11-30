# TraceNet API - cURL Kullanım Örnekleri

Bu dosya, TraceNet API endpoint'lerini cURL ile test etmek için hazır komutlar içerir.

**Not:** Node'un http://localhost:3000 adresinde çalıştığından emin olun.

---

## 1. RPC ENDPOINTS

### 1.1 Blockchain Durumunu Al
```bash
curl http://localhost:3000/rpc/status
```

### 1.2 Genesis Block'u Al
```bash
curl http://localhost:3000/rpc/block/0
```

### 1.3 Block'u Hash ile Al
```bash
curl http://localhost:3000/rpc/block/BLOCK_HASH_BURAYA
```

### 1.4 Transaction Detayları
```bash
curl http://localhost:3000/rpc/transaction/TX_ID_BURAYA
```

### 1.5 Cüzdan Bakiyesi
```bash
curl http://localhost:3000/rpc/balance/TRN1234567890...
```

### 1.6 Tüm Hesapları Listele
```bash
curl http://localhost:3000/rpc/accounts
```

### 1.7 Transfer Ücreti Hesapla
```bash
curl -X POST http://localhost:3000/rpc/calculateTransferFee \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_address": "TRN1234567890...",
    "amount": 10000000000,
    "priority": "STANDARD"
  }'
```

### 1.8 Transfer Gönder (Basitleştirilmiş)
```bash
curl -X POST http://localhost:3000/rpc/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_wallet": "TRNsender...",
    "to_wallet": "TRNrecipient...",
    "amount": 10000000000,
    "priority": "STANDARD",
    "sender_public_key": "PUBLIC_KEY",
    "sender_signature": "SIGNATURE"
  }'
```

---

## 2. WALLET ENDPOINTS

### 2.1 Yeni Cüzdan Oluştur
```bash
curl -X POST http://localhost:3000/api/wallet/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123"
  }'
```

### 2.2 Kullanıcının Cüzdanlarını Listele
```bash
curl http://localhost:3000/api/wallet/list/user123
```

### 2.3 Cüzdan Detayları (Bakiye ile)
```bash
curl http://localhost:3000/api/wallet/TRN1234567890...
```

### 2.4 Veri İmzala (Server-side)
```bash
curl -X POST http://localhost:3000/api/wallet/sign \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN1234567890...",
    "transaction_data": "DATA_TO_SIGN"
  }'
```

---

## 3. USER ENDPOINTS

### 3.1 Yeni Kullanıcı Oluştur
```bash
curl -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "alice",
    "name": "Alice",
    "surname": "Johnson",
    "birth_date": "1995-05-15"
  }'
```

### 3.2 Nickname ile Kullanıcı Bul
```bash
curl http://localhost:3000/api/user/nickname/alice
```

### 3.3 User ID ile Kullanıcı Bul
```bash
curl http://localhost:3000/api/user/USER_ID_BURAYA
```

### 3.4 Kullanıcı Ara
```bash
curl "http://localhost:3000/api/user/search?q=alice&limit=10"
```

### 3.5 Nickname Müsaitlik Kontrolü
```bash
curl http://localhost:3000/api/user/check-nickname/alice
```

---

## 4. CONTENT ENDPOINTS

### 4.1 Yeni İçerik Oluştur
```bash
curl -X POST http://localhost:3000/api/content/create \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN1234567890...",
    "content_type": "POST",
    "title": "İlk Gönderim",
    "description": "Bu benim ilk blockchain gönderim!",
    "tags": ["blockchain", "first-post"]
  }'
```

### 4.2 İçerik Detayları
```bash
curl http://localhost:3000/api/content/CONTENT_ID_BURAYA
```

### 4.3 Kullanıcının İçerikleri
```bash
curl "http://localhost:3000/api/content/user/TRN1234567890...?limit=20"
```

### 4.4 Global İçerik Akışı (Feed)
```bash
curl "http://localhost:3000/api/content/feed?limit=20&offset=0"
```

---

## 5. SOCIAL ENDPOINTS

### 5.1 İçerik Beğen
```bash
curl -X POST http://localhost:3000/api/social/like \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN1234567890...",
    "content_id": "CONTENT_ID"
  }'
```

### 5.2 Yorum Ekle
```bash
curl -X POST http://localhost:3000/api/social/comment \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_id": "TRN1234567890...",
    "content_id": "CONTENT_ID",
    "comment_text": "Harika bir gönderi!"
  }'
```

### 5.3 Kullanıcı Takip Et
```bash
curl -X POST http://localhost:3000/api/social/follow \
  -H "Content-Type: application/json" \
  -d '{
    "follower_wallet": "TRNfollower...",
    "target_wallet": "TRNtarget..."
  }'
```

### 5.4 Takibi Bırak
```bash
curl -X POST http://localhost:3000/api/social/unfollow \
  -H "Content-Type: application/json" \
  -d '{
    "follower_wallet": "TRNfollower...",
    "target_wallet": "TRNtarget..."
  }'
```

### 5.5 İçerik Beğenilerini Listele
```bash
curl http://localhost:3000/api/social/likes/CONTENT_ID
```

### 5.6 İçerik Yorumlarını Listele
```bash
curl http://localhost:3000/api/social/comments/CONTENT_ID
```

### 5.7 Takipçileri Listele
```bash
curl http://localhost:3000/api/social/followers/TRN1234567890...
```

### 5.8 Takip Edilenleri Listele
```bash
curl http://localhost:3000/api/social/following/TRN1234567890...
```

---

## 6. MESSAGING ENDPOINTS

### 6.1 Şifreli Mesaj Gönder
```bash
curl -X POST http://localhost:3000/api/messaging/send \
  -H "Content-Type: application/json" \
  -d '{
    "sender_wallet": "TRNsender...",
    "recipient_wallet": "TRNrecipient...",
    "encrypted_message": "nonce_hex:encrypted_data_hex"
  }'
```

**ÖNEMLİ:** Mesaj client-side şifrelenmeli! (KeyManager.encryptForUser kullanın)

### 6.2 Gelen Kutusu
```bash
curl http://localhost:3000/api/messaging/inbox/TRN1234567890...
```

**ÖNEMLİ:** Mesajların şifresini client-side çözün! (KeyManager.decryptFromUser kullanın)

---

## 7. VALIDATOR ENDPOINTS

### 7.1 Validator Kaydı
```bash
curl -X POST http://localhost:3000/api/validator/register \
  -H "Content-Type: application/json" \
  -d '{
    "validator_id": "validator_001",
    "user_id": "user123",
    "public_key": "PUBLIC_KEY_HEX"
  }'
```

### 7.2 Validator Cüzdanı Kaydet (YENİ - Ücret Dağıtımı İçin)
```bash
curl -X POST http://localhost:3000/api/validator/validator_001/wallet \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "TRN1234567890..."
  }'
```

### 7.3 Validator Cüzdanını Sorgula (YENİ)
```bash
curl http://localhost:3000/api/validator/validator_001/wallet
```

### 7.4 Heartbeat Gönder
```bash
curl -X POST http://localhost:3000/api/validator/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "validator_id": "validator_001"
  }'
```

### 7.5 Tüm Validator'ları Listele
```bash
curl http://localhost:3000/api/validator/list
```

### 7.6 Sadece Aktif Validator'ları Listele
```bash
curl "http://localhost:3000/api/validator/list?online=true"
```

---

## ORNEK TEST AKIŞI

### Adım 1: Kullanıcı Oluştur
```bash
USER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/user/create \
  -H "Content-Type: application/json" \
  -d '{
    "nickname": "testuser",
    "name": "Test",
    "surname": "User"
  }')

echo $USER_RESPONSE | jq .

WALLET_ID=$(echo $USER_RESPONSE | jq -r '.wallet.wallet_id')
echo "Wallet ID: $WALLET_ID"
```

### Adım 2: İçerik Oluştur
```bash
CONTENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/content/create \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet_id\": \"$WALLET_ID\",
    \"content_type\": \"POST\",
    \"title\": \"Test Gönderisi\",
    \"description\": \"Blockchain test içeriği\"
  }")

echo $CONTENT_RESPONSE | jq .

CONTENT_ID=$(echo $CONTENT_RESPONSE | jq -r '.content.content_id')
echo "Content ID: $CONTENT_ID"
```

### Adım 3: İçeriği Beğen
```bash
curl -X POST http://localhost:3000/api/social/like \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet_id\": \"$WALLET_ID\",
    \"content_id\": \"$CONTENT_ID\"
  }" | jq .
```

### Adım 4: Yorum Ekle
```bash
curl -X POST http://localhost:3000/api/social/comment \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet_id\": \"$WALLET_ID\",
    \"content_id\": \"$CONTENT_ID\",
    \"comment_text\": \"Harika bir test!\"
  }" | jq .
```

### Adım 5: İçerik Detaylarını Görüntüle
```bash
curl http://localhost:3000/api/content/$CONTENT_ID | jq .
```

---

## NOTLAR

1. **jq Kullanımı**: JSON yanıtları güzel formatta göstermek için `jq` kullanabilirsiniz:
   ```bash
   curl http://localhost:3000/rpc/status | jq .
   ```

2. **Verbose Mode**: Detaylı HTTP bilgisi için `-v` flag'i ekleyin:
   ```bash
   curl -v http://localhost:3000/rpc/status
   ```

3. **Save Response**: Yanıtı dosyaya kaydedin:
   ```bash
   curl http://localhost:3000/rpc/status > response.json
   ```

4. **Headers**: Custom header ekleyin:
   ```bash
   curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/...
   ```

5. **Timeout**: İstek zaman aşımı ayarlayın:
   ```bash
   curl --max-time 10 http://localhost:3000/rpc/status
   ```

---

## YENİ ÖZELLİKLER (Son Güncelleme)

### Ücret Yapısı Değişiklikleri
- Tüm işlem ücretleri 2 katına çıkarıldı
- MESSAGE_FEE: 200 (0.000002 LT)
- LIKE_FEE: 2000 (0.00002 LT)
- COMMENT_FEE: 2000 (0.00002 LT)
- FOLLOW_FEE: 100 (0.000001 LT)
- UNFOLLOW_FEE: 100 (0.000001 LT)

### Node Wallet Sistemi
- Validator'lar artık cüzdan kaydedebilir
- Ücretlerin %50'si node sahibine gider
- Genesis bloklarda ücret dağıtımı yok
- Sosyal işlemlerde: %50 node, %25 içerik sahibi, %25 sistem

---

## TROUBLESHOOTING

### Connection Refused Hatası
```bash
# Node çalışıyor mu kontrol et
curl http://localhost:3000/rpc/status

# Eğer çalışmıyorsa:
cd /path/to/TraceNet
npm run dev
```

### JSON Parse Hatası
```bash
# Body'yi doğru formatta gönderdiğinizden emin olun
# Doğru:
curl -X POST ... -d '{"key": "value"}'

# Yanlış:
curl -X POST ... -d {key: value}
```

### 404 Not Found
```bash
# Endpoint'in doğru olduğundan emin olun
# /rpc/ ile başlamalı veya /api/ ile başlamalı
```
