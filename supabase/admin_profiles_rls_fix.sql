-- ============================================================
-- Fix: Admin không đọc được danh sách profiles
-- + Thêm cột last_seen_at nếu chưa có
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm cột last_seen_at nếu chưa tồn tại
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx
  ON public.profiles(last_seen_at DESC);

-- 2. RLS: profiles đã có policy cho authenticated users rồi,
--    nhưng thêm policy admin để chắc chắn
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
    )
  );

-- 3. RPC admin_get_users (SECURITY DEFINER = bỏ qua RLS hoàn toàn)
CREATE OR REPLACE FUNCTION public.admin_get_users(limit_count int DEFAULT 24)
RETURNS TABLE (
  id            uuid,
  display_name  text,
  school        text,
  region        text,
  avatar_url    text,
  status        text,
  last_seen_at  timestamptz,
  created_at    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    display_name,
    school,
    region,
    avatar_url,
    status,
    last_seen_at,
    created_at
  FROM public.profiles
  ORDER BY COALESCE(last_seen_at, created_at) DESC NULLS LAST
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users TO authenticated;
