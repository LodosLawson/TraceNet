# Supabase Kurulum Rehberi

## 🚀 Hızlı Başlangıç

### 1. Supabase Hesabı Oluştur

1. https://supabase.com adresine git
2. "Start your project" tıkla
3. GitHub ile giriş yap (veya email)
4. Yeni organizasyon oluştur (ücretsiz)

### 2. Yeni Proje Oluştur

1. "New Project" tıkla
2. Proje bilgilerini gir:
   - **Name:** tracenet-blockchain
   - **Database Password:** Güçlü bir şifre (kaydet!)
   - **Region:** West US (veya size yakın)
   - **Pricing Plan:** Free (başlangıç için yeterli)

3. "Create new project" tıkla
4. 2-3 dakika bekle (database hazırlanıyor)

### 3. SQL Scriptlerini Çalıştır

Proje hazır olduğunda:

1. Sol menüden **SQL Editor** seç
2. "New query" tıkla

**Sırayla çalıştır:**

#### Part 1: Tables ve Indexes
```sql
-- part1-tables.sql içeriğini kopyala yapıştır
-- "Run" tıkla
```

#### Part 2: Triggers
```sql
-- part2-triggers.sql içeriğini kopyala yapıştır
-- "Run" tıkla
```

#### Part 3: Security (RLS)
```sql
-- part3-security.sql içeriğini kopyala yapıştır
-- "Run" tıkla
```

### 4. API Keys Al

1. Sol menüden **Settings** → **API** seç
2. Şu bilgileri kopyala:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (gizli tut!)
```

### 5. .env Dosyasını Güncelle

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Blockchain Backup Configuration
BACKUP_ENABLED=true
BACKUP_INTERVAL=100
BACKUP_KEEP_LAST=1000
BACKUP_AUTO_CLEANUP=true
```

---

## 📊 Oluşturulan Tablolar

### 1. users
- Kullanıcı profilleri
- Nickname, email, avatar, bio
- Metadata (JSON)

### 2. wallets
- Kullanıcı cüzdanları
- Multi-wallet support
- Balance cache

### 3. posts
- Kullanıcı postları
- Media URLs ve hash'ler
- On-chain tx_id referansı
- Like, comment, share sayaçları

### 4. comments
- Post yorumları
- Nested comments (parent_comment_id)
- On-chain tx_id

### 5. likes
- Post ve comment beğenileri
- Unique constraint (user + target)
- On-chain tx_id

### 6. follows
- Takip ilişkileri
- Follower/Following
- On-chain tx_id

### 7. shares
- Post paylaşımları
- Opsiyonel yorum
- On-chain tx_id

### 8. media_files
- Media metadata
- SHA256 hash
- File type, size, dimensions

### 9. blockchain_backups
- Otomatik blockchain yedekleri
- Block height, hash
- JSONB backup data

### 10. notifications
- Kullanıcı bildirimleri
- Type: like, comment, follow, etc.
- Read/unread tracking

### 11. user_stats
- Denormalized istatistikler
- Posts, followers, following counts
- Total rewards

---

## 🔒 Güvenlik Özellikleri

### Row Level Security (RLS)

**Tüm tablolarda aktif!**

#### Users
- ✅ Herkes aktif kullanıcıları görebilir
- ✅ Kullanıcılar kendi profillerini güncelleyebilir
- ❌ Başkalarının profillerini değiştiremez

#### Posts
- ✅ Herkes silinmemiş postları görebilir
- ✅ Authenticated kullanıcılar post oluşturabilir
- ✅ Kullanıcılar kendi postlarını düzenleyebilir/silebilir
- ❌ Başkalarının postlarını değiştiremez

#### Likes/Follows
- ✅ Herkes görebilir
- ✅ Authenticated kullanıcılar oluşturabilir
- ✅ Kullanıcılar kendi like/follow'larını silebilir

#### Blockchain Backups
- ❌ Sadece service role erişebilir
- ❌ Frontend'den erişilemez

### Service Role vs Anon Key

**Anon Key (Frontend):**
- Public işlemler
- RLS policies uygulanır
- Güvenli

**Service Role Key (Backend):**
- Admin işlemler
- RLS bypass
- GİZLİ TUTULMALI!

---

## 🔄 Otomatik İşlemler

### Triggers

#### Counter Updates
- Like eklenince → post.likes_count++
- Comment eklenince → post.comments_count++
- Follow eklenince → user_stats.followers_count++

#### Notifications
- Yeni like → Bildirim oluştur
- Yeni comment → Bildirim oluştur
- Yeni follow → Bildirim oluştur

#### Timestamps
- updated_at otomatik güncellenir
- last_seen_at otomatik güncellenir

---

## 📝 Kullanım Örnekleri

