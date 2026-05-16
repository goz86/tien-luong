-- ============================================================
-- app_visits: tracking lượt truy cập app (guest + registered)
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Bảng lưu lượt truy cập
CREATE TABLE IF NOT EXISTS public.app_visits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text        NOT NULL,   -- guest UUID hoặc user UUID (as text)
  is_guest     boolean     NOT NULL DEFAULT true,
  visited_date date        NOT NULL DEFAULT CURRENT_DATE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- Mỗi session chỉ 1 bản ghi / ngày
  UNIQUE(session_id, visited_date)
);

CREATE INDEX IF NOT EXISTS idx_app_visits_date     ON public.app_visits(visited_date DESC);
CREATE INDEX IF NOT EXISTS idx_app_visits_guest    ON public.app_visits(is_guest, visited_date DESC);
CREATE INDEX IF NOT EXISTS idx_app_visits_session  ON public.app_visits(session_id);

-- 2. RLS: insert cho tất cả (kể cả anon), admin đọc tất cả
ALTER TABLE public.app_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_visits" ON public.app_visits;
CREATE POLICY "anyone_insert_visits" ON public.app_visits
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anyone_update_visits" ON public.app_visits;
CREATE POLICY "anyone_update_visits" ON public.app_visits
  FOR UPDATE USING (session_id = session_id);  -- chỉ update bản ghi của chính mình

DROP POLICY IF EXISTS "admin_select_visits" ON public.app_visits;
CREATE POLICY "admin_select_visits" ON public.app_visits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid())
  );

-- 3. RPC: upsert 1 visit (gọi từ client mỗi lần mở app)
--    Trả về true nếu là lần đầu hôm nay, false nếu đã có rồi
CREATE OR REPLACE FUNCTION public.record_app_visit(
  p_session_id text,
  p_is_guest   boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted boolean;
BEGIN
  INSERT INTO public.app_visits (session_id, is_guest, visited_date, last_seen_at)
  VALUES (p_session_id, p_is_guest, CURRENT_DATE, now())
  ON CONFLICT (session_id, visited_date)
  DO UPDATE SET last_seen_at = now()
  RETURNING (xmax = 0) INTO inserted;  -- xmax=0 nghĩa là INSERT (không phải UPDATE)

  RETURN COALESCE(inserted, false);
END;
$$;

-- Cho phép cả anon và authenticated gọi
GRANT EXECUTE ON FUNCTION public.record_app_visit TO anon;
GRANT EXECUTE ON FUNCTION public.record_app_visit TO authenticated;

-- 4. RPC: admin lấy thống kê lượt ghé thăm
CREATE OR REPLACE FUNCTION public.admin_get_visit_stats()
RETURNS TABLE (
  total_sessions_ever   bigint,
  total_guests_ever     bigint,
  total_users_ever      bigint,
  sessions_today        bigint,
  guests_today          bigint,
  sessions_week         bigint,
  guests_week           bigint,
  sessions_month        bigint,
  guests_month          bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT session_id)                                                       AS total_sessions_ever,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = true)                        AS total_guests_ever,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = false)                       AS total_users_ever,
    COUNT(DISTINCT session_id) FILTER (WHERE visited_date = CURRENT_DATE)            AS sessions_today,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = true AND visited_date = CURRENT_DATE) AS guests_today,
    COUNT(DISTINCT session_id) FILTER (WHERE visited_date >= CURRENT_DATE - 6)       AS sessions_week,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = true AND visited_date >= CURRENT_DATE - 6) AS guests_week,
    COUNT(DISTINCT session_id) FILTER (WHERE visited_date >= CURRENT_DATE - 29)      AS sessions_month,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = true AND visited_date >= CURRENT_DATE - 29) AS guests_month
  FROM public.app_visits;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_visit_stats TO authenticated;

-- 5. RPC: admin lấy daily breakdown 30 ngày gần nhất (cho biểu đồ)
CREATE OR REPLACE FUNCTION public.admin_get_daily_visits(days_back int DEFAULT 30)
RETURNS TABLE (
  day           date,
  total_sessions bigint,
  guest_sessions bigint,
  user_sessions  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    visited_date                                                    AS day,
    COUNT(DISTINCT session_id)                                      AS total_sessions,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = true)       AS guest_sessions,
    COUNT(DISTINCT session_id) FILTER (WHERE is_guest = false)      AS user_sessions
  FROM public.app_visits
  WHERE visited_date >= CURRENT_DATE - days_back
  GROUP BY visited_date
  ORDER BY visited_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_daily_visits TO authenticated;
