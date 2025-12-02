/**
 * TraceNet - Kullanıcı Oluşturma Örneği
 * 
 * Bu örnek, TraceNet API'sini kullanarak nasıl yeni kullanıcı oluşturulacağını gösterir.
 * Hem tam bilgi ile hem de minimal bilgi ile kayıt senaryolarını içerir.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// ============================================================================
// SENARYO 1: TAM BİLGİ İLE KAYIT
// ============================================================================
async function createUserWithFullInfo() {
    console.log('\n🔷 SENARYO 1: Tam Bilgi ile Kullanıcı Oluşturma\n');

    try {
        const response = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'alice_wonderland',
            email: 'alice@example.com',
            name: 'Alice',
            surname: 'Wonderland',
            birth_date: '1995-01-15'
        });

        const { user, wallet, mnemonic, airdrop_amount } = response.data;

        console.log('✅ Kullanıcı başarıyla oluşturuldu!');
        console.log('\n📋 Kullanıcı Bilgileri:');
        console.log(`   User ID: ${user.user_id}`);
        console.log(`   Nickname: ${user.nickname}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   İsim: ${user.first_name} ${user.last_name}`);

        console.log('\n💼 Cüzdan Bilgileri:');
        console.log(`   Wallet ID: ${wallet.wallet_id}`);
        console.log(`   Public Key: ${wallet.public_key.substring(0, 20)}...`);
        console.log(`   Balance: ${wallet.balance / 100000000} LT`);

        console.log('\n🔐 Güvenlik Bilgileri:');
        console.log(`   Mnemonic (24 kelime): ${mnemonic}`);
        console.log(`   Encryption Public Key: ${user.encryption_public_key?.substring(0, 20)}...`);

        console.log('\n🎁 Airdrop:');
        console.log(`   Miktar: ${airdrop_amount}`);

        console.log('\n⚠️  ÖNEMLİ: Mnemonic kelimelerinizi güvenli bir yerde saklayın!');

        return response.data;

    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// SENARYO 2: SADECE NICKNAME İLE ANONİM KAYIT
// ============================================================================
async function createAnonymousUser() {
    console.log('\n🔷 SENARYO 2: Anonim Kullanıcı (Sadece Nickname)\n');

    try {
        const response = await axios.post(`${BASE_URL}/api/user/create`, {
            nickname: 'anonymous_user_' + Date.now()
        });

        const { user, wallet, mnemonic } = response.data;

        console.log('✅ Anonim kullanıcı oluşturuldu!');
        console.log(`   User ID: ${user.user_id}`);
        console.log(`   Nickname: ${user.nickname}`);
        console.log(`   Wallet: ${wallet.wallet_id}`);
        console.log(`   Mnemonic: ${mnemonic}`);

        return response.data;

    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// SENARYO 3: TAMAMEN BOŞ KAYIT (SADECE CÜZDAN)
// ============================================================================
async function createWalletOnly() {
    console.log('\n🔷 SENARYO 3: Tamamen Anonim (Hiç Bilgi Yok)\n');

    try {
        const response = await axios.post(`${BASE_URL}/api/user/create`, {});

        const { user, wallet, mnemonic } = response.data;

        console.log('✅ Tamamen anonim hesap oluşturuldu!');
        console.log(`   User ID (= Wallet ID): ${user.user_id}`);
        console.log(`   Mnemonic: ${mnemonic}`);

        return response.data;

    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// SENARYO 4: KULLANICI ADI MÜSAİT Mİ KONTROLÜ
// ============================================================================
async function checkNicknameAvailability(nickname) {
    console.log(`\n🔷 SENARYO 4: '${nickname}' kullanıcı adı kontrolü\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/user/check-nickname/${nickname}`);

        const { available } = response.data;

        if (available) {
            console.log(`✅ '${nickname}' kullanılabilir!`);
        } else {
            console.log(`❌ '${nickname}' zaten alınmış.`);
        }

        return available;

    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// SENARYO 5: KULLANICI ARAMA
// ============================================================================
async function searchUsers(query) {
    console.log(`\n🔷 SENARYO 5: '${query}' ile kullanıcı arama\n`);

    try {
        const response = await axios.get(`${BASE_URL}/api/user/search?q=${query}&limit=5`);

        const { users } = response.data;

        console.log(`✅ ${users.length} kullanıcı bulundu:\n`);
        users.forEach((user, index) => {
            console.log(`   ${index + 1}. ${user.nickname || 'No nickname'}`);
            if (user.first_name || user.last_name) {
                console.log(`      ${user.first_name || ''} ${user.last_name || ''}`);
            }
        });

        return users;

    } catch (error) {
        console.error('❌ Hata:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================================
// ANA FONKSİYON
// ============================================================================
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('        TraceNet - Kullanıcı Oluşturma Örnekleri');
    console.log('═══════════════════════════════════════════════════════════');

    try {
        // Nickname kontrolü
        await checkNicknameAvailability('alice_wonderland');

        // Tam bilgi ile kayıt
        const user1 = await createUserWithFullInfo();

        // Anonim kayıt
        const user2 = await createAnonymousUser();

        // Tamamen boş kayıt
        const user3 = await createWalletOnly();

        // Kullanıcı arama
        await searchUsers('alice');

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Tüm örnekler başarıyla tamamlandı!');
        console.log('═══════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Bir hata oluştu:', error.message);
    }
}

// Scripti çalıştır
if (require.main === module) {
    main();
}

// Export (diğer dosyalarda kullanılabilir)
module.exports = {
    createUserWithFullInfo,
    createAnonymousUser,
    createWalletOnly,
    checkNicknameAvailability,
    searchUsers
};
