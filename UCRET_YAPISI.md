# TraceNet V2.6 - Ödeme Fiyatları (Fee Structure)

**Son Güncelleme:** 31 Aralık 2024  
**Network:** TraceNet Mainnet V2.6  
**Token:** TNN (TraceNet Token)

---

## 💰 Sosyal İşlem Ücretleri (Zorunlu Minimum)

| İşlem | Minimum Ücret | Maksimum Ücret | Notlar |
|-------|---------------|----------------|---------|
| ❤️ **Beğeni (LIKE)** | 0.00001 TNN | Sınırsız | Spam önleme için zorunlu |
| 💬 **Yorum (COMMENT)** | 0.00002 TNN | Sınırsız | Beğeniden 2x daha yüksek |
| 👤 **Takip (FOLLOW)** | 0.00001 TNN | Sınırsız | Her takip işlemi için |
| 👋 **Takipten Çık (UNFOLLOW)** | 0.00001 TNN | Sınırsız | Her çıkış işlemi için |
| 📝 **Post Paylaş (POST_CONTENT)** | 0 TNN | Sınırsız | Şu an ücretsiz (geçici) |
| 🔄 **Paylaş (SHARE)** | 0 TNN | Sınırsız | Opsiyonel ücret |

> **Önemli:** Sosyal işlemler için ödenen ücretler:
> - %50 → İçerik sahibine
> - %25 → Node sahibine
> - %25 → Hazineye (Treasury)

---

## 💸 Transfer Ücretleri (Dinamik)

Transfer ücretleri **alıcının popülaritesine** göre otomatik hesaplanır:

### Temel Oran (Base Rate)

| Alıcı Seviyesi | Yıllık Transfer Sayısı | Oran |
|----------------|------------------------|------|
| **Tier 0** (Yeni) | 0 - 9 transfer | 0.001% |
| **Tier 1** (Aktif) | 10 - 99 transfer | 0.005% |
| **Tier 2** (Popüler) | 100 - 999 transfer | 0.01% |
| **Tier 3** (Çok Popüler) | 1000+ transfer | 0.02% |

### Öncelik Ek Ücreti (Priority Surcharge)

| Öncelik | Ek Oran | Toplam Bekleme |
|---------|---------|----------------|
| **STANDARD** | +0% | Normal (5 saniye) |
| **HIGH** | +0.005% | Hızlı (anında) |
| **URGENT** | +0.01% | Çok hızlı (garantili) |

### Örnek Hesaplama

**Senaryo:** 100 TNN gönderiyorsunuz, alıcı Tier 1 (50 transfer/yıl)

- **STANDARD:** 100 × (0.005% + 0%) = **0.005 TNN**
- **HIGH:** 100 × (0.005% + 0.005%) = **0.01 TNN**
- **URGENT:** 100 × (0.005% + 0.01%) = **0.015 TNN**

---

## ✉️ Mesajlaşma Ücretleri (Zaman Bazlı)

TraceNet V2 mesajlaşma sistemi **zaman penceresi** kullanır:

| Mod | Minimum Ücret | Bekleme Süresi | Blok Oluşturma |
|-----|---------------|----------------|----------------|
| **FAST** | 0.00001 TNN | 0 saniye | Anında |
| **STANDARD** | 0.0000001 TNN | 10 dakika | 10 dakika sonra |
| **LOW** | 0.00000001 TNN | 1 saat | 1 saat sonra |

> **Not:** Mesajlar "batch transaction" olarak gruplandırılır, blok boyutunu küçültür.

---

## 🏦 Diğer İşlem Ücretleri

| İşlem Tipi | Ücret | Açıklama |
|------------|-------|----------|
| **Profil Güncelleme (PROFILE_UPDATE)** | 0 TNN | Ücretsiz (ilk güncelleme) |
| **Airdrop (REWARD)** | 0 TNN | Sistem otomatik ödeme |
| **Batch Transaction** | 0.00001 TNN | Validator ücreti |

---

## 📊 Ücret Dağılımı

### Transfer İşlemleri:
- **%50** → Node sahibi
- **%50** → Hazine (Treasury)

