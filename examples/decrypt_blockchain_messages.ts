/**
 * Blockchain'den Şifreli Mesaj Okuma ve Şifre Çözme Örneği
 * 
 * Bu örnek, blockchain'de saklanan şifreli mesajların nasıl okunup
 * şifresinin çözüleceğini gösterir.
 */

import { Blockchain } from '../src/blockchain/core/Blockchain';
import { KeyManager } from '../src/blockchain/crypto/KeyManager';
import { TransactionModel, TransactionType } from '../src/blockchain/models/Transaction';

async function demonstrateMessageDecryption() {
    console.log('=== Blockchain\'den Şifreli Mesaj Okuma ve Şifre Çözme Örneği ===\n');

    // 1. Blockchain başlat
    const validatorKeys = KeyManager.generateWalletFromMnemonic();
    const blockchain = new Blockchain(validatorKeys.address);
    console.log('✅ Blockchain başlatıldı\n');

    // 2. İki kullanıcı oluştur (Alice ve Bob)
    const alice = KeyManager.generateWalletFromMnemonic();
    const bob = KeyManager.generateWalletFromMnemonic();

    console.log('👤 KULLANICILAR:');
    console.log(`Alice Cüzdan: ${alice.address}`);
    console.log(`Alice Şifreleme Public Key: ${alice.encryptionPublicKey.substring(0, 20)}...`);
    console.log(`\nBob Cüzdan: ${bob.address}`);
    console.log(`Bob Şifreleme Public Key: ${bob.encryptionPublicKey.substring(0, 20)}...\n`);

    // 3. Alice'i fonla
    const fundTx = TransactionModel.create(
        'SYSTEM',
        alice.address,
        TransactionType.REWARD,
        1000 * 100000000, // 1000 LT
        0,
        {}
    );
    blockchain.addBlock([fundTx], validatorKeys.address, 'sig');
    console.log('✅ Alice fonlandı (1000 LT)\n');

    // 4. Alice, Bob'a şifreli mesaj gönderiyor
    console.log('📝 MESAJ ŞİFRELEME:');
    const originalMessage = "Merhaba Bob! Bu gizli bir mesajdır. Sadece sen okuyabilirsin! 🔐";
    console.log(`Orijinal Mesaj: "${originalMessage}"\n`);

    // Mesajı şifrele
    const encryptedMessage = KeyManager.encryptForUser(
        originalMessage,
        alice.encryptionPrivateKey,   // Alice'in private key'i
        bob.encryptionPublicKey       // Bob'un public key'i
    );

    console.log(`🔒 Şifreli Mesaj: ${encryptedMessage}\n`);

    // 5. Şifreli mesajı blockchain'e kaydet
    const messageTx = TransactionModel.create(
        alice.address,
        bob.address,
        TransactionType.PRIVATE_MESSAGE,
        0,
        200, // MESSAGE_FEE
        {
            encrypted_message: encryptedMessage,
            message_type: 'text',
            timestamp: Date.now()
        }
    );

    messageTx.sender_public_key = alice.publicKey;
    messageTx.sender_signature = KeyManager.sign(messageTx.getSignableData(), alice.privateKey);

    const result = blockchain.addBlock([messageTx], validatorKeys.address, 'sig');

    if (result.success) {
        console.log('✅ Şifreli mesaj blockchain\'e kaydedildi');
        console.log(`   Block Index: ${result.block?.index}`);
        console.log(`   Transaction ID: ${messageTx.tx_id}\n`);
    }

    // ========================================
    // ÖNEMLİ KISIM: BLOCKCHAIN'DEN MESAJ OKUMA
    // ========================================

    console.log('='..repeat(60));
    console.log('📖 BLOCKCHAIN\'DEN ŞİFRELİ MESAJ OKUMA VE ŞIFRE ÇÖZME');
    console.log('='.repeat(60) + '\n');

    // 6. Bob, blockchain'den mesajlarını okuyor
    console.log('🔍 Adım 1: Blockchain\'deki tüm blokları tara\n');

    const chain = blockchain.getChain();
    const bobMessages: Array<{
        blockIndex: number;
        txId: string;
        from: string;
        encryptedMessage: string;
        timestamp: number;
    }> = [];

    // Tüm blokları tara
    for (const block of chain) {
        for (const tx of block.transactions) {
            // Bob'a gönderilen PRIVATE_MESSAGE transaction'larını bul
            if (tx.type === 'PRIVATE_MESSAGE' && tx.to_wallet === bob.address) {
                bobMessages.push({
                    blockIndex: block.index,
                    txId: tx.tx_id,
                    from: tx.from_wallet,
                    encryptedMessage: tx.payload?.encrypted_message || '',
                    timestamp: tx.payload?.timestamp || tx.timestamp
                });
            }
        }
    }

    console.log(`💌 Bob için ${bobMessages.length} adet mesaj bulundu!\n`);

    // 7. Her mesajın şifresini çöz
    console.log('🔓 Adım 2: Şifreli mesajların şifresini çöz\n');

    for (let i = 0; i < bobMessages.length; i++) {
        const msg = bobMessages[i];

        console.log(`📬 Mesaj #${i + 1}:`);
        console.log(`   Gönderen: ${msg.from}`);
        console.log(`   Block: #${msg.blockIndex}`);
        console.log(`   Transaction ID: ${msg.txId}`);
        console.log(`   Şifreli: ${msg.encryptedMessage.substring(0, 40)}...`);

        try {
            // Gönderenin şifreleme public key'ini al
            // Gerçek uygulamada bu bilgi blockchain'den veya bir veritabanından alınır
            // Bu örnekte Alice'in key'ini kullanıyoruz
            const senderEncryptionPublicKey = alice.encryptionPublicKey;

            // Mesajın şifresini çöz
            const decryptedMessage = KeyManager.decryptFromUser(
                msg.encryptedMessage,
                bob.encryptionPrivateKey,        // Bob'un private key'i
                senderEncryptionPublicKey        // Alice'in public key'i
            );

            console.log(`   ✅ Açılan Mesaj: "${decryptedMessage}"\n`);

        } catch (error) {
            console.error(`   ❌ Hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}\n`);
        }
    }

    // ========================================
    // EK: GERÇEKÇİ BİR SENARYO
    // ========================================

    console.log('\n' + '='.repeat(60));
    console.log('💡 GERÇEKÇİ SENARYO: Birden Fazla Mesaj');
    console.log('='.repeat(60) + '\n');

    // Alice, Bob'a birkaç mesaj daha gönderiyor
    const messages = [
        "Bu ikinci mesajım!",
        "Üçüncü mesaj: Toplantı saat 15:00'te",
        "Son mesaj: Görüşmek üzere! 👋"
    ];

    for (const msgText of messages) {
        const encrypted = KeyManager.encryptForUser(
            msgText,
            alice.encryptionPrivateKey,
            bob.encryptionPublicKey
        );

        const tx = TransactionModel.create(
            alice.address,
            bob.address,
            TransactionType.PRIVATE_MESSAGE,
            0,
            200,
            { encrypted_message: encrypted, message_type: 'text', timestamp: Date.now() }
        );

        tx.sender_public_key = alice.publicKey;
        tx.sender_signature = KeyManager.sign(tx.getSignableData(), alice.privateKey);

        blockchain.addBlock([tx], validatorKeys.address, 'sig');

        // Küçük bir gecikme ekle (zaman damgası için)
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log(`✅ ${messages.length} adet ek mesaj gönderildi\n`);

    // Tüm mesajları tekrar oku
    console.log('📖 Bob tüm mesajlarını okuyor:\n');

    const allMessages: typeof bobMessages = [];
    const updatedChain = blockchain.getChain();

    for (const block of updatedChain) {
        for (const tx of block.transactions) {
            if (tx.type === 'PRIVATE_MESSAGE' && tx.to_wallet === bob.address) {
                allMessages.push({
                    blockIndex: block.index,
                    txId: tx.tx_id,
                    from: tx.from_wallet,
                    encryptedMessage: tx.payload?.encrypted_message || '',
                    timestamp: tx.payload?.timestamp || tx.timestamp
                });
            }
        }
    }

    // Zamana göre sırala
    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    console.log(`💬 Toplam ${allMessages.length} mesaj:\n`);

    allMessages.forEach((msg, index) => {
        const decrypted = KeyManager.decryptFromUser(
            msg.encryptedMessage,
            bob.encryptionPrivateKey,
            alice.encryptionPublicKey
        );

        const date = new Date(msg.timestamp);
        console.log(`${index + 1}. [${date.toLocaleTimeString()}] ${decrypted}`);
    });

    // ========================================
    // ÖZET BİLGİLER
    // ========================================

    console.log('\n' + '='.repeat(60));
    console.log('📊 ÖZET');
    console.log('='.repeat(60));
    console.log(`Toplam Block: ${blockchain.getChainLength()}`);
    console.log(`Bob'un Mesaj Sayısı: ${allMessages.length}`);
    console.log(`Şifreleme Algoritması: NaCl Box (Curve25519 + XSalsa20 + Poly1305)`);
    console.log(`Güvenlik: Uçtan uca şifreli, sadece gönderen ve alıcı okuyabilir`);
    console.log('='.repeat(60));
}

// Örneği çalıştır
demonstrateMessageDecryption()
    .then(() => {
        console.log('\n✅ Örnek başarıyla tamamlandı!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Hata:', error);
        process.exit(1);
    });
