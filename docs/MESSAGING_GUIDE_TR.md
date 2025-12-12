# TraceNet Güvenli Mesajlaşma Rehberi

Bu rehber, TraceNet üzerinde uçtan uca şifreli (E2EE) mesajlaşmanın teknik olarak nasıl yapıldığını adım adım anlatır.

## 1. Anahtarların Oluşturulması (Key Generation)

TraceNet'te her kullanıcının iki ayrı anahtar çifti vardır:
1.  **İmzalama (Signing)**: Transferleri onaylamak için (`Ed25519`).
2.  **Şifreleme (Encryption)**: Mesajları şifrelemek için (`Curve25519`).

Anahtarlarınızı 24 kelimelik gizli ifadenizden (mnemonic) türetirsiniz.

```typescript
import { KeyManager } from './src/blockchain/crypto/KeyManager';

// Cüzdanı oluştur (veya var olanı yükle)
// encryptionIndex: 0 (Varsayılan). Eğer anahtarınızı değiştirdiyseniz (Rotation), buraya yeni indexi yazın.
const wallet = KeyManager.generateWalletFromMnemonic("sizin 24 kelimelik gizli ifadeniz...", 0);

console.log("Benim Şifreleme Genel Anahtarım:", wallet.encryptionPublicKey);
console.log("Benim Şifreleme Özel Anahtarım:", wallet.encryptionPrivateKey);
```

---

## 2. Mesajın Şifrelenmesi (Encryption)

Bir mesaj gönderirken, mesajı **Alıcının Genel Anahtarı** ve **Sizin Özel Anahtarınız** ile şifrelemeniz gerekir. Bu "Authenticated Encryption" (Kimlik Doğrulamalı Şifreleme) sağlar.

```typescript
import { MessageEncryption } from './src/blockchain/crypto/MessageEncryption';

const mesajMetni = "Merhaba, bu gizli bir mesajdır!";
const aliciPublicKey = "alıcının_hex_formatındaki_public_keyi"; // Alıcının profilinden alınır

const sifreliVeri = MessageEncryption.encryptMessage(
    mesajMetni,
    aliciPublicKey,
    wallet.encryptionPrivateKey // Kendi özel anahtarınız (ÖNEMLİ: Kendi mesajınızı tekrar okuyabilmek için gerekli)
);

console.log("Şifreli İçerik:", sifreliVeri.encrypted_content);
console.log("Nonce (Rastgele):", sifreliVeri.nonce);
```

---

## 3. Blockchain'e Gönderme (Sending)

Şifrelenmiş mesajı bir işlem (Transaction) olarak ağa yayınlarsınız.

```typescript
const transaction = {
    type: 'PRIVATE_MESSAGE',
    to_wallet: "Alici_Cuzdan_Adresi",
    payload: {
        encrypted_message: sifreliVeri.encrypted_content,
        nonce: sifreliVeri.nonce,
        // Alıcı mesajı kimden geldiğini bilsin diye public key eklemek iyi bir pratiktir,
        // ancak Transaction içinde zaten 'sender_public_key' (imzalama anahtarı) bulunur.
        // Şifreleme anahtarını profil servisinden bulurlar.
    },
    timestamp: Date.now()
    // ... diğer işlem alanları (imza vb.)
};

// API ile gönder
// await api.post('/transactions/add', transaction);
```

---

## 4. Gelen Mesajı Okuma (Decryption)

Gelen bir mesajı okumak için **Kendi Özel Anahtarınız** ve **Göndericinin Genel Anahtarını** kullanırsınız.

```typescript
// 1. Gelen işlemden verileri al
const gelenSifreliMesaj = transaction.payload.encrypted_message;
const gelenNonce = transaction.payload.nonce;
const gonderenEncryptionKey = "gönderenin_şifreleme_public_keyi"; // Gönderenin profilinden sorgulanır

// 2. Mesajı birleştir
const encryptedObject = {
    encrypted_content: gelenSifreliMesaj,
    nonce: gelenNonce,
    ephemeral_public_key: "" // Artık boş, çünkü Authenticated Encryption kullanıyoruz
};

// 3. Şifreyi Çöz
const acikMesaj = MessageEncryption.decryptMessage(
    encryptedObject,
    wallet.encryptionPrivateKey, // Sizin özel anahtarınız
    gonderenEncryptionKey        // Gönderenin genel anahtarı
);

if (acikMesaj) {
    console.log("Okunan Mesaj:", acikMesaj);
} else {
    console.error("Şifre çözülemedi! Yanlış anahtar veya bozuk veri.");
}
```

---

## 5. Kendi Mesajınızı Okuma

Kendi gönderdiğiniz ("Giden Kutusu") mesajlarını okumak için mantık aynıdır, sadece **Roller Değişir**:
*   **Alıcı**: Sizsiniz (Kendi Özel Anahtarınız).
*   **Gönderen**: Karşı Taraf (Karşı tarafın Genel Anahtarı - çünkü şifreleme `Siz + O` arasındaki ortak sır ile yapıldı).

```typescript
// Kendi gönderdiğiniz mesajı okurken:
const kendiMesajim = MessageEncryption.decryptMessage(
    encryptedObject,
    wallet.encryptionPrivateKey, // Yine SİZİN özel anahtarınız
    aliciPublicKey               // Mesajı kime gönderdiyseniz ONUN genel anahtarı
);
```
