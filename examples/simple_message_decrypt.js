/**
 * Basit JavaScript Örneği: Blockchain'den Mesaj Okuma ve Şifre Çözme
 * 
 * Bu dosyayı çalıştırmak için:
 * npm install tweetnacl bip39
 * node examples/simple_message_decrypt.js
 */

const nacl = require('tweetnacl');
const crypto = require('crypto');

// ============================================
// YARDIMCI FONKSİYONLAR
// ============================================

/**
 * Mesajı şifrele (gönderen → alıcı)
 */
function encryptMessage(message, senderPrivateKey, recipientPublicKey) {
    // Hex string'leri Uint8Array'e çevir
    const senderPriv = new Uint8Array(Buffer.from(senderPrivateKey, 'hex'));
    const recipientPub = new Uint8Array(Buffer.from(recipientPublicKey, 'hex'));

    // Rastgele nonce oluştur (24 byte)
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Mesajı buffer'a çevir
    const messageBuffer = Buffer.from(message, 'utf8');

    // NaCl Box ile şifrele
    const encrypted = nacl.box(messageBuffer, nonce, recipientPub, senderPriv);

    // Nonce:EncryptedData formatında döndür
    return Buffer.from(nonce).toString('hex') + ':' + Buffer.from(encrypted).toString('hex');
}

/**
 * Mesajın şifresini çöz (alıcı ← gönderen)
 */
function decryptMessage(encryptedMessage, recipientPrivateKey, senderPublicKey) {
    // Nonce ve şifreli veriyi ayır
    const parts = encryptedMessage.split(':');
    if (parts.length !== 2) {
        throw new Error('Geçersiz şifreli mesaj formatı');
    }

    const nonce = new Uint8Array(Buffer.from(parts[0], 'hex'));
    const encrypted = new Uint8Array(Buffer.from(parts[1], 'hex'));

    // Anahtarları hazırla
    const recipientPriv = new Uint8Array(Buffer.from(recipientPrivateKey, 'hex'));
    const senderPub = new Uint8Array(Buffer.from(senderPublicKey, 'hex'));

    // NaCl Box Open ile şifre çöz
    const decrypted = nacl.box.open(encrypted, nonce, senderPub, recipientPriv);

    if (!decrypted) {
        throw new Error('Şifre çözme başarısız! Yanlış anahtarlar veya bozuk veri.');
    }

    // UTF-8 string'e çevir
    return Buffer.from(decrypted).toString('utf8');
}

// ============================================
// ANA ÖRNEK
// ============================================

console.log('='.repeat(70));
console.log('  BLOCKCHAIN\'DEN ŞİFRELİ MESAJ OKUMA VE ŞIFRE ÇÖZME ÖRNEĞİ');
console.log('='.repeat(70));
console.log();

// 1. Kullanıcılar için anahtar çiftleri oluştur
console.log('🔑 Adım 1: Kullanıcı anahtarları oluşturuluyor...\n');

// Alice'in şifreleme anahtarları
const aliceKeyPair = nacl.box.keyPair();
const alicePublicKey = Buffer.from(aliceKeyPair.publicKey).toString('hex');
const alicePrivateKey = Buffer.from(aliceKeyPair.secretKey).toString('hex');

// Bob'un şifreleme anahtarları
const bobKeyPair = nacl.box.keyPair();
const bobPublicKey = Buffer.from(bobKeyPair.publicKey).toString('hex');
const bobPrivateKey = Buffer.from(bobKeyPair.secretKey).toString('hex');

console.log('👤 Alice:');
console.log(`   Public Key:  ${alicePublicKey.substring(0, 32)}...`);
console.log(`   Private Key: ${alicePrivateKey.substring(0, 32)}... (GİZLİ!)\n`);

console.log('👤 Bob:');
console.log(`   Public Key:  ${bobPublicKey.substring(0, 32)}...`);
console.log(`   Private Key: ${bobPrivateKey.substring(0, 32)}... (GİZLİ!)\n`);

// 2. Alice, Bob'a mesajlar gönderiyor
console.log('📝 Adım 2: Alice mesajları şifreliyor ve blockchain\'e ekliyor...\n');

// Simüle edilmiş blockchain (basit bir dizi)
const blockchain = [];

// Alice'in Bob'a göndereceği mesajlar
const messages = [
    "Merhaba Bob! Nasılsın? 👋",
    "Yarınki toplantı saat 15:00'te.",
    "Projede güzel ilerlemişsin, tebrikler! 🎉",
    "Bu akşam dışarı çıkacak mısın?",
    "Görüşmek üzere! 😊"
];