### Sosyal İşlemler (Like, Comment, Follow):
- **%50** → İçerik sahibi
- **%25** → Node sahibi
- **%25** → Hazine

### Mesaj İşlemleri:
- **%100** → Mesaj alıcısı

---

## 🎁 İlk Cüzdan Bonusu (Tek Seferlik)

Yeni cüzdan oluşturulduğunda otomatik olarak verilir:

- **Cüzdan Oluşturma:** 0.00625 TNN (625,000 units)

> **Not:** Başka hiçbir otomatik bonus YOK (kayıt bonusu, profil bonusu, takipçi bonusu vb.)

---

## 💸 Coin Kazanma Yöntemleri

Kullanıcılar sadece **içerik sahipleri olarak** fee'lerden coin kazanır:

### 1. Postuna Beğeni Geldiğinde
- Beğenen kişi öder: **0.00001 TNN**
- **SEN kazanırsın:** 0.000005 TNN (%50)
- Node: 0.0000025 TNN (%25)
- Hazine: 0.0000025 TNN (%25)

### 2. Postuna Yorum Geldiğinde
- Yorum yapan öder: **0.00002 TNN**
- **SEN kazanırsın:** 0.00001 TNN (%50)
- Node: 0.000005 TNN (%25)
- Hazine: 0.000005 TNN (%25)

### 3. Yorumuna Beğeni Geldiğinde
- Beğenen kişi öder: **0.00001 TNN**
- **SEN kazanırsın:** 0.000005 TNN (%50)
- Node + Hazine: Kalan %50

### Örnek Senaryo:
```
Bir post paylaşıyorsun:
- 100 beğeni alırsın → 0.0005 TNN kazanırsın
- 20 yorum gelir → 0.0002 TNN kazanırsın
- Yorumlara 50 beğeni → 0.00025 TNN kazanırsın

TOPLAM: 0.00095 TNN kazandın!
```

---

## 💡 Ücret Minimizasyon İpuçları

### 1. Transfer için:
- Popüler olmayan adresler seçin (Tier 0/1)
- STANDARD öncelik kullanın
- Toplu gönderimde batch kullanın

### 2. Mesajlaşma için:
- **ACIL DEĞİLSE:** LOW priority seçin (100x daha ucuz!)
- Aynı kişiye çok mesaj → Batch kullanın
- Özel mesajlar için encryption kullanın

### 3. Sosyal işlemler için:
- Beğeni spam yapmayın (her beğeni ücretli)
- Yorumları özenle yazın (beğeniden 2x pahalı)
- Takip/çıkış sık yapmayın

---

## ⚠️ Önemli Notlar

1. **Tüm ücretler TNN cinsinden** hesaplanır
2. **Yetersiz bakiye** = Transaction reddedilir
3. **Nonce yanlışsa** = Transaction geçersiz
4. **Her transaction** geri alınamaz (blockchain)
5. **Ücretler** blok içinde otomatik dağıtılır

---

## 🔒 Güvenlik

- **Replay Protection:** Nonce sistemi
- **Spam Prevention:** Minimum ücretler
- **Rate Limiting:** API seviyesinde aktif
- **Fee Tampering:** İmza ile korunur

---

## 📈 Gelecek Güncellemeler

Planlanan değişiklikler:
- [ ] POST_CONTENT için minimum ücret (0.0001 TNN)
- [ ] Validator staking gereksinimleri
- [ ] Dynamic fee adjustment (network load bazlı)
- [ ] Fee burn mechanism (deflasyon)

---

**Hesaplama API Endpoint:**
```bash
POST https://tracenet-blockchain.run.app/rpc/calculateTransferFee

{
  "to_wallet": "TRNxxx...",
  "amount": 100,
  "priority": "STANDARD"
}

Response: { "fee": 0.005 }
```

**Canlı Ücret Görüntüleme:**
- Frontend uygulamalarda her işlem için otomatik hesaplanır
- `/rpc/status` endpoint'inden network durumu görülebilir

---

*Bu döküman TraceNet V2.6 için geçerlidir. Ücret yapısı consensus kurallarına bağlıdır ve fork olmadan değiştirilemez.*
