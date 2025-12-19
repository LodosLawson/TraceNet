# TraceNet Sosyal Etkileşim Protokolü (Social Interactions)

Bu belge, TraceNet üzerinde kullanıcıların birbirleriyle etkileşime girmesini sağlayan "Takip Etme", "Beğenme", "Yorum Yapma" ve "İçeriğe Yanıt Verme" işlemlerinin teknik detaylarını ve veri yapılarını açıklar.

Tüm bu işlemler standart `Transaction` yapısı içinde taşınır ancak `payload` ve `type` alanları farklılaşır.

---

## 1. Kullanıcı Takip (Follow & Unfollow)

Bir kullanıcıyı takip etmek veya takibi bırakmak için kullanılan işlemlerdir. Bu işlemler **ÜCRETSİZDİR** (Sadece işlem yayınlama maliyeti olabilir ancak protokol seviyesinde özel bir ücret kesilmez).

### Takip Etme (Follow)

*   **İşlem Tipi:** `TransactionType.FOLLOW` ('FOLLOW')
*   **Ücret (Fee):** 0 LT
*   **Miktar (Amount):** 0 LT

**Payload Yapısı:**
```json
{
  "action_type": "FOLLOW",
  "target_wallet_id": "TRN...", // Takip edilecek kullanıcının cüzdan adresi
  "timestamp": 1715421234567,   // İşlem zaman damgası
  "follow_id": "uuid..."        // (İsteğe bağlı, sistem üretir)
}
```

### Takipten Çıkma (Unfollow)

*   **İşlem Tipi:** `TransactionType.UNFOLLOW` ('UNFOLLOW')
*   **Ücret (Fee):** 0 LT
*   **Miktar (Amount):** 0 LT

**Payload Yapısı:**
```json
{
  "action_type": "UNFOLLOW",
  "target_wallet_id": "TRN...", // Takipten çıkılacak adres
  "timestamp": 1715421234567
}
```

---

## 2. İçerik Beğenme (Like)

Yüksek kaliteli içerikleri ödüllendirmek için kullanılır. Beğeni işlemi ücretlidir ve bu ücretin **%50'si doğrudan içerik üreticisine** gider.

*   **İşlem Tipi:** `TransactionType.LIKE` ('LIKE')
*   **Toplam Maliyet:** `0.00002 LT` (TokenConfig.LIKE_FEE)
*   **Dağılım:**
    *   %50 -> İçerik Sahibine (Creator) Transfer edilir.
    *   %50 -> Hazineye (Treasury) gider.

**Payload Yapısı:**
```json
{
  "action_type": "LIKE",
  "content_id": "uuid...",        // Beğenilen içeriğin ID'si
  "target_content_id": "uuid...", // (Aynı değer, uyumluluk için)
  "timestamp": 1715421234567
}
```

> **Not:** Sistem şu anda sadece `POST_CONTENT` (Gönderi) tipindeki içeriklerin beğenilmesini desteklemektedir. Yorumların beğenilmesi için yorumun da bir "İçerik" olarak indekslenmesi gerekir.

---

## 3. Yorum Yapma (Comment)

İçeriklere yorum yapmak veya yorumlara cevap vermek için kullanılır.

*   **İşlem Tipi:** `TransactionType.COMMENT` ('COMMENT')
*   **Toplam Maliyet:** `0.00002 LT` (TokenConfig.COMMENT_FEE)
*   **Dağılım:**
    *   %50 -> İçeriğin (Postun) Sahibine gider.
    *   %50 -> Hazineye gider.

### Standart Yorum

**Payload Yapısı:**
```json
{
  "action_type": "COMMENT",
  "comment_id": "sha256...",     // Yorum için benzersiz ID (istemci veya sunucu üretebilir)
  "content_id": "uuid...",       // Yorum yapılan ana gönderi ID'si
  "target_content_id": "uuid...",
  "comment_text": "Harika bir yazı!", // Yorum metni (Max 1000 karakter)
  "timestamp": 1715421234567
}
```

### Yorum'a Cevap Verme (Nested Comment)

Bir yoruma yanıt verirken, `parent_comment_id` alanı **ZORUNLUDUR**.

**Payload Yapısı:**
```json
{
  "action_type": "COMMENT",
  "comment_id": "sha256...",
  "content_id": "uuid...",           // Ana gönderi ID'si (Hala gereklidir)
  "target_content_id": "uuid...",
  "parent_comment_id": "sha256...",  // Yanıt verilen YORUMUN ID'si
  "comment_text": "Katılıyorum.",
  "timestamp": 1715421234567
}
```

---

## 4. Coin/Token Takibi (Watchlist)

TraceNet protokolü üzerinde "Coin Takip Etme" (Watchlist) için özel bir işlem tipi (Transaction Type) **yoktur**.

Bu özellik genellikle **istemci taraflı (Client-Side)** çalışır:
1.  Uygulamanız kullanıcının favori coin listesini yerel veritabanında (Local Storage, SQLite vb.) tutar.
2.  Blok zincirinden sadece bu listedeki adreslerin veya varlıkların verilerini çekersiniz.
3.  Eğer bu takibin blok zincirine kaydedilmesi isteniyorsa (cihazlar arası senkronizasyon için), bu veri şifreli bir `PROFILE_UPDATE` işlemi içinde "tercihler" (preferences) alanında saklanabilir.

---

## Özet Tablo

| Eylem | İşlem Tipi | Maliyet (LT) | Kime Gider? | Ekstra Payload Alanı |
| :--- | :--- | :--- | :--- | :--- |
| **Takip Et** | `FOLLOW` | 0 | - | `target_wallet_id` |
| **Takibi Bırak** | `UNFOLLOW` | 0 | - | `target_wallet_id` |
| **Beğen** | `LIKE` | 0.00002 | %50 Yazar / %50 Hazine | `content_id` |
| **Yorum** | `COMMENT` | 0.00002 | %50 Yazar / %50 Hazine | `comment_text` |
| **Yanıtla** | `COMMENT` | 0.00002 | %50 Yazar / %50 Hazine | `parent_comment_id` |
