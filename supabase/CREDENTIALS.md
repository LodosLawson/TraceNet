# TraceNet Environment Configuration

## Supabase Credentials

**Project ID:** ojvozdzludrslnqcxydf
**Project URL:** https://ojvozdzludrslnqcxydf.supabase.co

### Anon Key (Public - Frontend)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo
```

### Service Role Key (Private - Backend Only)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0MTY5MiwiZXhwIjoyMDU4OTE3NjkyfQ.eZ7-u1584sA3UbxYs_ge1ZqmoS-Jq6AE5aa8FEisySg
```

## .env Dosyasına Eklenecek Satırlar

Projenizin `.env` dosyasına şu satırları ekleyin:

```env
# Supabase Configuration
SUPABASE_URL=https://ojvozdzludrslnqcxydf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0MTY5MiwiZXhwIjoyMDU4OTE3NjkyfQ.eZ7-u1584sA3UbxYs_ge1ZqmoS-Jq6AE5aa8FEisySg

# Blockchain Backup Configuration
BACKUP_ENABLED=true
BACKUP_INTERVAL=100
BACKUP_KEEP_LAST=1000
BACKUP_AUTO_CLEANUP=true
```

## Manuel Ekleme Adımları

1. `.env` dosyasını açın (yoksa `.env.example`'dan kopyalayın)
2. Yukarıdaki satırları dosyanın sonuna ekleyin
3. Dosyayı kaydedin

## Komut ile Ekleme (CMD)

```cmd
cd c:\Users\mehem\.gemini\antigravity\scratch\Tracenet

REM .env dosyası yoksa oluştur
if not exist .env copy .env.example .env

REM Supabase config ekle
echo. >> .env
echo # Supabase Configuration >> .env
echo SUPABASE_URL=https://ojvozdzludrslnqcxydf.supabase.co >> .env
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo >> .env
echo SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0MTY5MiwiZXhwIjoyMDU4OTE3NjkyfQ.eZ7-u1584sA3UbxYs_ge1ZqmoS-Jq6AE5aa8FEisySg >> .env
echo. >> .env
echo # Blockchain Backup Configuration >> .env
echo BACKUP_ENABLED=true >> .env
echo BACKUP_INTERVAL=100 >> .env
echo BACKUP_KEEP_LAST=1000 >> .env
echo BACKUP_AUTO_CLEANUP=true >> .env
```

## Test Bağlantısı

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ojvozdzludrslnqcxydf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo'
);

// Test connection
const { data, error } = await supabase
  .from('users')
  .select('count');

if (error) {
  console.error('❌ Connection failed:', error);
} else {
  console.log('✅ Connected to Supabase!');
}
```

## Google Cloud Secrets (Production)

Production deployment için secrets'ı Google Cloud Secret Manager'a ekleyin:

```cmd
REM Supabase URL
echo -n "https://ojvozdzludrslnqcxydf.supabase.co" | gcloud secrets create supabase-url --data-file=-

REM Anon Key
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNDE2OTIsImV4cCI6MjA1ODkxNzY5Mn0.URPE8D2B6iX0YwHLuO_HQYcN-AXuHT_H7yYhylYTKXo" | gcloud secrets create supabase-anon-key --data-file=-

REM Service Role Key
echo -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdm96ZHpsdWRyc2xucWN4eWRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzM0MTY5MiwiZXhwIjoyMDU4OTE3NjkyfQ.eZ7-u1584sA3UbxYs_ge1ZqmoS-Jq6AE5aa8FEisySg" | gcloud secrets create supabase-service-role-key --data-file=-
```

## Güvenlik Uyarıları

⚠️ **Service Role Key'i asla frontend'de kullanmayın!**
⚠️ **Service Role Key'i GitHub'a commit etmeyin!**
⚠️ **Production'da environment variables kullanın!**

✅ Frontend: Sadece ANON_KEY
✅ Backend: ANON_KEY + SERVICE_ROLE_KEY
✅ Git: .env dosyası .gitignore'da

## Sonraki Adımlar

1. ✅ `.env` dosyasına credentials ekle
2. ✅ Supabase SQL scriptlerini çalıştır
3. ✅ Bağlantıyı test et
4. ✅ Lokal development başlat
5. ✅ Google Cloud'a deploy et
