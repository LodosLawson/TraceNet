# TraceNet V2.6 - Ödeme Fiyatları (Fee Structure)

**Son Güncelleme:** 3 Ocak 2026
**Network:** TraceNet Mainnet V2.6  
**Token:** TRN (TraceNet Token)

---

## 💰 Sosyal İşlem Ücretleri (Zorunlu Minimum)

| İşlem | Minimum Ücret | Maksimum Ücret | Notlar |
|-------|---------------|----------------|---------|
| ❤️ **Beğeni (LIKE)** | 0.00001 TRN | Sınırsız | Spam önleme için zorunlu (Anında: 2x) |
| 💬 **Yorum (COMMENT)** | 0.00002 TRN | Sınırsız | Beğeniden 2x daha yüksek (Anında: 2x) |
| 👤 **Takip (FOLLOW)** | 0.00001 TRN | Sınırsız | Her takip işlemi için |
| 👋 **Takipten Çık (UNFOLLOW)** | 0.00001 TRN | Sınırsız | Her çıkış işlemi için |
| 📝 **Post Paylaş (POST_CONTENT)** | 0 TRN | Sınırsız | Şu an ücretsiz (geçici) |
| 🔄 **Paylaş (SHARE)** | 0 TRN | Sınırsız | Opsiyonel ücret |

> **Önemli:** Sosyal işlemler için ödenen ücretler:
> - %45 → İçerik sahibine
> - %30 → Mining Pool
> - %20 → Recycle (Supply)
> - %5 → Ağ Geliştirme
>
> **Anında İşlem (Instant Actions):**
> Normal sosyal işlemler 5-10 dakika batch süresi ile kuyruğa girer.
> Kullanıcı **anında onay** isterse (2x ücret) öder (Örn: Like için 0.00002 TRN) ve işlem kuyruğa girmeden direkt Mempool'a iletilir.

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

**Senaryo:** 100 TRN gönderiyorsunuz, alıcı Tier 1 (50 transfer/yıl)

- **STANDARD:** 100 × (0.005% + 0%) = **0.005 TRN**
- **HIGH:** 100 × (0.005% + 0.005%) = **0.01 TRN**
- **URGENT:** 100 × (0.005% + 0.01%) = **0.015 TRN**

---

## ✉️ Mesajlaşma Ücretleri (Zaman Bazlı)

TraceNet V2 mesajlaşma sistemi **zaman penceresi** kullanır:

| Mod | Minimum Ücret | Bekleme Süresi | Blok Oluşturma |
|-----|---------------|----------------|----------------|
| **FAST** | 0.00001 TRN | 0 saniye | Anında |
| **STANDARD** | 0.0000001 TRN | 10 dakika | 10 dakika sonra |
| **LOW** | 0.00000001 TRN | 1 saat | 1 saat sonra |

> **Not:** Mesajlar "batch transaction" olarak gruplandırılır, blok boyutunu küçültür.

---

## 🏦 Diğer İşlem Ücretleri

| İşlem Tipi | Ücret | Açıklama |
|------------|-------|----------|
| **Profil Güncelleme (PROFILE_UPDATE)** | 0 TRN | Ücretsiz (ilk güncelleme) |
| **Airdrop (REWARD)** | 0 TRN | Sistem otomatik ödeme |
| **Batch Transaction** | 0.00001 TRN | Validator ücreti |

---

## 📊 Ücret Dağılımı

### Transfer İşlemleri:
- **%45** → Node sahibi
- **%30** → Mining Pool
- **%20** → Supply (Recycle)
- **%5**  → Ağ Geliştirme

### Sosyal İşlemler (Like, Comment, Follow):
- **%45** → İçerik sahibi
- **%30** → Mining Pool
- **%20** → Supply (Recycle)
- **%5**  → Ağ Geliştirme

### Mesaj İşlemleri:
- **%100** → Mesaj alıcısı (Değişmedi)

---

## 🎁 İlk Cüzdan Bonusu (Tek Seferlik)

Yeni cüzdan oluşturulduğunda otomatik olarak verilir:

- **Cüzdan Oluşturma:** 0.00625 TRN (625,000 units)

> **Not:** Başka hiçbir otomatik bonus YOK (kayıt bonusu, profil bonusu, takipçi bonusu vb.)

---

## 💸 Coin Kazanma Yöntemleri

Kullanıcılar sadece **içerik sahipleri olarak** fee'lerden coin kazanır:

### 1. Postuna Beğeni Geldiğinde
- Beğenen kişi öder: **0.00001 TRN**
- **SEN kazanırsın:** 0.0000045 TRN (%45)
- Mining Pool: 0.000003 TRN (%30)
- Recycle: 0.000002 TRN (%20)
- Dev: 0.0000005 TRN (%5)

### 2. Postuna Yorum Geldiğinde
- Yorum yapan öder: **0.00002 TRN**
- **SEN kazanırsın:** 0.000009 TRN (%45)
- Mining Pool: 0.000006 TRN (%30)
- Recycle: 0.000004 TRN (%20)
- Dev: 0.000001 TRN (%5)

### 3. Yorumuna Beğeni Geldiğinde
- Beğenen kişi öder: **0.00001 TRN**
- **SEN kazanırsın:** 0.0000045 TRN (%45)
- Kalan %55 → Pool/Recycle/Dev dağıtılır

### Örnek Senaryo:
```
Bir post paylaşıyorsun:
- 100 beğeni alırsın → 0.00045 TRN kazanırsın
- 20 yorum gelir → 0.00018 TRN kazanırsın
- Yorumlara 50 beğeni → 0.000225 TRN kazanırsın

TOPLAM: 0.000855 TRN kazandın!
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

1. **Tüm ücretler TRN cinsinden** hesaplanır
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
- [ ] POST_CONTENT için minimum ücret (0.0001 TRN)
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
