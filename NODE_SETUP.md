# TraceNet Mainnet Node Setup Guide

Bu rehber, TraceNet Mainnet'e bağlanan bir node'u nasıl kuracağınızı ve çalıştıracağınızı anlatır.

## 1. Gereksinimler
- Node.js (v18 veya üzeri)
- Git
- İnternet bağlantısı

## 2. Kurulum
Projeyi klonlayın ve bağımlılıkları yükleyin:
```bash
git clone https://github.com/LodosLawson/TraceNet.git
cd TraceNet
npm install
```

## 3. .env Konfigürasyonu
Ana dizinde `.env` dosyası oluşturun (veya bu repo'daki hazır `.env` dosyasını kullanın).

**Önemli:** Mainnet'e bağlanmak için `VALIDATOR_PRIVATE_KEY` kullan**ma**yın. Sadece aşağıdaki ayarları yapın.

```env
# Node Ayarları
NODE_ENV=production
PORT=3000

# Mainnet Bağlantısı (Kritik!)
GENESIS_VALIDATOR_PUBLIC_KEY=16f825680345ce415a6f5aeee5d2c30cfc380cb986ad9fd6bd1692241ac1cc79
PEERS=https://tracenet-blockchain-136028201808.us-central1.run.app

# Auto-Update (GitHub'dan otomatik güncelleme için)
AUTO_UPDATE=true

# Public Host (Opsiyonel - Frontend'in bağlanması için)
# Eğer yerel çalışıyorsanız:
PUBLIC_HOST=http://localhost:3000
```

> **Not:** `VALIDATOR_PRIVATE_KEY` satırını SİLİN. Eğer silmezseniz, node'unuz Mainnet bloklarını reddeder ve "Invalid block signature" hatası alırsınız.

## 4. Node'u Çalıştırma

### İlk Çalıştırma (Build & Start)
```bash
npm run build
npm start
```

### Arka Planda Çalıştırma (PM2 ile - Önerilen)
Node'un kapanmaması ve bilgisayar açılınca başlaması için:
```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name "tracenet-node"
pm2 save
```

## 5. Nasıl Çalıştığını Kontrol Etme
Tarayıcınızda şu adrese gidin:
- **Arayüz:** http://localhost:3000
- **Durum:** http://localhost:3000/rpc/status

**Logları okuma:**
Eğer `npm start` ile başlattıysanız terminalde logları görürsünüz.
Başarılı bağlantı mesajları:
- `✅ System validator 'SYSTEM' is ready`
- `[P2P] Connected to https://tracenet-blockchain...`
- `[P2P] Synced 10 blocks successfully`

## Sık Sorulan Sorular

**S: Neden "Invalid block signature" hatası alıyorum?**
C: `.env` dosyanızda `VALIDATOR_PRIVATE_KEY` var ama Mainnet'in onaylı validatörü değilsiniz. O satırı silin.

**S: Blok üretebilir miyim?**
C: Hayır, sadece Mainnet validatörleri blok üretebilir. Sizin node'unuz blokları **doğrular**, **saklar** ve frontend'e servis eder ("Full Node").
