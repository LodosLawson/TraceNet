# TraceNet Bağlantı ve İletişim Protokolü Dokümantasyonu

Bu belge, TraceNet blok zinciri ile etkileşime geçecek uygulamaların (Web, Mobil, Bot vb.) uyması gereken teknik standartları, bağlantı noktalarını ve veri yapılarını **en ince detayına kadar** açıklar. Amacımız, tüm entegrasyon detaylarını tek bir kaynakta toplamaktır.

## 1. Ağ Bağlantı Noktaları (Network Endpoints)

Uygulamaların TraceNet düğümleri (Node) ile konuşmak için kullanacağı temel adresler.

### HTTP REST API
Standart sorgular ve işlem gönderimi için kullanılır.

*   **Base URL (Localhost):** `http://localhost:3000`
*   **Base URL (Testnet):** `https://testnet-node.tracenet.org` (Örnek)
*   **Content-Type:** Tüm POST istekleri `application/json` formatında olmalıdır.

| Metot | Endpoint | Açıklama |
| :--- | :--- | :--- |
| `GET` | `/rpc/status` | Blok zinciri durumunu ve son blok bilgisini çeker. |
| `GET` | `/rpc/balance/{address}` | Belirtilen cüzdan adresinin güncel bakiyesini döner. |
| `POST` | `/rpc/calculateTransferFee` | Transfer için dinamik işlem ücretini hesaplar. |
| `POST` | `/rpc/sendRawTx` | İmzalanmış işlemi (transaction) ağa yayınlar. |
| `POST` | `/api/messaging/send` | Şifreli mesaj gönderimi için özelleşmiş endpoint. |

### WebSocket (Gerçek Zamanlı Veri)
Anlık bildirimler, yeni bloklar ve işlem onayları için kullanılır.

*   **Socket.IO URL:** `http://localhost:3000` (veya sunucu adresi)
*   **Bağlantı:** Standart `socket.io-client` kütüphanesi ile bağlanılır.

#### Olaylar (Events)

Sunucuya gönderilen (Emit) olaylar:
*   **`subscribe`**: Belirli olayları dinlemek için abone olunur.
    *   Payload: `{ "events": ["newBlock", "txConfirmed"] }`

Sunucudan gelen (Listen) olaylar:
*   **`newBlock`**: Yeni bir blok kazıldığında tetiklenir.
    *   Payload: `{ "block": BlockJSON, "producer_id": string, "transaction_count": number }`
*   **`txConfirmed`**: Bir işlem onaylandığında tetiklenir.
    *   Payload: `{ "tx_id": string, "block_index": number, "block_hash": string }`
*   **`signRequest`**: (Validatorlar için) Çoklu imza gerektiren işlemlerde imza isteği.

---

## 2. Kriptografik Standartlar (Cryptography)

TraceNet güvenliği için kullanılan algoritmalar ve kütüphaneler kesindir. Farklı bir kütüphane kullanıyorsanız bu standartlara birebir uymalısınız.

### Temel Kütüphaneler
*   **JS/TS:** `tweetnacl` (veya `libsodium` wrapperları), `bip39`, `@scure/bip32`.

### Anahtar Türetimi (Key Derivation)
TraceNet cüzdanları 24 kelimelik BIP39 Mnemonic kullanır.

1.  **Mnemonic to Seed:** `bip39.mnemonicToSeedSync(mnemonic)` -> 64 byte Seed.
2.  **İmzalama Anahtarları (Signing Keys):**
    *   **Algoritma:** Ed25519
    *   **Kaynak:** Seed'in ilk 32 byte'ı (`seed.slice(0, 32)`).
    *   **Kullanım:** İşlemleri imzalamak için.
3.  **Şifreleme Anahtarları (Encryption Keys):**
    *   **Algoritma:** X25519 (Curve25519)
    *   **Türetme Yolu (Path):** `m/44'/0'/0'/1'/0'` (Standart BIP32 HD Path)
    *   **Not:** İndeks numarası (sondaki `0`), anahtar rotasyonu (key rotation) yapıldığında artırılır.
    *   **Dönüşüm:** Türetilen private key'den `nacl.box.keyPair.fromSecretKey` ile Curve25519 çifti oluşturulur.

### Adres Formatı
Cüzdan adresi, imzalama public key'inden türetilir.
*   **Formül:** `'TRN' + SHA256(Hex(Ed25519PublicKey)).substring(0, 40)`
*   **Örnek:** `TRN7f8a9b...`

---

