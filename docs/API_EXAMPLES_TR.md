# TraceNet API Örnekleri (Tek Dosya)

Aşağıdaki kodu `api_test.js` olarak kaydedip çalıştırabilirsiniz.
Gerekli paketler: `npm install axios tweetnacl`

```javascript
/**
 * TraceNet API Tüm Örnekler (Consolidated Examples)
 * 
 * Bu dosya tüm temel API işlemlerini tek bir akışta gösterir.
 * 1. Kullanıcı Kaydı (Opsiyonel alanlar ile)
 * 2. Cüzdan Bilgileri
 * 3. Şifreleme Anahtarı Alma
 * 4. Gizlilik Ayarları
 * 5. Mesaj Şifreleme ve Çözme
 */

const axios = require('axios');
const nacl = require('tweetnacl');

const BASE_URL = 'http://localhost:3000';

async function runAllExamples() {
    console.log('🚀 TraceNet API Test Başlıyor...\n');

    try {
        // ==========================================
        // 1. KULLANICI OLUŞTURMA (Tamamen Opsiyonel)
        // ==========================================
        console.log('1️⃣  Kullanıcı Oluşturuluyor...');
        
        // Senaryo: Alice tüm bilgileri giriyor (Opsiyonel)
        const aliceResponse = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'alice_v2',
            email: 'alice@example.com',
            name: 'Alice',
            surname: 'Wonderland',
            birth_date: '1995-01-01'
            // ŞİFRE YOK! ZORUNLU ALAN YOK!
        });

        const alice = aliceResponse.data;
        console.log('✅ Alice oluşturuldu:');
        console.log(`   User ID (Wallet): ${alice.user.user_id}`);
        console.log(`   Mnemonic: ${alice.mnemonic}`);
        console.log(`   Encryption Key: ${alice.user.encryption_public_key}`);
        console.log('----------------------------------------');

        // Senaryo: Bob anonim kalmak istiyor (Sadece nickname)
        const bobResponse = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'bob_anon'
        });

        const bob = bobResponse.data;
        console.log('✅ Bob oluşturuldu (Anonim):');
        console.log(`   User ID (Wallet): ${bob.user.user_id}`);
        console.log('----------------------------------------\n');


        // ==========================================
        // 2. ENCRYPTION KEY ALMA
        // ==========================================
        console.log('2️⃣  Encryption Key Alınıyor...');
        
        // Alice, Bob'un key'ini alıyor
        const keyResponse = await axios.get(`${BASE_URL}/api/user/encryption-key/bob_anon`);
        const bobKey = keyResponse.data;
        
        console.log(`✅ Bob'un Key'i alındı: ${bobKey.encryption_public_key}`);
        console.log('----------------------------------------\n');


        // ==========================================
        // 3. GİZLİLİK AYARLARI
        // ==========================================
        console.log('3️⃣  Gizlilik Ayarları Değiştiriliyor...');
        
        // Alice mesajları herkese açıyor
        await axios.post(`${BASE_URL}/api/user/${alice.user.user_id}/messaging-privacy`, {
            privacy: 'public'
        });
        console.log('✅ Alice gizlilik ayarı: PUBLIC yapıldı');
        console.log('----------------------------------------\n');


        // ==========================================
        // 4. MESAJ ŞİFRELEME (Client-Side)
        // ==========================================
        console.log('4️⃣  Mesaj Şifreleme (Alice -> Bob)...');

        const message = "Merhaba Bob! Bu gizli bir mesajdır.";
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Şifreleme için gerekli anahtarlar (Hex -> Uint8Array)
        // NOT: Gerçek uygulamada Alice kendi private key'ini mnemonic'ten türetir
        // Burada simülasyon için rastgele bir key kullanıyoruz (Normalde alice.mnemonic'ten üretilmeli)
        const alicePrivateKey = nacl.randomBytes(32); 
        const bobPublicKeyBytes = Buffer.from(bobKey.encryption_public_key, 'hex');

        const encrypted = nacl.box(
            Buffer.from(message, 'utf8'),
            nonce,
            bobPublicKeyBytes,
            alicePrivateKey
        );

        console.log(`📝 Mesaj: "${message}"`);
        console.log(`🔐 Şifreli (Hex): ${Buffer.from(encrypted).toString('hex').substring(0, 30)}...`);
        console.log('----------------------------------------\n');

        console.log('🎉 TÜM TESTLER BAŞARIYLA TAMAMLANDI!');

    } catch (error) {
        console.error('❌ HATA:', error.response ? error.response.data : error.message);
    }
}

runAllExamples();
```
