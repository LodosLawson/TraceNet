/**
 * TraceNet - Basit Mesajlaşma Örneği
 * 
 * Bu örnek, iki kullanıcı arasında basit mesaj gönderimini gösterir.
 */

const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';

// Mesaj gönderme fonksiyonu
async function sendMessage(fromWallet, toWallet, message, fee = 0.1) {
    try {
        const timestamp = Date.now();
        const crypto = require('crypto');

        // TX ID oluştur
        const txData = `${fromWallet}${toWallet}${fee * 100000000}${timestamp}`;
        const txId = crypto.createHash('sha256').update(txData).digest('hex');

        // Mesaj transaction'ı oluştur
        const transaction = {
            tx_id: `TX_${txId}`,
            from_wallet: fromWallet,
            to_wallet: toWallet,
            type: 'MESSAGE_PAYMENT',
            amount: fee * 100000000,
            fee: 0.01 * 100000000,
            payload: {
                message: message,
                message_type: 'text',
                timestamp: timestamp,
                encrypted: false
            },
            timestamp: timestamp,
            signatures: []
        };

        // Blockchain'e gönder
        const response = await fetch(`${API_URL}/rpc/sendRawTx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Mesaj gönderildi!');
            console.log('TX ID:', result.tx_id);
            console.log('Mesaj ücreti:', fee, 'LT');
            return result;
        } else {
            throw new Error(result.error || 'Mesaj gönderilemedi');
        }
    } catch (error) {
        console.error('❌ Hata:', error.message);
        throw error;
    }
}

// Gelen mesajları alma fonksiyonu
async function getMessages(walletId) {
    try {
        const response = await fetch(`${API_URL}/chain`);
        const data = await response.json();

        const messages = [];

        // Blockchain'deki mesajları filtrele
        for (const block of data.chain) {
            for (const tx of block.transactions) {
                if (tx.type === 'MESSAGE_PAYMENT' && tx.to_wallet === walletId) {
                    messages.push({
                        from: tx.from_wallet,
                        message: tx.payload.message,
                        fee: tx.amount / 100000000,
                        time: new Date(tx.timestamp).toLocaleString('tr-TR'),
                        block: block.index,
                        tx_id: tx.tx_id
                    });
                }
            }
        }

        return messages.sort((a, b) => b.time - a.time);
    } catch (error) {
        console.error('❌ Mesajlar alınamadı:', error.message);
        return [];
    }
}

// Demo
async function demo() {
    console.log('🚀 TraceNet Mesajlaşma Demo\n');

    // Örnek wallet'lar (normalde user/wallet API'den alınır)
    const alice = 'LT_alice_demo_001';
    const bob = 'LT_bob_demo_002';

    // Alice'den Bob'a mesaj gönder
    console.log('📨 Alice → Bob mesaj gönderiyor...');
    await sendMessage(alice, bob, 'Merhaba Bob! TraceNet nasıl?', 0.1);

    console.log('\n⏳ Blockchain onayı bekleniyor (10 saniye)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Bob'un mesajlarını kontrol et
    console.log('📬 Bob\'un gelen mesajları:');
    const messages = await getMessages(bob);
    messages.forEach((msg, i) => {
        console.log(`\n[${i + 1}] Gönderen: ${msg.from}`);
        console.log(`    Mesaj: ${msg.message}`);
        console.log(`    Ücret: ${msg.fee} LT`);
        console.log(`    Zaman: ${msg.time}`);
        console.log(`    Blok: ${msg.block}`);
    });
}

// Modül export (başka dosyalardan kullanılabilir)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sendMessage, getMessages };
}

// Direkt çalıştırılırsa demo'yu başlat
if (require.main === module) {
    demo().catch(console.error);
}
