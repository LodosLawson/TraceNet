/**
 * TraceNet API - Tüm Endpoint Kullanım Örnekleri
 * 
 * Bu dosya, TraceNet blockchain'inin tüm API endpoint'lerinin
 * nasıl kullanılacağını gösteren kapsamlı örnekler içerir.
 * 
 * Çalıştırmadan önce:
 * 1. TraceNet node'unun çalıştığından emin olun: npm run dev
 * 2. Node'un http://localhost:3000 adresinde çalıştığını kontrol edin
 * 3. Bu dosyayı çalıştırın: node examples/api_examples.js
 */

const axios = require('axios');

// API Base URL
const API_URL = 'http://localhost:3000';

// Renk kodları için console output
const colors = {
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m'
};

function log(category, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${colors.blue}[${category}]${colors.reset} ${message}`);
}

function success(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function error(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function section(title) {
    console.log(`\n${colors.yellow}${'='.repeat(80)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(80)}${colors.reset}\n`);
}

// ============================================
// 1. RPC ENDPOINTS (Blockchain Core)
// ============================================

async function testRPCEndpoints() {
    section('1. RPC ENDPOINTS - Blockchain Core');

    // 1.1 Get Status
    try {
        log('RPC', 'GET /rpc/status - Blockchain durumunu al');
        const response = await axios.get(`${API_URL}/rpc/status`);
        success('Status alındı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Status hatası: ${err.message}`);
    }

    // 1.2 Get Block by Index
    try {
        log('RPC', 'GET /rpc/block/0 - Genesis bloğu al');
        const response = await axios.get(`${API_URL}/rpc/block/0`);
        success('Genesis block alındı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Block hatası: ${err.message}`);
    }

    // 1.3 Get All Accounts
    try {
        log('RPC', 'GET /rpc/accounts - Tüm hesapları listele');
        const response = await axios.get(`${API_URL}/rpc/accounts`);
        success(`${response.data.count} hesap bulundu`);
        console.log(JSON.stringify(response.data.accounts.slice(0, 3), null, 2));
    } catch (err) {
        error(`Accounts hatası: ${err.message}`);
    }

    // 1.4 Calculate Transfer Fee
    try {
        log('RPC', 'POST /rpc/calculateTransferFee - Transfer ücreti hesapla');
        const response = await axios.post(`${API_URL}/rpc/calculateTransferFee`, {
            recipient_address: 'TRNexample123',
            amount: 100 * 100000000, // 100 LT
            priority: 'STANDARD'
        });
        success('Transfer ücreti hesaplandı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Fee calculation hatası: ${err.message}`);
    }
}

// ============================================
// 2. WALLET ENDPOINTS
// ============================================

async function testWalletEndpoints() {
    section('2. WALLET ENDPOINTS - Cüzdan Yönetimi');

    let createdWallet = null;
    let userId = null;

    // 2.1 Create Wallet
    try {
        log('WALLET', 'POST /api/wallet/create - Yeni cüzdan oluştur');
        userId = 'user_' + Date.now();
        const response = await axios.post(`${API_URL}/api/wallet/create`, {
            userId: userId
        });
        createdWallet = response.data.wallet;
        success('Cüzdan oluşturuldu');
        console.log('Cüzdan ID:', createdWallet.wallet_id);
        console.log('Public Key:', createdWallet.public_key.substring(0, 40) + '...');
        console.log('Mnemonic (İLK 3 KELİME):', response.data.mnemonic.split(' ').slice(0, 3).join(' ') + '...');
    } catch (err) {
        error(`Wallet create hatası: ${err.message}`);
        return; // Diğer testler için wallet gerekli
    }

    // 2.2 List Wallets
    try {
        log('WALLET', `GET /api/wallet/list/${userId} - Kullanıcı cüzdanlarını listele`);
        const response = await axios.get(`${API_URL}/api/wallet/list/${userId}`);
        success(`${response.data.wallets.length} cüzdan bulundu`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Wallet list hatası: ${err.message}`);
    }

    // 2.3 Get Wallet Details
    try {
        log('WALLET', `GET /api/wallet/${createdWallet.wallet_id} - Cüzdan detayları al`);
        const response = await axios.get(`${API_URL}/api/wallet/${createdWallet.wallet_id}`);
        success('Cüzdan detayları alındı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Wallet get hatası: ${err.message}`);
    }

    return createdWallet;
}

// ============================================
// 3. USER ENDPOINTS
// ============================================

async function testUserEndpoints() {
    section('3. USER ENDPOINTS - Kullanıcı Profilleri');

    let createdUser = null;

    // 3.1 Check Nickname Availability
    try {
        log('USER', 'GET /api/user/check-nickname/testuser - Kullanıcı adı kontrolü');
        const nickname = 'testuser_' + Date.now();
        const response = await axios.get(`${API_URL}/api/user/check-nickname/${nickname}`);
        success(`Nickname "${nickname}" ${response.data.available ? 'müsait' : 'kullanılıyor'}`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Nickname check hatası: ${err.message}`);
    }

    // 3.2 Create User
    try {
        log('USER', 'POST /api/user/create - Yeni kullanıcı oluştur');
        const nickname = 'alice_' + Date.now();
        const response = await axios.post(`${API_URL}/api/user/create`, {
            nickname: nickname,
            name: 'Alice',
            surname: 'Johnson',
            birth_date: '1995-05-15'
        });
        createdUser = response.data.user;
        success(`Kullanıcı oluşturuldu: ${createdUser.nickname}`);
        console.log('User ID:', createdUser.user_id);
        console.log('Wallet ID:', response.data.wallet.wallet_id);
        console.log('Airdrop TX:', response.data.airdrop_tx_id);
    } catch (err) {
        error(`User create hatası: ${err.message}`);
        return;
    }

    // 3.3 Get User by Nickname
    try {
        log('USER', `GET /api/user/nickname/${createdUser.nickname} - Kullanıcıyı nickname ile bul`);
        const response = await axios.get(`${API_URL}/api/user/nickname/${createdUser.nickname}`);
        success('Kullanıcı bulundu');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`User get by nickname hatası: ${err.message}`);
    }

    // 3.4 Get User by ID
    try {
        log('USER', `GET /api/user/${createdUser.user_id} - Kullanıcıyı ID ile bul`);
        const response = await axios.get(`${API_URL}/api/user/${createdUser.user_id}`);
        success('Kullanıcı ID ile bulundu');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`User get by ID hatası: ${err.message}`);
    }

    // 3.5 Search Users
    try {
        log('USER', 'GET /api/user/search?q=alice - Kullanıcı ara');
        const response = await axios.get(`${API_URL}/api/user/search?q=alice&limit=5`);
        success(`${response.data.count} kullanıcı bulundu`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`User search hatası: ${err.message}`);
    }

    return createdUser;
}

// ============================================
// 4. CONTENT ENDPOINTS
// ============================================

async function testContentEndpoints(user) {
    section('4. CONTENT ENDPOINTS - İçerik Yönetimi');

    let createdContent = null;

    if (!user) {
        console.log('⚠️  Kullanıcı bulunamadı, content testleri atlanıyor');
        return;
    }

    // 4.1 Create Content
    try {
        log('CONTENT', 'POST /api/content/create - Yeni içerik oluştur');
        const response = await axios.post(`${API_URL}/api/content/create`, {
            wallet_id: user.wallet_id,
            content_type: 'POST',
            title: 'İlk Gönderim',
            description: 'Bu benim TraceNet\'teki ilk gönderim! 🎉',
            tags: ['test', 'first-post', 'blockchain']
        });
        createdContent = response.data.content;
        success('İçerik oluşturuldu');
        console.log('Content ID:', createdContent.content_id);
        console.log('TX ID:', response.data.tx_id);
    } catch (err) {
        error(`Content create hatası: ${err.message}`);
        return;
    }

    // 4.2 Get Content by ID
    try {
        log('CONTENT', `GET /api/content/${createdContent.content_id} - İçerik detayları`);
        const response = await axios.get(`${API_URL}/api/content/${createdContent.content_id}`);
        success('İçerik detayları alındı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Content get hatası: ${err.message}`);
    }

    // 4.3 Get User Content
    try {
        log('CONTENT', `GET /api/content/user/${user.wallet_id} - Kullanıcının içerikleri`);
        const response = await axios.get(`${API_URL}/api/content/user/${user.wallet_id}?limit=10`);
        success(`${response.data.count} içerik bulundu`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`User content hatası: ${err.message}`);
    }

    // 4.4 Get Content Feed
    try {
        log('CONTENT', 'GET /api/content/feed - Global içerik akışı');
        const response = await axios.get(`${API_URL}/api/content/feed?limit=5&offset=0`);
        success(`Feed: ${response.data.contents.length} içerik`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Content feed hatası: ${err.message}`);
    }

    return createdContent;
}

// ============================================
// 5. SOCIAL ENDPOINTS
// ============================================

async function testSocialEndpoints(user, content) {
    section('5. SOCIAL ENDPOINTS - Sosyal Etkileşimler');

    if (!user || !content) {
        console.log('⚠️  Kullanıcı veya içerik bulunamadı, social testleri atlanıyor');
        return;
    }

    // 5.1 Like Content
    try {
        log('SOCIAL', 'POST /api/social/like - İçeriği beğen');
        const response = await axios.post(`${API_URL}/api/social/like`, {
            wallet_id: user.wallet_id,
            content_id: content.content_id
        });
        success('İçerik beğenildi');
        console.log('TX ID:', response.data.tx_id);
        console.log('Fee:', response.data.fee, 'smallest units');
    } catch (err) {
        error(`Like hatası: ${err.message}`);
    }

    // 5.2 Get Likes
    try {
        log('SOCIAL', `GET /api/social/likes/${content.content_id} - Beğenileri listele`);
        const response = await axios.get(`${API_URL}/api/social/likes/${content.content_id}`);
        success(`${response.data.count} beğeni`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get likes hatası: ${err.message}`);
    }

    // 5.3 Comment on Content
    try {
        log('SOCIAL', 'POST /api/social/comment - Yorum ekle');
        const response = await axios.post(`${API_URL}/api/social/comment`, {
            wallet_id: user.wallet_id,
            content_id: content.content_id,
            comment_text: 'Harika bir gönderi! 👍'
        });
        success('Yorum eklendi');
        console.log('Comment ID:', response.data.comment_id);
        console.log('TX ID:', response.data.tx_id);
    } catch (err) {
        error(`Comment hatası: ${err.message}`);
    }

    // 5.4 Get Comments
    try {
        log('SOCIAL', `GET /api/social/comments/${content.content_id} - Yorumları listele`);
        const response = await axios.get(`${API_URL}/api/social/comments/${content.content_id}`);
        success(`${response.data.count} yorum`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get comments hatası: ${err.message}`);
    }

    // 5.5 Follow User (demo - başka bir kullanıcı lazım)
    try {
        log('SOCIAL', 'POST /api/social/follow - Kullanıcıyı takip et');
        // Demo amaçlı - gerçek senaryoda farklı bir kullanıcı olmalı
        const demoTargetWallet = 'TRN' + '0'.repeat(40);
        const response = await axios.post(`${API_URL}/api/social/follow`, {
            follower_wallet: user.wallet_id,
            target_wallet: demoTargetWallet
        });
        success('Takip edildi');
        console.log('TX ID:', response.data.tx_id);
    } catch (err) {
        error(`Follow hatası: ${err.message}`);
    }

    // 5.6 Get Followers
    try {
        log('SOCIAL', `GET /api/social/followers/${user.wallet_id} - Takipçileri listele`);
        const response = await axios.get(`${API_URL}/api/social/followers/${user.wallet_id}`);
        success(`${response.data.count} takipçi`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get followers hatası: ${err.message}`);
    }

    // 5.7 Get Following
    try {
        log('SOCIAL', `GET /api/social/following/${user.wallet_id} - Takip edilenleri listele`);
        const response = await axios.get(`${API_URL}/api/social/following/${user.wallet_id}`);
        success(`${response.data.following?.length || 0} kişi takip ediliyor`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get following hatası: ${err.message}`);
    }
}

// ============================================
// 6. MESSAGING ENDPOINTS
// ============================================

async function testMessagingEndpoints(user) {
    section('6. MESSAGING ENDPOINTS - Şifreli Mesajlaşma');

    if (!user) {
        console.log('⚠️  Kullanıcı bulunamadı, messaging testleri atlanıyor');
        return;
    }

    // 6.1 Send Encrypted Message
    try {
        log('MESSAGING', 'POST /api/messaging/send - Şifreli mesaj gönder');

        // Not: Gerçek uygulamada mesaj client-side şifrelenmeli
        const demoEncryptedMessage = 'demo_nonce_12345:demo_encrypted_data_67890';
        const demoRecipient = 'TRN' + '1'.repeat(40);

        const response = await axios.post(`${API_URL}/api/messaging/send`, {
            sender_wallet: user.wallet_id,
            recipient_wallet: demoRecipient,
            encrypted_message: demoEncryptedMessage
        });
        success('Mesaj gönderildi');
        console.log('Message ID:', response.data.message_id);
        console.log('TX ID:', response.data.tx_id);
    } catch (err) {
        error(`Send message hatası: ${err.message}`);
    }

    // 6.2 Get Inbox
    try {
        log('MESSAGING', `GET /api/messaging/inbox/${user.wallet_id} - Gelen kutusu`);
        const response = await axios.get(`${API_URL}/api/messaging/inbox/${user.wallet_id}`);
        success(`${response.data.count} mesaj`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get inbox hatası: ${err.message}`);
    }
}

// ============================================
// 7. VALIDATOR ENDPOINTS
// ============================================

async function testValidatorEndpoints() {
    section('7. VALIDATOR ENDPOINTS - Validator Yönetimi');

    let validatorId = null;

    // 7.1 Register Validator
    try {
        log('VALIDATOR', 'POST /api/validator/register - Validator kaydı');
        validatorId = 'validator_' + Date.now();
        const userId = 'user_validator_' + Date.now();
        const publicKey = 'demo_public_key_' + Math.random().toString(36).substring(7);

        const response = await axios.post(`${API_URL}/api/validator/register`, {
            validator_id: validatorId,
            user_id: userId,
            public_key: publicKey
        });
        success('Validator kaydedildi');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Validator register hatası: ${err.message}`);
        return;
    }

    // 7.2 Register Validator Wallet (YENİ!)
    try {
        log('VALIDATOR', `POST /api/validator/${validatorId}/wallet - Validator cüzdanı kaydet`);
        const walletAddress = 'TRN' + '9'.repeat(40);

        const response = await axios.post(`${API_URL}/api/validator/${validatorId}/wallet`, {
            wallet_address: walletAddress
        });
        success('Validator cüzdanı kaydedildi');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Validator wallet register hatası: ${err.message}`);
    }

    // 7.3 Get Validator Wallet (YENİ!)
    try {
        log('VALIDATOR', `GET /api/validator/${validatorId}/wallet - Validator cüzdanını al`);
        const response = await axios.get(`${API_URL}/api/validator/${validatorId}/wallet`);
        success('Validator cüzdanı alındı');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Get validator wallet hatası: ${err.message}`);
    }

    // 7.4 Send Heartbeat
    try {
        log('VALIDATOR', 'POST /api/validator/heartbeat - Heartbeat gönder');
        const response = await axios.post(`${API_URL}/api/validator/heartbeat`, {
            validator_id: validatorId
        });
        success('Heartbeat gönderildi');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`Heartbeat hatası: ${err.message}`);
    }

    // 7.5 List Validators
    try {
        log('VALIDATOR', 'GET /api/validator/list - Tüm validator\'ları listele');
        const response = await axios.get(`${API_URL}/api/validator/list`);
        success(`${response.data.count} validator bulundu`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`List validators hatası: ${err.message}`);
    }

    // 7.6 List Online Validators Only
    try {
        log('VALIDATOR', 'GET /api/validator/list?online=true - Aktif validator\'ları listele');
        const response = await axios.get(`${API_URL}/api/validator/list?online=true`);
        success(`${response.data.count} aktif validator`);
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        error(`List online validators hatası: ${err.message}`);
    }
}

// ============================================
// ANA FONKSİYON
// ============================================

async function runAllTests() {
    console.log(`\n${colors.cyan}${'█'.repeat(80)}`);
    console.log(`  TraceNet API - TÜM ENDPOINT KULLANIM ÖRNEKLERİ`);
    console.log(`  API URL: ${API_URL}`);
    console.log(`${'█'.repeat(80)}${colors.reset}\n`);

    try {
        // Test sırası
        await testRPCEndpoints();
        const wallet = await testWalletEndpoints();
        const user = await testUserEndpoints();
        const content = await testContentEndpoints(user);
        await testSocialEndpoints(user, content);
        await testMessagingEndpoints(user);
        await testValidatorEndpoints();

        // Final
        section('✅ TÜM TESTLER TAMAMLANDI');
        success('Tüm API endpoint\'leri başarıyla test edildi!');

    } catch (error) {
        console.error(`\n${colors.red}HATA:${colors.reset}`, error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Çalıştır
if (require.main === module) {
    runAllTests()
        .then(() => {
            process.exit(0);
        })
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { runAllTests };
