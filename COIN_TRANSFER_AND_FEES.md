# TraceNet Coin Transfer ve Ücretlendirme Dokümantasyonu

Bu belge, TraceNet blok zinciri üzerindeki coin transfer işlemleri, ilgili API uç noktaları (endpoints), ücretlendirme modelleri ve genel token ekonomisi hakkında teknik detayları içerir.

---

## 1. Token Ekonomisi (Tokenomics)

*   **Sembol:** LT (TraceNet Token)
*   **Ondalık (Decimals):** 8
*   **Toplam Arz:** 100,000,000 LT
*   **En Küçük Birim:** 1 LT = 100,000,000 birim (atomic unit)

---

## 2. API Uç Noktaları (Endpoints)

TraceNet coin transferleri ve bakiye sorgulamaları için aşağıdaki RPC ve API uç noktalarını sunar.

### 2.1. Bakiye Sorgulama

Belirtilen cüzdan adresinin güncel bakiyesini döndürür.

*   **URL:** `/rpc/balance/:address`
*   **Method:** `GET`
*   **Parametreler:**
    *   `address`: Cüzdan adresi (Örn: `TRN...`)
*   **Başarılı Yanıt:**
    ```json
    {
      "balance": 15000000000, // En küçük birim cinsinden (150 LT)
      "confirmed": true
    }
    ```

### 2.2. Transfer Ücreti Hesaplama

Dinamik ücret modeline göre bir transferin tahmini maliyetini hesaplar.

*   **URL:** `/rpc/calculateTransferFee`
*   **Method:** `POST`
*   **Payload:**
    ```json
    {
      "recipient_address": "TRN...", // Alıcı adresi
      "amount": 100000000,           // Miktar (en küçük birim)
      "priority": "STANDARD"         // Öncelik seviyesi (STANDARD, LOW, MEDIUM, HIGH)
    }
    ```
*   **Başarılı Yanıt:**
    ```json
    {
      "total_fee": 10000, // Hesaplanan toplam ücret
      "breakdown": {
          "base_fee": 5000,
          "priority_fee": 0
      }
    }
    ```

### 2.3. Ham İşlem Gönderme (Transfer)

İmzanlanmış bir işlemi (transfer, sosyal etkileşim vb.) ağa yayınlar.

*   **URL:** `/rpc/sendRawTx`
*   **Method:** `POST`
*   **Payload:** (`TransactionModel` yapısında)
    ```json
    {
      "id": "uuid...",
      "type": "TRANSFER",
      "sender_wallet_id": "TRN...",
      "target_wallet_id": "TRN...",
      "amount": 100000000,
      "fee": 1000,
      "timestamp": 1715421234567,
      "payload": {
          "priority": "STANDARD"
      },
      "sender_public_key": "hex...",
      "sender_signature": "hex..."
    }
    ```

---

## 3. Ücretlendirme Yapısı (Fee Structure)

TraceNet, ağın sağlığı ve sürdürülebilirliği için çeşitli işlemlerden ücret alır.

### 3.1. Coin Transfer Ücretleri (Dinamik)

Transfer ücretleri, alıcının işlem yoğunluğuna ve göndericinin seçtiği öncelik seviyesine göre **dinamik** olarak hesaplanır.

#### Baz Ücret (Base Fee)
Alıcının son 1 yılda aldığı toplam transfer sayısına göre belirlenir. Yoğun hesaplara para göndermek daha maliyetli olabilir.

| Kademe | Eşik (Gelen Transfer) | Oran (Rate) | Açıklama |
| :--- | :--- | :--- | :--- |
| **Tier 0** | 0 - 49 | %0.01 | Standart kullanıcılar |
| **Tier 1** | 50 - 99 | %0.025 | Aktif kullanıcılar |
| **Tier 2** | 100 - 199 | %0.05 | - |
| **Tier 3** | 200+ | %0.10 | Ticari/Yoğun cüzdanlar |

#### Öncelik Ücreti (Priority Fee)
İşlemin daha hızlı onaylanması için eklenen opsiyonel ücret.

| Öncelik | Ek Maliyet |
| :--- | :--- |
| **STANDARD** | +%0 |
| **LOW** | +%0.20 |
| **MEDIUM** | +%0.60 |
| **HIGH** | +%1.00 |

### 3.2. Sabit İşlem Ücretleri (Sosyal & Diğer)

Sosyal etkileşimler ve diğer sistem işlemleri için sabit ücretler uygulanır.

| İşlem Tipi | Maliyet (Atomic Unit) | Maliyet (LT) | Dağılım |
| :--- | :--- | :--- | :--- |
| **Mesaj Gönderme** | 200 | 0.000002 LT | %100 Hazine/Node |
| **Beğeni (Like)** | 2000 | 0.00002 LT | %50 Yazar / %50 Hazine |
| **Yorum (Comment)** | 2000 | 0.00002 LT | %50 Yazar / %50 Hazine |
| **Takip (Follow)** | 100 | 0.000001 LT | - |
| **Takibi Bırak** | 100 | 0.000001 LT | - |
| **Profil Gizlilik** | 500 | 0.000005 LT | - |
| **Key Rotasyonu** | 1000 | 0.00001 LT | - |

---

## 4. SDK ile Transfer Örneği

TraceNet SDK kullanarak basit bir transfer işlemi aşağıdaki gibi gerçekleştirilir:

```typescript
import { TraceNetSDK } from './sdk/TraceNetSDK';

// 1. Cüzdan ve SDK Başlatma
const wallet = TraceNetSDK.createWallet("mnemonic words...");
const sdk = new TraceNetSDK('https://api.tracenet.com', wallet);

// 2. Transfer Yapma
const recipient = "TRN_ALICI_ADRESI...";
const amountInLT = 100;
const amountInSmallestUnit = amountInLT * 100_000_000;

const result = await sdk.transfer(
    recipient,
    amountInSmallestUnit,
    { priority: 'STANDARD' } // Opsiyonel: LOW, MEDIUM, HIGH
);

if (result.success) {
    console.log(`Transfer Başarılı! TX ID: ${result.tx_id}`);
} else {
    console.error(`Hata: ${result.error}`);
}
```

### 4.1. Transfer Mantığı (Arka Plan)

`sdk.transfer` fonksiyonu arka planda şu adımları izler:
1.  `/rpc/calculateTransferFee` ile gerekli ücreti öğrenir.
2.  `TransactionModel` kullanarak yerel olarak bir işlem nesnesi oluşturur.
3.  Cüzdanın `privateKey`'i ile işlemi imzalar (Ed25519).
4.  İmzalı veriyi `/rpc/sendRawTx` uç noktasına gönderir.
