-- ============================================================
-- community_reports: bảng nhận báo cáo từ người dùng
-- Chạy file này 1 lần trong Supabase SQL Editor
-- ============================================================

-- 1. Tạo bảng
CREATE TABLE IF NOT EXISTS public.community_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type     text        NOT NULL CHECK (target_type IN ('post','comment','review','profile','chat')),
  target_id       text,
  target_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason          text        NOT NULL DEFAULT 'user_report',
  details         text,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','resolved','dismissed')),
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- Index để admin lọc nhanh theo status
CREATE INDEX IF NOT EXISTS idx_community_reports_status ON public.community_reports(status);
CREATE INDEX IF NOT EXISTS idx_community_reports_created ON public.community_reports(created_at DESC);

-- 2. RLS
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Admin đọc tất cả
DROP POLICY IF EXISTS "admin_select_reports" ON public.community_reports;
CREATE POLICY "admin_select_reports" ON public.community_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
  );

-- Người dùng đã đăng nhập được insert (báo cáo)
DROP POLICY IF EXISTS "auth_insert_reports" ON public.community_reports;
CREATE POLICY "auth_insert_reports" ON public.community_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Hàm admin xử lý báo cáo (resolve / dismiss)
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  report_id       uuid,
  next_status     text,
  admin_note_text text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.community_reports
  SET
    status       = next_status,
    admin_note   = admin_note_text,
    resolved_at  = CASE WHEN next_status = 'pending' THEN NULL ELSE now() END
  WHERE id = report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_report TO authenticated;

-- 4. Hàm dashboard: đếm pending reports (thêm vào admin_get_dashboard_stats nếu đã có)
-- Nếu bạn đã có hàm admin_get_dashboard_stats, hãy thêm cột reports_pending vào đó.
-- Hàm dưới đây chỉ là helper độc lập cho AdminScreen.tsx dùng khi RPC chính lỗi.
CREATE OR REPLACE FUNCTION public.admin_count_pending_reports()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.community_reports WHERE status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_pending_reports TO authenticated;
