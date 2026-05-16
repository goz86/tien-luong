-- ================================================================
-- GUEST MODE MIGRATION
-- Chạy file này trong Supabase Dashboard > SQL Editor
-- ================================================================

-- 1. Thêm cột guest_session_id và expires_at vào community_posts
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS guest_session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Thêm cột guest_session_id và expires_at vào community_comments
ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS guest_session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Index để cleanup nhanh hơn
CREATE INDEX IF NOT EXISTS idx_posts_expires_at
  ON community_posts (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_expires_at
  ON community_comments (expires_at)
  WHERE expires_at IS NOT NULL;

-- 4. Index để guest xóa bài của chính mình
CREATE INDEX IF NOT EXISTS idx_posts_guest_session
  ON community_posts (guest_session_id)
  WHERE guest_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_guest_session
  ON community_comments (guest_session_id)
  WHERE guest_session_id IS NOT NULL;

-- ================================================================
-- 5. RLS Policies cho Guest
-- ================================================================

-- Posts: cho phép guest INSERT (không cần auth)
DROP POLICY IF EXISTS "guests can insert posts" ON community_posts;
CREATE POLICY "guests can insert posts"
  ON community_posts FOR INSERT
  WITH CHECK (
    guest_session_id IS NOT NULL
    AND user_id IS NULL
    AND expires_at IS NOT NULL
    AND expires_at > now()
    AND expires_at <= now() + INTERVAL '3 hours 5 minutes'
  );

-- Posts: cho phép guest DELETE bài của chính mình qua session_id
DROP POLICY IF EXISTS "guests can delete own posts" ON community_posts;
CREATE POLICY "guests can delete own posts"
  ON community_posts FOR DELETE
  USING (
    guest_session_id IS NOT NULL
    AND guest_session_id = current_setting('app.guest_session_id', TRUE)
  );

-- Comments: cho phép guest INSERT
DROP POLICY IF EXISTS "guests can insert comments" ON community_comments;
CREATE POLICY "guests can insert comments"
  ON community_comments FOR INSERT
  WITH CHECK (
    guest_session_id IS NOT NULL
    AND user_id IS NULL
    AND expires_at IS NOT NULL
    AND expires_at > now()
    AND expires_at <= now() + INTERVAL '3 hours 5 minutes'
  );

-- Comments: cho phép guest DELETE comment của chính mình
DROP POLICY IF EXISTS "guests can delete own comments" ON community_comments;
CREATE POLICY "guests can delete own comments"
  ON community_comments FOR DELETE
  USING (
    guest_session_id IS NOT NULL
    AND guest_session_id = current_setting('app.guest_session_id', TRUE)
  );

-- ================================================================
-- 6. Auto-cleanup function (chạy định kỳ xóa nội dung hết hạn)
-- ================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_guest_content()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Xóa comments hết hạn trước (tránh FK issue)
  DELETE FROM community_comments
  WHERE expires_at IS NOT NULL AND expires_at < now();

  -- Xóa posts hết hạn
  DELETE FROM community_posts
  WHERE expires_at IS NOT NULL AND expires_at < now();
END;
$$;

-- ================================================================
-- 7. pg_cron: tự động chạy cleanup mỗi 30 phút
--    (Cần bật extension pg_cron trong Supabase: Database > Extensions)
-- ================================================================
-- Chạy lệnh này SAU KHI bật pg_cron:
/*
SELECT cron.schedule(
  'cleanup-expired-guest-content',
  '*/30 * * * *',
  'SELECT cleanup_expired_guest_content()'
);
*/

-- ================================================================
-- 8. Kiểm tra: gọi thủ công để test cleanup
-- ================================================================
-- SELECT cleanup_expired_guest_content();
