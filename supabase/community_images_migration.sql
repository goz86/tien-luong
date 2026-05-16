-- ================================================================
-- COMMUNITY POST IMAGES
-- Thêm cột image_urls vào community_posts (tối đa 2 ảnh)
-- Chạy trong Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. Thêm cột image_urls (idempotent)
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- ================================================================
-- STORAGE BUCKET: community-images
-- Tạo bucket trong Supabase Dashboard > Storage > New bucket
--   Name:       community-images
--   Public:     true  (bật toggle)
--   File size:  5 MB
--   MIME types: image/jpeg,image/png,image/webp,image/gif
-- Sau khi tạo bucket xong, chạy phần RLS bên dưới
-- ================================================================

-- 2. Xoá policy cũ nếu tồn tại (để tránh lỗi duplicate)
DROP POLICY IF EXISTS "Public read community images"       ON storage.objects;
DROP POLICY IF EXISTS "Auth upload community images"       ON storage.objects;
DROP POLICY IF EXISTS "Guest upload community images"      ON storage.objects;
DROP POLICY IF EXISTS "Auth delete own community images"   ON storage.objects;

-- 3. Tạo lại policies

-- Cho phép tất cả đọc ảnh (bucket public)
CREATE POLICY "Public read community images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community-images');

-- Cho phép người dùng đã đăng nhập upload
CREATE POLICY "Auth upload community images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-images'
    AND auth.uid() IS NOT NULL
  );

-- Cho phép guest upload (không có auth)
CREATE POLICY "Guest upload community images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'community-images'
    AND auth.uid() IS NULL
  );

-- Cho phép xoá ảnh (cả auth và guest đều có thể xoá)
CREATE POLICY "Auth delete own community images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'community-images');

-- 4. Xác nhận cột đã tồn tại
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'community_posts' AND column_name = 'image_urls';
