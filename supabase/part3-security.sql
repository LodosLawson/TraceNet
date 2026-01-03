-- ============================================
-- TraceNet Supabase Database Schema
-- Part 3: Row Level Security (RLS) Policies
-- ============================================

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Users Table Policies
-- ============================================

-- Everyone can view active users
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (is_active = TRUE);

-- Users can update their own profile
CREATE POLICY "users_update_own_policy" ON public.users
    FOR UPDATE
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- Service role can do everything
CREATE POLICY "users_service_role_policy" ON public.users
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Wallets Table Policies
-- ============================================

-- Users can view their own wallets
CREATE POLICY "wallets_select_own_policy" ON public.wallets
    FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can insert their own wallets
CREATE POLICY "wallets_insert_own_policy" ON public.wallets
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own wallets
CREATE POLICY "wallets_update_own_policy" ON public.wallets
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own wallets
CREATE POLICY "wallets_delete_own_policy" ON public.wallets
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Service role can do everything
CREATE POLICY "wallets_service_role_policy" ON public.wallets
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Posts Table Policies
-- ============================================

-- Everyone can view non-deleted posts
CREATE POLICY "posts_select_policy" ON public.posts
    FOR SELECT
    USING (is_deleted = FALSE);

-- Authenticated users can create posts
CREATE POLICY "posts_insert_policy" ON public.posts
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own posts
CREATE POLICY "posts_update_own_policy" ON public.posts
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own posts (soft delete)
CREATE POLICY "posts_delete_own_policy" ON public.posts
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text AND is_deleted = TRUE);

-- Service role can do everything
CREATE POLICY "posts_service_role_policy" ON public.posts
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Comments Table Policies
-- ============================================

-- Everyone can view non-deleted comments
CREATE POLICY "comments_select_policy" ON public.comments
    FOR SELECT
    USING (is_deleted = FALSE);

-- Authenticated users can create comments
CREATE POLICY "comments_insert_policy" ON public.comments
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can update their own comments
CREATE POLICY "comments_update_own_policy" ON public.comments
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own comments (soft delete)
CREATE POLICY "comments_delete_own_policy" ON public.comments
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text AND is_deleted = TRUE);

-- Service role can do everything
CREATE POLICY "comments_service_role_policy" ON public.comments
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Likes Table Policies
-- ============================================

-- Everyone can view likes
CREATE POLICY "likes_select_policy" ON public.likes
    FOR SELECT
    USING (TRUE);

-- Authenticated users can create likes
CREATE POLICY "likes_insert_policy" ON public.likes
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own likes
CREATE POLICY "likes_delete_own_policy" ON public.likes
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Service role can do everything
CREATE POLICY "likes_service_role_policy" ON public.likes
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Follows Table Policies
-- ============================================

-- Everyone can view follows
CREATE POLICY "follows_select_policy" ON public.follows
    FOR SELECT
    USING (TRUE);

-- Authenticated users can create follows
CREATE POLICY "follows_insert_policy" ON public.follows
    FOR INSERT
    WITH CHECK (auth.uid()::text = follower_id::text);

-- Users can delete their own follows
CREATE POLICY "follows_delete_own_policy" ON public.follows
    FOR DELETE
    USING (auth.uid()::text = follower_id::text);

-- Service role can do everything
CREATE POLICY "follows_service_role_policy" ON public.follows
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Shares Table Policies
-- ============================================

-- Everyone can view shares
CREATE POLICY "shares_select_policy" ON public.shares
    FOR SELECT
    USING (TRUE);

-- Authenticated users can create shares
CREATE POLICY "shares_insert_policy" ON public.shares
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own shares
CREATE POLICY "shares_delete_own_policy" ON public.shares
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Service role can do everything
CREATE POLICY "shares_service_role_policy" ON public.shares
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Media Files Table Policies
-- ============================================

-- Everyone can view media files
CREATE POLICY "media_files_select_policy" ON public.media_files
    FOR SELECT
    USING (TRUE);

-- Authenticated users can upload media
CREATE POLICY "media_files_insert_policy" ON public.media_files
    FOR INSERT
    WITH CHECK (auth.uid()::text = user_id::text);

-- Users can delete their own media
CREATE POLICY "media_files_delete_own_policy" ON public.media_files
    FOR DELETE
    USING (auth.uid()::text = user_id::text);

-- Service role can do everything
CREATE POLICY "media_files_service_role_policy" ON public.media_files
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Blockchain Backups Table Policies
-- ============================================

-- Only service role can access backups
CREATE POLICY "blockchain_backups_service_only_policy" ON public.blockchain_backups
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Notifications Table Policies
-- ============================================

-- Users can view their own notifications
CREATE POLICY "notifications_select_own_policy" ON public.notifications
    FOR SELECT
    USING (auth.uid()::text = user_id::text);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own_policy" ON public.notifications
    FOR UPDATE
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

-- Service role can create notifications
CREATE POLICY "notifications_insert_service_policy" ON public.notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Service role can do everything
CREATE POLICY "notifications_service_role_policy" ON public.notifications
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- User Stats Table Policies
-- ============================================

-- Everyone can view user stats
CREATE POLICY "user_stats_select_policy" ON public.user_stats
    FOR SELECT
    USING (TRUE);

-- Only service role and triggers can modify stats
CREATE POLICY "user_stats_service_only_policy" ON public.user_stats
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Helper Functions for Security
-- ============================================

-- Check if user owns a post
CREATE OR REPLACE FUNCTION public.user_owns_post(post_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.posts 
        WHERE id = post_uuid 
        AND user_id::text = auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user owns a comment
CREATE OR REPLACE FUNCTION public.user_owns_comment(comment_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.comments 
        WHERE id = comment_uuid 
        AND user_id::text = auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is following another user
CREATE OR REPLACE FUNCTION public.is_following(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.follows 
        WHERE follower_id::text = auth.uid()::text 
        AND following_id = target_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Part 3 Complete: Row Level Security Policies Created';
    RAISE NOTICE '✅ All Database Setup Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - 11 tables created';
    RAISE NOTICE '  - 30+ indexes for performance';
    RAISE NOTICE '  - 15+ triggers for automation';
    RAISE NOTICE '  - 40+ RLS policies for security';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Update .env with Supabase credentials';
    RAISE NOTICE '  2. Test connection from your app';
    RAISE NOTICE '  3. Start using the database!';
END $$;
