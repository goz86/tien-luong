-- ============================================================
-- Guest Notifications Migration
-- Cho phép khách (guest) nhận thông báo khi bài / bình luận
-- của họ được like hoặc được trả lời.
-- ============================================================

-- 1. Thêm cột recipient_guest_session_id
ALTER TABLE community_notifications
  ADD COLUMN IF NOT EXISTS recipient_guest_session_id TEXT;

-- 2. Index để query nhanh
CREATE INDEX IF NOT EXISTS idx_community_notifications_guest_session
  ON community_notifications(recipient_guest_session_id)
  WHERE recipient_guest_session_id IS NOT NULL;

-- 3. RLS: guest (anon role) có thể đọc notification của session mình
--    (Nếu bảng chưa enable RLS thì bỏ dòng ENABLE bên dưới)
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;

-- Cho phép user đã đăng nhập đọc notification của họ
DROP POLICY IF EXISTS "Users can read own notifications" ON community_notifications;
CREATE POLICY "Users can read own notifications"
  ON community_notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Cho phép guest (anon) đọc notification của session mình
DROP POLICY IF EXISTS "Guests can read own notifications" ON community_notifications;
CREATE POLICY "Guests can read own notifications"
  ON community_notifications FOR SELECT
  USING (
    auth.uid() IS NULL
    AND recipient_guest_session_id IS NOT NULL
  );

-- Cho phép insert notification (cần thiết để tạo thông báo cho guest)
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON community_notifications;
CREATE POLICY "Authenticated users can insert notifications"
  ON community_notifications FOR INSERT
  WITH CHECK (true);

-- Cho phép user đánh dấu notification của mình là đã đọc
DROP POLICY IF EXISTS "Users can update own notifications" ON community_notifications;
CREATE POLICY "Users can update own notifications"
  ON community_notifications FOR UPDATE
  USING (
    recipient_id = auth.uid()
    OR (auth.uid() IS NULL AND recipient_guest_session_id IS NOT NULL)
  );
