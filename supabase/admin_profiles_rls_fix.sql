-- ============================================================
-- Fix: Admin không đọc được danh sách profiles
-- Nguyên nhân: RLS trên bảng profiles chỉ cho đọc profile của chính mình
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm policy cho phép admin đọc TẤT CẢ profiles
--    (Các policy SELECT được OR lại với nhau, không cần xoá policy cũ)
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
CREATE POLICY "admin_select_all_profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()
    )
  );

-- 2. RPC fallback: admin_get_users (SECURITY DEFINER = bỏ qua RLS hoàn toàn)
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
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_users TO authenticated;
