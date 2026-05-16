-- ================================================================
-- FIX: Cho phép user_id = NULL trong community_comments và community_posts
-- (cần thiết để guest comment/post không có tài khoản)
-- Chạy trong Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. Bỏ ràng buộc NOT NULL trên user_id của community_comments
ALTER TABLE public.community_comments
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Bỏ ràng buộc NOT NULL trên user_id của community_posts
ALTER TABLE public.community_posts
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Xác nhận: kiểm tra cột sau khi sửa
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('community_comments', 'community_posts')
--   AND column_name = 'user_id';