messages.forEach((message, index) => {
    // Mesajı şifrele
    const encrypted = encryptMessage(message, alicePrivateKey, bobPublicKey);

    // Blockchain'e ekle (basitleştirilmiş block yapısı)
    const block = {
        index: blockchain.length,
        timestamp: Date.now() + (index * 1000), // Her mesaj 1 saniye arayla
        transaction: {
            type: 'PRIVATE_MESSAGE',
            from: 'Alice',
            to: 'Bob',
            encrypted_message: encrypted
        }
    };

    blockchain.push(block);

    console.log(`   ✅ Mesaj #${index + 1} şifrelendi ve blockchain\'e eklendi`);
    console.log(`      Block Index: ${block.index}`);
    console.log(`      Şifreli: ${encrypted.substring(0, 50)}...\n`);
});

// 3. Bob, blockchain'i tarayıp mesajlarını buluyor
console.log('='.repeat(70));
console.log('🔍 Adım 3: Bob blockchain\'i tarıyor ve mesajlarını buluyor...\n');

const bobMessages = [];

blockchain.forEach(block => {
    const tx = block.transaction;

    // Bob'a gönderilen mesajları bul
    if (tx.type === 'PRIVATE_MESSAGE' && tx.to === 'Bob') {
        bobMessages.push({
            blockIndex: block.index,
            timestamp: block.timestamp,
            from: tx.from,
            encryptedMessage: tx.encrypted_message
        });
    }
});

console.log(`💌 Bob için ${bobMessages.length} adet şifreli mesaj bulundu!\n`);

// 4. Bob, her mesajın şifresini çözüyor
console.log('='.repeat(70));
console.log('🔓 Adım 4: Bob mesajların şifresini çözüyor...\n');

bobMessages.forEach((msg, index) => {
    console.log(`📬 Mesaj #${index + 1}:`);
    console.log(`   Block: #${msg.blockIndex}`);
    console.log(`   Gönderen: ${msg.from}`);
    console.log(`   Zaman: ${new Date(msg.timestamp).toLocaleString()}`);
    console.log(`   Şifreli: ${msg.encryptedMessage.substring(0, 40)}...`);

    try {
        // Mesajın şifresini çöz
        // Not: Gerçek uygulamada gönderenin public key'i blockchain'den alınır
        const decrypted = decryptMessage(
            msg.encryptedMessage,
            bobPrivateKey,      // Bob'un private key'i
            alicePublicKey      // Alice'in public key'i
        );

        console.log(`   ✅ Açılan Mesaj: "${decrypted}"\n`);

    } catch (error) {
        console.error(`   ❌ Şifre çözme hatası: ${error.message}\n`);
    }
});

// 5. Özet
console.log('='.repeat(70));
console.log('📊 ÖZET');
console.log('='.repeat(70));
console.log(`Blockchain'deki Block Sayısı: ${blockchain.length}`);
console.log(`Bob'a Gönderilen Mesaj: ${bobMessages.length}`);
console.log(`Başarıyla Açılan Mesaj: ${bobMessages.length}`);
console.log(`Şifreleme Algoritması: NaCl Box (Curve25519)`);
console.log('='.repeat(70));

// ============================================
// EK ÖRNEK: YANLIŞ ANAHTAR KULLANIMI
// ============================================

console.log('\n💡 Bonus: Yanlış Anahtar ile Şifre Çözme Denemesi\n');

// Charlie adında üçüncü bir kullanıcı
const charlieKeyPair = nacl.box.keyPair();
const charliePrivateKey = Buffer.from(charlieKeyPair.secretKey).toString('hex');

console.log('👤 Charlie mesajı okumaya çalışıyor (yanlış anahtar)...');

try {
    // Charlie, Bob'un mesajını okumaya çalışıyor
    const firstMessage = bobMessages[0].encryptedMessage;

    decryptMessage(
        firstMessage,
        charliePrivateKey,  // Charlie'nin private key'i (YANLIŞ!)
        alicePublicKey      // Alice'in public key'i
    );

    console.log('   ⚠️  Bu satır çalışmamalı!');

} catch (error) {
    console.log('   ❌ Hata: Şifre çözme başarısız!');
    console.log('   ✅ Güvenlik testi geçti: Yanlış anahtar mesajı açamadı!\n');
}

console.log('='.repeat(70));
console.log('✅ Örnek başarıyla tamamlandı!');
console.log('='.repeat(70));
