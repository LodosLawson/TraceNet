# TraceNet V3 Node Setup & Run Guide

Bu rehber, TraceNet V3 Node'unuzu en güncel güvenlik ve ağ politikalarıyla nasıl çalıştıracağınızı anlatır.

## 1. Ön Hazırlıklar

### Gereksinimler
- **Node.js**: v20 veya üzeri
- **Git**
- **İnternet**: P2P (Port 3000) erişimi açık olmalı

### Kurulum
Eğer projeyi henüz çekmediyseniz:
```bash
git clone https://github.com/LodosLawson/TraceNet.git
cd TraceNet
npm install
```

Eğer zaten çektiyseniz, güncellemeleri alın:
```bash
git pull origin main
npm install
```

---

## 2. Konfigürasyon ve Güvenlik (ÇOK ÖNEMLİ)

### Adım 2.1: .env Dosyası
Ana dizinde `.env` dosyası oluşturun. Şu şablonu kullanın:

```env
# --- Node Ayarları ---
NODE_ENV=production
PORT=3000

# --- Ağ Ayarları ---
# Mainnet Bağlantısı (Sabittir, ellemeyin)
GENESIS_VALIDATOR_PUBLIC_KEY=16f825680345ce415a6f5aeee5d2c30cfc380cb986ad9fd6bd1692241ac1cc79
BOOTSTRAP_NODES=["https://tracenet-blockchain-136028201808.us-central1.run.app"]
CORS_ORIGIN=["http://localhost:5173","https://tracenet.app"]

# --- Güvenlik ---
# Buraya JSON Web Token için güçlü, rastgele bir string girin
JWT_SECRET=BU_KISMA_COK_UZUN_RASTGELE_BIR_SIFRE_YAZIN_EN_AZ_32_KARAKTER

# --- Auto Update ---
AUTO_UPDATE=false
```

> **DİKKAT:** `.env` dosyanıza artık `PRIVATE_KEY` YAZMAYIN! Anahtarlar şifreli KeyStore'da saklanacak.

### Adım 2.1a: Google Cloud Run (Bulut) için Ayarlar
Bulut ortamında `.env` dosyası yoktur. Değişkenleri Google Cloud Console üzerinden girmeniz gerekir:

1.  **Google Cloud Console** > **Cloud Run** > Node Servisinizi Seçin.
2.  **Edit & Deploy New Revision** butonuna tıklayın.
3.  **Variables & Secrets** (veya Container) sekmesine gidin.
4.  Şu değişkenleri tek tek ekleyin:
    *   `NODE_ENV`: `production`
    *   `KEYSTORE_PASSWORD`: (Kendi belirlediğiniz güçlü bir şifre)
    *   `JWT_SECRET`: (Rastgele uzun bir string)
    *   `NODE_ROLE`: `validator` (Eğer validatör olacaksanız)
    *   `VALIDATOR_PRIVATE_KEY`: (Validatör anahtarınız - *Bulut ortamında dosya yükleyemediğimiz için buraya yazıyoruz*)
5.  **Deploy** butonuna basın.

---

### Sıkça Sorulan Sorular: Yerel Node Nasıl Çalışır?
Lokal bilgisayarınızda kurulu Node, kendi hard diskinizdeki dosyalara erişebilir.
*   **Şifre:** Bilgisayarı siz açtığınız için, Node başlarken şifreyi klavyeden girebilirsiniz veya `.env` içine yazabilirsiniz.
*   **Anahtarlar:** `secrets/keystore.json` dosyasında şifreli durur.
*   **Bulut Farkı:** Bulut sunucuları (Cloud Run) her an kapanıp açılabilir ve başında klavye başında bekleyen kimse yoktur. Bu yüzden şifreleri "Environment Variable" olarak hafızasına kazırız.

### Adım 2.2: Anahtar Taşıma (Key Migration)
Eski `.env` dosyanızda private key'leriniz varsa veya yeni key oluşturduysanız, bunları şifreli kasaya (KeyStore) taşımanız gerekir.

1.  Eğer var olan keyleriniz varsa, geçici olarak `.env` içine ekleyin:
    ```env
    VALIDATOR_PRIVATE_KEY=eski_keyiniz
    NODE_WALLET_PRIVATE_KEY=eski_wallet_keyiniz
    ```
2.  Migration aracını çalıştırın:
    ```bash
    npx ts-node src/tools/migrate_keys.ts
    ```
3.  Size bir **KeyStore Parolası** soracaktır. Güçlü bir parola belirleyin ve UNUTMAYIN.
4.  İşlem bitince `.env` dosyasındaki key satırlarını **SİLİN**.

> Artık keyleriniz `secrets/keystore.json` içinde şifreli duruyor.

---

## 3. Node'u Çalıştırma

Node'u her başlattığınızda KeyStore parolanızı girmeniz gerekecek (veya `KEYSTORE_PASSWORD` env değişkeni olarak verebilirsiniz).

### Geliştirme Modu (Logları görmek için)
```bash
npm run build
npm start
```
*Sizden parola isteyecektir.*

### Prodüksiyon / Arka Planda Çalıştırma (PM2)
Sunucu kapanınca node'un tekrar açılması için PM2 kullanın.

1.  PM2 yükleyin:
    ```bash
    npm install -g pm2
    ```
2.  Parolayı env değişkeni olarak vererek başlatın (ki sormasın):
    ```bash
    # CMD (Windows)
    set KEYSTORE_PASSWORD=sizin_parolaniz && pm2 start dist/index.js --name "tracenet"
    
    # PowerShell
    $env:KEYSTORE_PASSWORD="sizin_parolaniz"; pm2 start dist/index.js --name "tracenet"
    
    # Linux/Mac
    KEYSTORE_PASSWORD=sizin_parolaniz pm2 start dist/index.js --name "tracenet"
    ```
3.  Başlangıçta otomatik açılması için:
    ```bash
    pm2 save
    pm2 startup
    ```

---

## 4. Explorer (Frontend) Çalıştırma

3D Explorer arayüzünü görmek için:

```bash
cd frontend
npm install
npm run dev
```
Tarayıcıda `http://localhost:5173` adresine gidin.

---

## 5. Doğrulama

Node çalışıyorken:
1.  **Status Check**: `http://localhost:3000/rpc/status` adresine gidin.
2.  **Peers**: `connectedPeers` sayısının 0'dan büyük olduğunu görün.
3.  **Sync**: `height` değerinin arttığını kontrol edin.

---
**Sorun Giderme:**
- `"Wrong password"` hatası alırsanız: KeyStore parolasını yanlış girdiniz.
- `"No peers found"` diyorsa: Firewall'dan 3000 portunu (TCP) açın.
- `"Invalid Genesis Block"` diyorsa: `data/chain.json` silip tekrar deneyin (Fresh sync).
