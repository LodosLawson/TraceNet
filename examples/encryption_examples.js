/**
 * TraceNet Şifreleme API Örnekleri
 * 
 * Bu dosya, TraceNet blockchain'inde şifreleme özelliklerinin
 * nasıl kullanılacağını gösteren pratik örnekler içerir.
 */

const axios = require('axios');
const nacl = require('tweetnacl');

const BASE_URL = 'http://localhost:3000';

// ============================================
// 1. KULLANICI OLUŞTURMA VE ANAHTAR YÖNETİMİ
// ============================================

/**
 * Yeni kullanıcı oluştur ve encryption key'lerini al
 */
async function createUserWithEncryption() {
    console.log('\n📝 Yeni kullanıcı oluşturuluyor...\n');

    try {
        const response = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'alice',
            email: 'alice@tracenet.com',
            password: 'SecurePassword123!',
            name: 'Alice',
            surname: 'Johnson',
            birth_date: '1995-06-15'
        });

        const { user, wallet, mnemonic } = response.data;

        console.log('✅ Kullanıcı başarıyla oluşturuldu!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👤 Kullanıcı Bilgileri:');
        console.log(`   User ID: ${user.user_id}`);
        console.log(`   Nickname: ${user.nickname}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log('\n🔐 Şifreleme Anahtarı:');
        console.log(`   Public Key: ${user.encryption_public_key}`);
        console.log(`   Privacy: ${user.messaging_privacy}`);
        console.log('\n💼 Wallet Bilgileri:');
        console.log(`   Wallet ID: ${wallet.wallet_id}`);
        console.log(`   Public Key: ${wallet.public_key}`);
        console.log('\n🔑 Mnemonic (GÜVENLİ SAKLAYIN!):');
        console.log(`   ${mnemonic}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return { user, wallet, mnemonic };
    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// 2. ENCRYPTION KEY ALMA
// ============================================

/**
 * Başka bir kullanıcının encryption key'ini al
 */
async function getEncryptionKey(identifier) {
    console.log(`\n🔍 ${identifier} için encryption key alınıyor...\n`);

    try {
        const response = await axios.get(
            `${BASE_URL}/api/user/encryption-key/${identifier}`
        );

        const data = response.data;

        console.log('✅ Encryption key başarıyla alındı!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`👤 Nickname: ${data.nickname}`);
        console.log(`🆔 User ID: ${data.user_id}`);
        console.log(`💼 Wallet ID: ${data.wallet_id}`);
        console.log(`🔐 Public Key: ${data.encryption_public_key}`);
        console.log(`🔒 Privacy: ${data.messaging_privacy}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return data;
    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// 3. GİZLİLİK AYARLARI
// ============================================

/**
 * Mesajlaşma gizlilik ayarını değiştir
 */
async function updateMessagingPrivacy(userId, privacyLevel) {
    console.log(`\n🔒 Gizlilik ayarı "${privacyLevel}" olarak değiştiriliyor...\n`);

    const validLevels = ['public', 'followers', 'private'];
    if (!validLevels.includes(privacyLevel)) {
        throw new Error(`Geçersiz gizlilik seviyesi. Geçerli değerler: ${validLevels.join(', ')}`);
    }

    try {
        const response = await axios.post(
            `${BASE_URL}/api/user/${userId}/messaging-privacy`,
            { privacy: privacyLevel }
        );

        console.log('✅ Gizlilik ayarı güncellendi!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔒 Yeni Ayar: ${response.data.privacy}`);

        const descriptions = {
            public: 'Herkes mesaj gönderebilir',
            followers: 'Sadece takipçiler mesaj gönderebilir',
            private: 'Kimse mesaj gönderemez'
        };
        console.log(`📝 Açıklama: ${descriptions[response.data.privacy]}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return response.data;
    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// 4. QR KOD OLUŞTURMA
// ============================================

/**
 * Mesajlaşma için QR kod verisi oluştur
 */
async function generateMessagingQRCode(userId) {
    console.log('\n📱 QR kod oluşturuluyor...\n');

    try {
        const response = await axios.get(`${BASE_URL}/api/user/${userId}/qr-code`);

        const { qr_data, qr_string } = response.data;

        console.log('✅ QR kod başarıyla oluşturuldu!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 QR Kod Verisi:');
        console.log(`   Type: ${qr_data.type}`);
        console.log(`   Nickname: ${qr_data.nickname}`);
        console.log(`   Wallet: ${qr_data.wallet_id}`);
        console.log(`   Encryption Key: ${qr_data.encryption_public_key.substring(0, 20)}...`);
        console.log(`   Privacy: ${qr_data.messaging_privacy}`);
        console.log('\n🔗 QR String:');
        console.log(`   ${qr_string}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // QR kod görselleştirme (opsiyonel)
        console.log('💡 QR kod görselleştirmek için:');
        console.log('   npm install qrcode');
        console.log('   const QRCode = require("qrcode");');
        console.log(`   QRCode.toFile("messaging-qr.png", "${qr_string}");\n`);

        return { qr_data, qr_string };
    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================
// 5. MESAJ ŞİFRELEME (CLIENT-SIDE)
// ============================================

/**
 * Mesajı şifrele (client-side encryption)
 */
function encryptMessage(message, recipientPublicKey, senderPrivateKey) {
    console.log('\n🔐 Mesaj şifreleniyor...\n');

    try {
        // Nonce oluştur (her mesaj için benzersiz)
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Mesajı şifrele
        const messageBytes = Buffer.from(message, 'utf8');
        const recipientKeyBytes = Buffer.from(recipientPublicKey, 'hex');
        const senderKeyBytes = Buffer.from(senderPrivateKey, 'hex');

        const encrypted = nacl.box(
            messageBytes,
            nonce,
            recipientKeyBytes,
            senderKeyBytes
        );

        const result = {
            encrypted: Buffer.from(encrypted).toString('hex'),
            nonce: Buffer.from(nonce).toString('hex')
        };

        console.log('✅ Mesaj başarıyla şifrelendi!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📝 Orijinal: "${message}"`);
        console.log(`🔐 Şifreli: ${result.encrypted.substring(0, 40)}...`);
        console.log(`🔢 Nonce: ${result.nonce}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return result;
    } catch (error) {
        console.error('❌ Şifreleme hatası:', error.message);
        throw error;
    }
}

/**
 * Şifreli mesajı çöz (client-side decryption)
 */
function decryptMessage(encryptedHex, nonceHex, senderPublicKey, recipientPrivateKey) {
    console.log('\n🔓 Mesaj çözülüyor...\n');

    try {
        const encryptedBytes = Buffer.from(encryptedHex, 'hex');
        const nonceBytes = Buffer.from(nonceHex, 'hex');
        const senderKeyBytes = Buffer.from(senderPublicKey, 'hex');
        const recipientKeyBytes = Buffer.from(recipientPrivateKey, 'hex');

        const decrypted = nacl.box.open(
            encryptedBytes,
            nonceBytes,
            senderKeyBytes,
            recipientKeyBytes
        );

        if (!decrypted) {
            throw new Error('Mesaj çözülemedi! Anahtarlar yanlış olabilir.');
        }

        const message = Buffer.from(decrypted).toString('utf8');

        console.log('✅ Mesaj başarıyla çözüldü!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📝 Mesaj: "${message}"`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return message;
    } catch (error) {
        console.error('❌ Çözme hatası:', error.message);
        throw error;
    }
}

// ============================================
// 6. UÇTAN UCA ŞİFRELEME ÖRNEĞİ
// ============================================

/**
 * Tam mesajlaşma akışı örneği
 */
async function endToEndMessagingExample() {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 UÇTAN UCA ŞİFRELEME ÖRNEĞİ');
    console.log('='.repeat(50));

    try {
        // 1. Alice ve Bob'u oluştur
        console.log('\n📝 Adım 1: Kullanıcılar oluşturuluyor...');

        // Alice oluştur
        const alice = await createUserWithEncryption();

        // Bob oluştur (nickname değiştir)
        const bobResponse = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'bob',
            email: 'bob@tracenet.com',
            password: 'SecurePassword456!',
            name: 'Bob',
            surname: 'Smith'
        });
        const bob = bobResponse.data;

        // 2. Alice, Bob'un encryption key'ini al
        console.log('\n🔍 Adım 2: Alice, Bob\'un encryption key\'ini alıyor...');
        const bobEncryptionKey = await getEncryptionKey('bob');

        // 3. Alice gizlilik ayarını değiştir
        console.log('\n🔒 Adım 3: Alice gizlilik ayarını değiştiriyor...');
        await updateMessagingPrivacy(alice.user.user_id, 'public');

        // 4. Alice QR kod oluştur
        console.log('\n📱 Adım 4: Alice QR kod oluşturuyor...');
        await generateMessagingQRCode(alice.user.user_id);

        // 5. Alice mesajı şifrele ve Bob'a gönder
        console.log('\n🔐 Adım 5: Alice mesajı şifreliyor...');

        // NOT: Gerçek uygulamada private key'ler client-side'da saklanır
        // Bu örnek için simüle ediyoruz
        const alicePrivateKey = '0'.repeat(64); // Simülasyon
        const message = 'Merhaba Bob! Bu şifreli bir mesaj.';

        const encrypted = encryptMessage(
            message,
            bobEncryptionKey.encryption_public_key,
            alicePrivateKey
        );

        // 6. Bob mesajı çöz
        console.log('\n🔓 Adım 6: Bob mesajı çözüyor...');
        const bobPrivateKey = '0'.repeat(64); // Simülasyon

        const decrypted = decryptMessage(
            encrypted.encrypted,
            encrypted.nonce,
            alice.user.encryption_public_key,
            bobPrivateKey
        );

        console.log('\n' + '='.repeat(50));
        console.log('✅ UÇTAN UCA ŞİFRELEME BAŞARILI!');
        console.log('='.repeat(50) + '\n');

    } catch (error) {
        console.error('\n❌ Örnek çalıştırılırken hata:', error.message);
    }
}

// ============================================
// 7. KULLANIM ÖRNEKLERİ
// ============================================

// Tek bir fonksiyon çalıştır
async function runSingleExample() {
    // Örnek 1: Kullanıcı oluştur
    // await createUserWithEncryption();

    // Örnek 2: Encryption key al
    // await getEncryptionKey('alice');

    // Örnek 3: Gizlilik ayarla
    // await updateMessagingPrivacy('usr_123', 'followers');

    // Örnek 4: QR kod oluştur
    // await generateMessagingQRCode('usr_123');

    // Örnek 5: Tam akış
    await endToEndMessagingExample();
}

// Programı çalıştır
if (require.main === module) {
    runSingleExample().catch(console.error);
}

// Export fonksiyonlar
module.exports = {
    createUserWithEncryption,
    getEncryptionKey,
    updateMessagingPrivacy,
    generateMessagingQRCode,
    encryptMessage,
    decryptMessage,
    endToEndMessagingExample
};
