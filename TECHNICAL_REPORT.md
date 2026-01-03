# TraceNet Teknik Raporu

**Tarih:** 3 Ocak 2026
**Versiyon:** 2.6
**Konu:** Blockchain Mimarisi, Node Çalışma Prensibi ve Ücret Yapısı

---

## 1. Blockchain Mimarisi ve Çalışma Prensibi

TraceNet, sosyal ekonomi ve mesajlaşma odaklı, **Delegated Proof of Activity (DPoA)** konsensüs mekanizması üzerine kurulmuş özelleştirilmiş bir blockchain ağıdır.

### 1.1 Konsensüs Mekanizması (DPoA)
Geleneksel Proof of Work (Enerji odaklı) veya Proof of Stake (Zenginlik odaklı) yerine, TraceNet "Aktivite ve Katılım" odaklı bir yapı kullanır.

*   **Validator Seçimi:** Deterministik "Round-Robin with Fallback" algoritması kullanılır.
    *   Bir sonraki bloğu kimin üreteceği, blok yüksekliği ve önceki blok hash'ine göre matematiksel olarak bellidir: `(blockHeight + hash) % validatorCount`.
    *   **Fallback Sistemi:** Seçilen validator 5 saniye içinde blok üretmezse, sıra otomatik olarak bir sonraki validatöre geçer. Bu sayede ağ asla durmaz.
*   **Adil Madencilik Havuzu:** Ödüller sadece bloğu bulan nod’a değil, o pencerede (100 blok) aktif olan **tüm nodlara eşit** dağıtılır. Bu, küçük nodların da büyükler kadar kazanmasını sağlar.

### 1.2 Blok Yapısı ve Veri Modeli
TraceNet, Ethereum benzeri **Account-Based** (Hesap Bazlı) bir model kullanır.

*   **Blok Süresi:** ~5 saniye (Event-Driven: İşlem varsa anında blok üretilir).
*   **Veritabanı:** LevelDB (Hızlı, yerel Key-Value deposu).
*   **Yedekleme:** Her 100 blokta bir Google Cloud Storage'a otomatik şifreli yedekleme yapılır.

---

## 2. Node (Düğüm) Çalışma Prensibi

### 2.1 Node Mimarisi
Her TraceNet nodu iki ana katmandan oluşur:
1.  **Core Blockchain:** Blok doğrulama, State (bakiye/nonce) yönetimi ve kriptografik işlemler (Ed25519 imzaları).
2.  **Network Layer:** P2P iletişim ve RPC sunucusu.

### 2.2 İletişim Protokolleri
Nodlar birbirleriyle ve dış dünyayla üç farklı yol ile iletişim kurar:

1.  **P2P (Peer-to-Peer) Protokolü:**
    *   **Teknoloji:** `Socket.io` üzerinde çalışır.
    *   **Görevi:** Yeni blokları ve bekleyen işlemleri (Mempool) diğer nodlara yaymak.
    *   **Anti-Sybil Koruması:** Her IP adresinden sadece **bir adet** node çalışmasına izin verilir. Proxy arkasında bile gerçek IP tespit edilir (`X-Forwarded-For`).

2.  **RPC (Remote Procedure Call) API:**
    *   **Teknoloji:** Express.js (HTTP).
    *   **Görevi:** Cüzdanların bakiye sorgulaması, işlem göndermesi (`/rpc/sendRawTx`) ve zincir durumunu kontrol etmesi.

3.  **WebSocket Events:**
    *   **Görevi:** Frontend uygulamalarına (TraceNet Explorer gibi) anlık bildirim göndermek (Örn: "Yeni blok bulundu", "Hesabına para geldi").

### 2.3 Blok Üretim Döngüsü
Bir node nasıl blok üretir?
1.  **Mempool:** Gelen işlemler hafızada toplanır.
2.  **Sıra Kontrolü:** Node, "Şu an sıra bende mi?" kontrolü yapar.
3.  **Paketleme:** İşlemler doğrulanır (imza, bakiye, nonce kontrolü).
4.  **Üretim:** Blok oluşturulur, imzalanır ve ağa yayınlanır.
5.  **Ödül Dağıtımı:** Her 100 blokta bir biriken işlem ücretleri, aktif nodlar arasında paylaştırılır.

---

## 3. Ücret Listesi (Fee Schedule)

TraceNet V2.6 itibarıyla güncel işlem ücretleri aşağıdadır. Ücretler **TRN (TraceNet Token)** cinsindendir ve ağın güvenliğini/sürdürülebilirliğini sağlamak için alınır.

### Sosyal İşlemler
| İşlem Tipi | Ücret (TRN) | Açıklama |
| :--- | :--- | :--- |
| **Beğeni (LIKE)** | `0.00001` | %45'i içerik sahibine gider. |
| **Yorum (COMMENT)** | `0.00002` | Beğeniden 2x pahalıdır. %45'i içerik sahibine. |
| **Takip Et (FOLLOW)** | `0.00001` | Sosyal graph güncelleme maliyeti. |
| **Takipten Çık (UNFOLLOW)** | `0.00001` | Spam önleme amaçlı. |
| **Post Paylaş** | `0.00000` | Şu an için **ÜCRETSİZ**. |

### Finansal İşlemler
| İşlem Tipi | Ücret (TRN) | Açıklama |
| :--- | :--- | :--- |
| **Transfer (Standart)** | `0.000005`* | *Dinamik hesaplanır (Alıcı popülaritesine göre değişir). Min: 0.000005. |
| **Cüzdan Oluşturma** | `0.00000` | Ücretsiz + **625,000 Unit (0.00625 TRN) Hoşgeldin Bonusu**. |

### Mesajlaşma (Zaman Bazlı Tarife)
Mesajlar blockchain üzerinde şifreli saklanır. Hız ihtiyacına göre ücret değişir:

| Mod | Ücret (TRN) | Teslimat Süresi |
| :--- | :--- | :--- |
| **FAST (Acil)** | `0.00001` | **Anında** bloklanır (0 sn bekleme). |
| **STANDARD** | `0.0000001` | **10 Dakika** sonra bloklanır. |
| **LOW (Ekonomik)** | `0.00000001` | **1 Saat** sonra bloklanır (En ucuz). |

### Gelir Dağılım Modeli
Toplanan ücretler nereye gidiyor?
*   **%45** → İşlem türüne göre Node Sahibi (Miner) veya İçerik Üreticisi.
*   **%30** → Mining Pool (Tüm aktif nodlara dağıtılır).
*   **%20** → Coin Supply (Yakılır/Geri Döner - Enflasyonu dengeler).
*   **%5**  → Ağ Geliştirme Fonu (Network Owner).
