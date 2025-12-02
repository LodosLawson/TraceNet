# TraceNet API Örnekleri

Bu klasörde TraceNet Blockchain API'sini kullanmak için örnek kodlar bulunmaktadır.

## 📚 Mevcut Örnekler

### Mesajlaşma
- **`messaging_simple.js`** - Basit mesaj gönderme örneği
- **`messaging_encrypted.js`** - Şifreli mesajlaşma örneği (TweetNaCl)

### Diğer Örnekler
- **`user_creation_example.js`** - Kullanıcı oluşturma örneği

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükle
```bash
npm install
```

### 2. Örneği Çalıştır
```bash
node examples/messaging_simple.js
```

## 📖 Dokümantasyon

Detaylı API dokümantasyonu için:
- [Mesajlaşma API](../docs/MESSAGING_API.md)
- [Mesajlaşma Tutorial](../docs/MESSAGING_TUTORIAL.md)
- [Full API Documentation](../FULL_API_DOCUMENTATION.md)

## 🌐 Demo Sayfaları

Tarayıcıda çalışan interactive demolar:
- [Mesajlaşma Demo](http://localhost:3000/messaging.html)
- [Tüm API Örnekleri](http://localhost:3000/api-examples.html)

## 💡 İpuçları

- Tüm örnekler cloud API'yi kullanır: `https://tracenet-blockchain-bbzxtm72vq-uc.a.run.app`
- Test için örnek kullanıcılar otomatik oluşturulur
- Şifreleme için TweetNaCl kütüphanesi kullanılır
