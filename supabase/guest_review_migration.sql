-- ================================================================
-- GUEST REVIEW MIGRATION
-- Chạy trong Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. Thêm cột guest vào place_reviews
ALTER TABLE public.place_reviews
  ADD COLUMN IF NOT EXISTS guest_session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_reviews_expires_at
  ON public.place_reviews (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_guest_session
  ON public.place_reviews (guest_session_id)
  WHERE guest_session_id IS NOT NULL;

-- 3. RLS: cho phép guest INSERT review (không cần auth)
DROP POLICY IF EXISTS "Authenticated users can insert reviews." ON public.place_reviews;
CREATE POLICY "Authenticated users can insert reviews."
  ON public.place_reviews FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id)
    OR
    (guest_session_id IS NOT NULL AND user_id IS NULL
      AND expires_at IS NOT NULL
      AND expires_at > now()
      AND expires_at <= now() + INTERVAL '6 hours 5 minutes')
  );

-- 4. RLS: guest xoá review của chính mình
DROP POLICY IF EXISTS "guests can delete own reviews" ON public.place_reviews;
CREATE POLICY "guests can delete own reviews"
  ON public.place_reviews FOR DELETE
  USING (
    auth.uid() = user_id
    OR (guest_session_id IS NOT NULL
        AND guest_session_id = current_setting('app.guest_session_id', TRUE))
  );

-- 5. Cập nhật cleanup function để xoá review hết hạn luôn
CREATE OR REPLACE FUNCTION cleanup_expired_guest_content()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM community_comments  WHERE expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM community_posts     WHERE expires_at IS NOT NULL AND expires_at < now();
  DELETE FROM public.place_reviews WHERE expires_at IS NOT NULL AND expires_at < now();
END;
$$;

-- ================================================================
-- 6. pg_cron (chạy sau khi bật extension pg_cron):
-- SELECT cron.schedule(
--   'cleanup-expired-guest-content',
--   '*/30 * * * *',
--   'SELECT cleanup_expired_guest_content()'
-- );
-- ================================================================