### TypeScript ile Bağlantı

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// User oluştur
const { data, error } = await supabase
  .from('users')
  .insert({
    nickname: 'alice',
    email: 'alice@example.com',
    public_key: '0x...'
  });

// Posts getir
const { data: posts } = await supabase
  .from('posts')
  .select('*, users(nickname, avatar_url)')
  .order('created_at', { ascending: false })
  .limit(20);

// Like ekle
const { data: like } = await supabase
  .from('likes')
  .insert({
    post_id: 'uuid',
    user_id: 'uuid',
    tx_id: '0x...'
  });

// Real-time subscription
const channel = supabase
  .channel('posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('New post:', payload.new);
  })
  .subscribe();
```

### Blockchain Backup

```typescript
import { SupabaseService } from './database/SupabaseService';
import { BlockchainBackupManager } from './database/BlockchainBackupManager';

// Initialize
const supabase = new SupabaseService({
  url: process.env.SUPABASE_URL!,
  anonKey: process.env.SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
});

const backupManager = new BlockchainBackupManager(
  blockchain,
  supabase,
  {
    enabled: true,
    interval: 100,
    keepLast: 1000,
    autoCleanup: true
  }
);

// Start automatic backups
backupManager.start();

// Manual backup
await backupManager.triggerBackup();

// Restore
await backupManager.restoreFromBackup(); // Latest
await backupManager.restoreFromBackup(12345); // Specific block
```

---

## 🧪 Test Etme

### SQL Editor'de Test

```sql
-- User ekle
INSERT INTO users (nickname, email, public_key)
VALUES ('testuser', 'test@example.com', '0xtest123');

-- Post ekle
INSERT INTO posts (user_id, content, tx_id)
VALUES (
  (SELECT id FROM users WHERE nickname = 'testuser'),
  'Hello TraceNet!',
  '0xtx123'
);

-- Stats kontrol et
SELECT * FROM user_stats;

-- Notifications kontrol et
SELECT * FROM notifications;
```

### TypeScript'te Test

```typescript
// Test connection
const { data, error } = await supabase
  .from('users')
  .select('count');

if (error) {
  console.error('Connection failed:', error);
} else {
  console.log('✅ Connected to Supabase');
}
```

---

## 📈 Performans

### Indexes

**30+ index oluşturuldu:**
- Primary keys
- Foreign keys
- Frequently queried columns
- Full-text search (gin_trgm_ops)

### Query Optimization

```sql
-- Fuzzy search (nickname)
SELECT * FROM users 
WHERE nickname ILIKE '%alice%';

-- Full-text search (post content)
SELECT * FROM posts 
WHERE content ILIKE '%blockchain%';

-- User feed (optimized)
SELECT p.*, u.nickname, u.avatar_url
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.user_id IN (
  SELECT following_id FROM follows WHERE follower_id = 'user-uuid'
)
ORDER BY p.created_at DESC
LIMIT 20;
```

---

## 💰 Maliyet

### Free Tier
- ✅ 500 MB database
- ✅ 1 GB file storage
- ✅ 50,000 monthly active users
- ✅ 2 GB bandwidth
- ✅ Unlimited API requests

### Pro Plan ($25/ay)
- ✅ 8 GB database
- ✅ 100 GB file storage
- ✅ 100,000 monthly active users
- ✅ 50 GB bandwidth
- ✅ Daily backups

**Tavsiye:** Free tier ile başla, gerekirse upgrade et.

---

## ✅ Checklist

- [ ] Supabase hesabı oluşturuldu
- [ ] Proje oluşturuldu
- [ ] part1-tables.sql çalıştırıldı
- [ ] part2-triggers.sql çalıştırıldı
- [ ] part3-security.sql çalıştırıldı
- [ ] API keys kopyalandı
- [ ] .env dosyası güncellendi
- [ ] Bağlantı test edildi
- [ ] Backup sistemi yapılandırıldı

---

## 🆘 Sorun Giderme

### SQL Hataları

```
ERROR: relation "users" already exists
```
**Çözüm:** Tablo zaten var, `DROP TABLE IF EXISTS` ekle veya yoksay.

### RLS Hataları

```
ERROR: new row violates row-level security policy
```
**Çözüm:** Service role key kullan veya RLS policy'yi kontrol et.

### Connection Hataları

```
ERROR: Failed to connect to Supabase
```
**Çözüm:** 
- URL ve API key'i kontrol et
- Internet bağlantısını kontrol et
- Supabase status: https://status.supabase.com

---

## 📞 Yardım

**Supabase Docs:** https://supabase.com/docs
**Discord:** https://discord.supabase.com
**GitHub:** https://github.com/supabase/supabase

Hazır! 🚀
