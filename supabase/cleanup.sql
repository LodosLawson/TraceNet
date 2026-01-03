-- ============================================
-- Supabase Cleanup Script
-- Mevcut tabloları sil ve yeniden oluştur
-- ============================================

-- UYARI: Bu script TÜM VERİYİ SİLER!
-- Sadece ilk kurulumda veya sıfırdan başlarken kullan

-- Drop all tables (cascade ile ilişkili veriler de silinir)
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.shares CASCADE;
DROP TABLE IF EXISTS public.media_files CASCADE;
DROP TABLE IF EXISTS public.blockchain_backups CASCADE;
DROP TABLE IF EXISTS public.follows CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.update_last_seen() CASCADE;
DROP FUNCTION IF EXISTS public.update_post_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_comment_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_comments_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_shares_count() CASCADE;
DROP FUNCTION IF EXISTS public.initialize_user_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_posts_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_follow_counts() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_like() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_comment() CASCADE;
DROP FUNCTION IF EXISTS public.notify_on_follow() CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_post(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_comment(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_following(UUID) CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Cleanup Complete!';
    RAISE NOTICE 'Tüm tablolar ve fonksiyonlar silindi.';
    RAISE NOTICE 'Şimdi part1-tables.sql çalıştırabilirsin.';
END $$;