## 3. İşlem Yapısı (Transaction Structure)

Ağa gönderilecek her işlem aşağıdaki JSON yapısında olmalıdır.

### JSON Modeli
```json
{
  "tx_id": "8a7f...",           // SHA256(from + to + amount + timestamp)
  "from_wallet": "TRN...",      // Gönderen Adresi
  "to_wallet": "TRN...",        // Alıcı Adresi
  "type": "TRANSFER",           // İşlem Tipi (Enum)
  "amount": 100,                // Miktar
  "fee": 1,                     // İşlem Ücreti
  "timestamp": 1715421234567,   // Unix Timestamp (ms)
  "payload": {},                // Tipe özel ek veri (örn: { encrypted_message: "..." })
  "sender_public_key": "abc...",// Gönderen Ed25519 Public Key (Hex)
  "sender_signature": "def..."  // İMZA (Aşağıda detaylandırılmıştır)
}
```

### Değişmez İşlem Tipleri (Transaction Types)
*   `TRANSFER`: Coin transferi.
*   `PRIVATE_MESSAGE`: Şifreli mesaj.
*   `MESSAGE_PAYMENT`: Ödemeli mesaj.
*   `PROFILE_UPDATE`: Kullanıcı profil/anahtar güncellemesi.
*   `POST_CONTENT`: İçerik paylaşımı.
*   `LIKE`, `COMMENT`, `FOLLOW`: Sosyal etkileşimler.

### İmzalama Süreci (Signing Process)
Bir işlemi imzalamadan önce veriler `JSON.stringify` ile string'e çevrilir. **Sıralama ve format çok önemlidir.**

**İmzanacak Veri Sırası:**
```json
{
    "tx_id": "...",
    "from_wallet": "...",
    "to_wallet": "...",
    "type": "...",
    "payload": {...},
    "amount": ...,
    "fee": ...,
    "timestamp": ...,
    "sender_public_key": "..."
}
```
*   **Algoritma:** `nacl.sign.detached(messageBuffer, privateKey)`
*   **Sonuç:** Hex string olarak `sender_signature` alanına eklenir.

---

## 4. Mesajlaşma Protokolü (Messaging Protocol)

TraceNet üzerindeki mesajlar uçtan uca şifrelidir (E2EE). Sunucu mesaj içeriğini asla göremez.

### Şifreleme Formatı
Mesajlar `Authenticated Encryption` (nacl.box) kullanır.

*   **Format:** `Hex(Nonce):Hex(Ciphertext)`
*   **Ayraç:** İki nokta üst üste (`:`) karakteri.

### Gönderme Adımları (Şifreleme)
1.  **Hazırlık:**
    *   Mesaj: `M` (UTF-8 string)
    *   Alıcı Public Key (Curve25519): `Pub_R`
    *   Gönderen Private Key (Curve25519): `Priv_S`
2.  **Nonce:** 24 byte rastgele veri üretilir (`nacl.randomBytes(24)`).
3.  **Şifreleme:** `Cipher = nacl.box(M, Nonce, Pub_R, Priv_S)`
4.  **Paketleme:** `String = ToHex(Nonce) + ":" + ToHex(Cipher)`
5.  **Payload:** İşlem payload'ına `{ "message": String, "encrypted": true }` olarak eklenir.

### Okuma Adımları (Deşifreleme)
1.  **Parse:** Gelen string `:` ile bölünür -> `Nonce` ve `Cipher`.
2.  **Deşifreleme:** `M = nacl.box.open(Cipher, Nonce, Pub_S, Priv_R)`
    *   `Pub_S`: Mesajı gönderenin Public Key'i (Curve25519).
    *   `Priv_R`: Alıcının (sizin) Private Key'iniz.
3.  **Sonuç:** `M` string'e çevrilir. Eğer `null` dönerse, mesaj veya gönderen sahtedir.

---

## 5. Örnek Akış: Para Transferi

1.  **Ücret Hesapla:** `/rpc/calculateTransferFee` ile tahmini ücreti al.
2.  **Tx ID Üret:** `SHA256(from + to + amount + timestamp)`.
3.  **Nesneyi Oluştur:** `TransactionModel` yapısında JSON hazırla.
4.  **İmzala:** `signer_public_key` alanını ekle ve tüm nesneyi stringify edip imzala.
5.  **Gönder:** `/rpc/sendRawTx` adresine POST et.
6.  **Takip Et:** WebSocket `txConfirmed` olayı ile onaylanmasını bekle.
