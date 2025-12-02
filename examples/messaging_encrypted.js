/**
 * TraceNet - Şifreli Mesajlaşma Örneği
 * 
 * Bu örnek, TweetNaCl kullanarak uçtan uca şifrelenmiş mesajlaşmayı gösterir.
 * 
 * Gerekli: npm install tweetnacl tweetnacl-util
 */

const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

const API_URL = 'https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app';

// Mesajı şifreleme
function encryptMessage(message, recipientPublicKey, senderPrivateKey) {
    try {
        const messageBytes = naclUtil.decodeUTF8(message);
        const nonce = nacl.randomBytes(24);

        // Public key'i hex'den Uint8Array'e çevir
        const recipientPubKeyBytes = Buffer.from(recipientPublicKey, 'hex');
        const senderPrivKeyBytes = Buffer.from(senderPrivateKey, 'hex');

        // Şifrele
        const encrypted = nacl.box(
            messageBytes,
            nonce,
            recipientPubKeyBytes,
            senderPrivKeyBytes
        );

        return {
            encrypted: naclUtil.encodeBase64(encrypted),
            nonce: naclUtil.encodeBase64(nonce)
        };
    } catch (error) {
        console.error('Şifreleme hatası:', error);
        throw new Error('Mesaj şifrelenemedi');
    }
}

// Mesaj şifresini çözme
function decryptMessage(encryptedMessage, nonce, senderPublicKey, recipientPrivateKey) {
    try {
        const encryptedBytes = naclUtil.decodeBase64(encryptedMessage);
        const nonceBytes = naclUtil.decodeBase64(nonce);
        const senderPubKeyBytes = Buffer.from(senderPublicKey, 'hex');
        const recipientPrivKeyBytes = Buffer.from(recipientPrivateKey, 'hex');

        // Şifreyi çöz
        const decrypted = nacl.box.open(
            encryptedBytes,
            nonceBytes,
            senderPubKeyBytes,
            recipientPrivKeyBytes
        );

        if (!decrypted) {
            throw new Error('Şifre çözülemedi');
        }

        return naclUtil.encodeUTF8(decrypted);
    } catch (error) {
        console.error('Şifre çözme hatası:', error);
        return null;
    }
}

// Şifreli mesaj gönderme
async function sendEncryptedMessage(fromWallet, toWallet, message, senderKeys, recipientPubKey, fee = 0.1) {
    try {
        const crypto = require('crypto');

        // Mesajı şifrele
        const { encrypted, nonce } = encryptMessage(
            message,
            recipientPubKey,
            senderKeys.encryptionPrivateKey
        );

        const timestamp = Date.now();
        const txData = `${fromWallet}${toWallet}${fee * 100000000}${timestamp}`;
        const txId = crypto.createHash('sha256').update(txData).digest('hex');

        // Şifreli mesaj transaction'ı
        const transaction = {
            tx_id: `TX_${txId}`,
            from_wallet: fromWallet,
            to_wallet: toWallet,
            type: 'MESSAGE_PAYMENT',
            amount: fee * 100000000,
            fee: 0.01 * 100000000,
            payload: {
                encrypted_message: encrypted,
                nonce: nonce,
                message_type: 'encrypted',
                timestamp: timestamp,
                encrypted: true
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
            console.log('✅ Şifreli mesaj gönderildi!');
            console.log('TX ID:', result.tx_id);
            console.log('🔒 Mesaj end-to-end şifrelenmiş');
            return result;
        } else {
            throw new Error(result.error || 'Mesaj gönderilemedi');
        }
    } catch (error) {
        console.error('❌ Hata:', error.message);
        throw error;
    }
}

// Şifreli mesajları alma ve çözme
async function getEncryptedMessages(walletId, recipientKeys) {
    try {
        const response = await fetch(`${API_URL}/chain`);
        const data = await response.json();

        const messages = [];

        for (const block of data.chain) {
            for (const tx of block.transactions) {
                if (tx.type === 'MESSAGE_PAYMENT' &&
                    tx.to_wallet === walletId &&
                    tx.payload.encrypted) {

                    // Şifreyi çöz
                    const decryptedMessage = decryptMessage(
                        tx.payload.encrypted_message,
                        tx.payload.nonce,
                        tx.from_wallet, // Gerçekte encryption public key olmalı
                        recipientKeys.encryptionPrivateKey
                    );

                    messages.push({
                        from: tx.from_wallet,
                        message: decryptedMessage || '🔒 [Şifre çözülemedi]',
                        encrypted: true,
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
    console.log('🔐 TraceNet Şifreli Mesajlaşma Demo\n');

    // Demo için key pair'ler oluştur
    console.log('🔑 Encryption key'ler oluşturuluyor...\n');
    
    const aliceKeys = nacl.box.keyPair();
    const bobKeys = nacl.box.keyPair();

    const alice = {
        wallet: 'LT_alice_encrypted_001',
        encryptionPublicKey: Buffer.from(aliceKeys.publicKey).toString('hex'),
        encryptionPrivateKey: Buffer.from(aliceKeys.secretKey).toString('hex')
    };

    const bob = {
        wallet: 'LT_bob_encrypted_002',
        encryptionPublicKey: Buffer.from(bobKeys.publicKey).toString('hex'),
        encryptionPrivateKey: Buffer.from(bobKeys.secretKey).toString('hex')
    };

    console.log('👤 Alice Public Key:', alice.encryptionPublicKey.substring(0, 32) + '...');
    console.log('👤 Bob Public Key:', bob.encryptionPublicKey.substring(0, 32) + '...\n');

    // Alice'den Bob'a şifreli mesaj
    const secretMessage = 'Bu çok gizli bir mesaj! 🤫';
    console.log('📨 Alice → Bob şifreli mesaj gönderiyor...');
    console.log('💬 Orijinal mesaj:', secretMessage);

    await sendEncryptedMessage(
        alice.wallet,
        bob.wallet,
        secretMessage,
        { encryptionPrivateKey: alice.encryptionPrivateKey },
        bob.encryptionPublicKey,
        0.1
    );

    console.log('\n⏳ Blockchain onayı bekleniyor...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Bob mesajları okuyor ve şifresini çözüyor
    console.log('📬 Bob mesajları okuyor ve şifresini çözüyor...');
    const messages = await getEncryptedMessages(
        bob.wallet,
        { encryptionPrivateKey: bob.encryptionPrivateKey }
    );

    messages.forEach((msg, i) => {
        console.log(`\n[${i + 1}] 🔓 Çözülmüş Mesaj:`);
        console.log(`    Gönderen: ${msg.from}`);
        console.log(`    Mesaj: ${msg.message}`);
        console.log(`    Şifreli: ${msg.encrypted ? '✅' : '❌'}`);
        console.log(`    Zaman: ${msg.time}`);
    });
}

// Modül export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        encryptMessage,
        decryptMessage,
        sendEncryptedMessage,
        getEncryptedMessages
    };
}

// Direkt çalıştırılırsa demo'yu başlat
if (require.main === module) {
    demo().catch(console.error);
}
