-- =============================================
-- DUHOC MATE - Admin dashboard patch
-- Re-runnable. Run after schema.sql/community_review_friend_patch.sql.
-- Admin seed: michintashop@gmail.com
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO public.admin_roles (user_id, email, role)
SELECT id, lower(email), 'super_admin'
FROM auth.users
WHERE lower(email) = 'michintashop@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) IN ('michintashop@gmail.com')
    OR EXISTS (
      SELECT 1
      FROM public.admin_roles ar
      WHERE ar.user_id = (select auth.uid())
        AND ar.role IN ('super_admin', 'admin', 'moderator')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view admin roles." ON public.admin_roles;
CREATE POLICY "Admins can view admin roles." ON public.admin_roles
FOR SELECT TO authenticated USING (public.is_app_admin());
DROP POLICY IF EXISTS "Super admins can manage admin roles." ON public.admin_roles;
CREATE POLICY "Super admins can manage admin roles." ON public.admin_roles
FOR ALL TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE TABLE IF NOT EXISTS public.user_moderation (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'suspended', 'banned')),
  reason TEXT,
  muted_until TIMESTAMP WITH TIME ZONE,
  banned_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_moderation_status_idx ON public.user_moderation(status);
CREATE INDEX IF NOT EXISTS user_moderation_updated_idx ON public.user_moderation(updated_at DESC);

ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own moderation status." ON public.user_moderation;
CREATE POLICY "Users can view own moderation status." ON public.user_moderation
FOR SELECT TO authenticated USING ((select auth.uid()) = user_id OR public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert moderation status." ON public.user_moderation;
CREATE POLICY "Admins can insert moderation status." ON public.user_moderation
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can update moderation status." ON public.user_moderation;
CREATE POLICY "Admins can update moderation status." ON public.user_moderation
FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can delete moderation status." ON public.user_moderation;
CREATE POLICY "Admins can delete moderation status." ON public.user_moderation
FOR DELETE TO authenticated USING (public.is_app_admin());

DROP TRIGGER IF EXISTS set_user_moderation_updated_at ON public.user_moderation;
CREATE TRIGGER set_user_moderation_updated_at
BEFORE UPDATE ON public.user_moderation
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_moderation_status()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN um.status = 'banned' AND (um.banned_until IS NULL OR um.banned_until > now()) THEN 'banned'
      WHEN um.status IN ('muted', 'suspended') AND (um.muted_until IS NULL OR um.muted_until > now()) THEN um.status
      ELSE 'active'
    END
    FROM public.user_moderation um
    WHERE um.user_id = (select auth.uid())
  ), 'active');
$$;

GRANT EXECUTE ON FUNCTION public.current_user_moderation_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_current_user_write_community()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_app_admin() OR public.current_user_moderation_status() = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.can_current_user_write_community() TO authenticated;

CREATE OR REPLACE FUNCTION public.are_profiles_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_a <> user_b
    AND ((select auth.uid()) = user_a OR (select auth.uid()) = user_b OR public.is_app_admin())
    AND EXISTS (
      SELECT 1
      FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.requester_id = user_a AND fr.target_profile_id = user_b)
          OR (fr.requester_id = user_b AND fr.target_profile_id = user_a)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.are_profiles_friends(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_profiles_friends(UUID, UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_action_logs_created_idx ON public.admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_action_logs_target_idx ON public.admin_action_logs(target_table, target_id);
CREATE INDEX IF NOT EXISTS admin_action_logs_user_idx ON public.admin_action_logs(target_user_id);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view action logs." ON public.admin_action_logs;
CREATE POLICY "Admins can view action logs." ON public.admin_action_logs
FOR SELECT TO authenticated USING (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert action logs." ON public.admin_action_logs;
CREATE POLICY "Admins can insert action logs." ON public.admin_action_logs
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());

CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'danger')),
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS admin_announcements_created_idx ON public.admin_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_announcements_published_idx ON public.admin_announcements(is_published, created_at DESC);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view published announcements." ON public.admin_announcements;
CREATE POLICY "Authenticated users can view published announcements." ON public.admin_announcements
FOR SELECT TO authenticated USING (is_published = true OR public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert announcements." ON public.admin_announcements;
CREATE POLICY "Admins can insert announcements." ON public.admin_announcements
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can update announcements." ON public.admin_announcements;
CREATE POLICY "Admins can update announcements." ON public.admin_announcements
FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can delete announcements." ON public.admin_announcements;
CREATE POLICY "Admins can delete announcements." ON public.admin_announcements
FOR DELETE TO authenticated USING (public.is_app_admin());

DROP POLICY IF EXISTS "Users can delete own posts." ON public.community_posts;
CREATE POLICY "Users can delete own posts." ON public.community_posts
FOR DELETE USING ((select auth.uid()) = user_id OR public.is_app_admin());

DROP POLICY IF EXISTS "Users can delete own comments." ON public.community_comments;
CREATE POLICY "Users can delete own comments." ON public.community_comments
FOR DELETE USING ((select auth.uid()) = user_id OR public.is_app_admin());

DROP POLICY IF EXISTS "Users can delete own reviews." ON public.place_reviews;
CREATE POLICY "Users can delete own reviews." ON public.place_reviews
FOR DELETE USING ((select auth.uid()) = user_id OR public.is_app_admin());

DROP POLICY IF EXISTS "Admins can view all notifications." ON public.community_notifications;
CREATE POLICY "Admins can view all notifications." ON public.community_notifications
FOR SELECT TO authenticated USING (public.is_app_admin());

DROP POLICY IF EXISTS "Users can create outgoing friend requests." ON public.friend_requests;
CREATE POLICY "Users can create outgoing friend requests." ON public.friend_requests
FOR INSERT WITH CHECK (
  (select auth.uid()) = requester_id
  AND requester_id <> target_profile_id
  AND public.can_current_user_write_community()
);

DROP POLICY IF EXISTS "Friends can send chat messages." ON public.chat_messages;
CREATE POLICY "Friends can send chat messages." ON public.chat_messages
FOR INSERT WITH CHECK (
  (select auth.uid()) = sender_id
  AND public.are_profiles_friends(sender_id, receiver_id)
  AND public.can_current_user_write_community()
);

DROP POLICY IF EXISTS "Authenticated users can insert posts." ON public.community_posts;
CREATE POLICY "Authenticated users can insert posts." ON public.community_posts
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can update own posts." ON public.community_posts;
CREATE POLICY "Users can update own posts." ON public.community_posts
FOR UPDATE USING ((select auth.uid()) = user_id AND public.can_current_user_write_community())
WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Authenticated users can insert comments." ON public.community_comments;
CREATE POLICY "Authenticated users can insert comments." ON public.community_comments
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can update own comments." ON public.community_comments;
CREATE POLICY "Users can update own comments." ON public.community_comments
FOR UPDATE USING ((select auth.uid()) = user_id AND public.can_current_user_write_community())
WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Authenticated users can insert likes." ON public.community_likes;
CREATE POLICY "Authenticated users can insert likes." ON public.community_likes
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can update own likes." ON public.community_likes;
CREATE POLICY "Users can update own likes." ON public.community_likes
FOR UPDATE USING ((select auth.uid()) = user_id AND public.can_current_user_write_community())
WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can insert bookmarks." ON public.community_bookmarks;
DROP POLICY IF EXISTS "Users can create own bookmarks." ON public.community_bookmarks;
CREATE POLICY "Users can create own bookmarks." ON public.community_bookmarks
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Authenticated users can insert reviews." ON public.place_reviews;
CREATE POLICY "Authenticated users can insert reviews." ON public.place_reviews
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can update own reviews." ON public.place_reviews;
CREATE POLICY "Users can update own reviews." ON public.place_reviews
FOR UPDATE USING ((select auth.uid()) = user_id AND public.can_current_user_write_community())
WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Authenticated users can insert own review votes." ON public.place_review_votes;
CREATE POLICY "Authenticated users can insert own review votes." ON public.place_review_votes
FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

DROP POLICY IF EXISTS "Users can update own review votes." ON public.place_review_votes;
CREATE POLICY "Users can update own review votes." ON public.place_review_votes
FOR UPDATE USING ((select auth.uid()) = user_id AND public.can_current_user_write_community())
WITH CHECK ((select auth.uid()) = user_id AND public.can_current_user_write_community());

CREATE OR REPLACE FUNCTION public.admin_log_action(
  action_type_input TEXT,
  target_table_input TEXT DEFAULT NULL,
  target_id_input UUID DEFAULT NULL,
  target_user_id_input UUID DEFAULT NULL,
  reason_text TEXT DEFAULT NULL,
  metadata_input JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_target_user_id UUID;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT p.id
  INTO safe_target_user_id
  FROM public.profiles p
  WHERE p.id = target_user_id_input
  LIMIT 1;

  INSERT INTO public.admin_action_logs (
    admin_id,
    action_type,
    target_table,
    target_id,
    target_user_id,
    reason,
    metadata
  )
  VALUES (
    (select auth.uid()),
    action_type_input,
    target_table_input,
    target_id_input,
    safe_target_user_id,
    reason_text,
    COALESCE(metadata_input, '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_log_action(TEXT, TEXT, UUID, UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_community_post(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_user_id UUID;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  DELETE FROM public.community_posts
  WHERE id = row_id
  RETURNING user_id INTO deleted_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  PERFORM public.admin_log_action('delete_post', 'community_posts', row_id, deleted_user_id, reason_text, '{}'::jsonb);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_community_post(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_community_comment(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_user_id UUID;
  target_post_id UUID;
  deleted_count INTEGER := 0;
  safe_log_user_id UUID;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT user_id, post_id
  INTO deleted_user_id, target_post_id
  FROM public.community_comments
  WHERE id = row_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  WITH RECURSIVE target_comments AS (
    SELECT id
    FROM public.community_comments
    WHERE id = row_id
    UNION ALL
    SELECT child.id
    FROM public.community_comments child
    JOIN target_comments parent ON child.parent_id = parent.id
  )
  DELETE FROM public.community_comments
  WHERE id IN (SELECT id FROM target_comments);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  SELECT p.id
  INTO safe_log_user_id
  FROM public.profiles p
  WHERE p.id = deleted_user_id
  LIMIT 1;

  UPDATE public.community_posts
  SET comments_count = GREATEST(COALESCE(comments_count, 0) - deleted_count, 0),
      updated_at = now()
  WHERE id = target_post_id;

  PERFORM public.admin_log_action(
    'delete_comment',
    'community_comments',
    row_id,
    safe_log_user_id,
    reason_text,
    jsonb_build_object('post_id', target_post_id, 'deleted_count', deleted_count)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_place_review(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_user_id UUID;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  DELETE FROM public.place_reviews
  WHERE id = row_id
  RETURNING user_id INTO deleted_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  PERFORM public.admin_log_action('delete_review', 'place_reviews', row_id, deleted_user_id, reason_text, '{}'::jsonb);
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_place_review(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  target_user_id_input UUID,
  next_status TEXT,
  reason_text TEXT DEFAULT NULL,
  until_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS public.user_moderation
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.user_moderation;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  IF next_status NOT IN ('active', 'muted', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid user status';
  END IF;

  INSERT INTO public.user_moderation (
    user_id,
    status,
    reason,
    muted_until,
    banned_until,
    created_by,
    updated_at
  )
  VALUES (
    target_user_id_input,
    next_status,
    reason_text,
    CASE WHEN next_status IN ('muted', 'suspended') THEN until_at ELSE NULL END,
    CASE WHEN next_status = 'banned' THEN until_at ELSE NULL END,
    (select auth.uid()),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET status = EXCLUDED.status,
      reason = EXCLUDED.reason,
      muted_until = EXCLUDED.muted_until,
      banned_until = EXCLUDED.banned_until,
      created_by = EXCLUDED.created_by,
      updated_at = now()
  RETURNING * INTO result;

  UPDATE public.profiles
  SET status = next_status,
      updated_at = now()
  WHERE id = target_user_id_input;

  PERFORM public.admin_log_action(
    'set_user_status',
    'profiles',
    target_user_id_input,
    target_user_id_input,
    reason_text,
    jsonb_build_object('status', next_status, 'until_at', until_at)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_publish_announcement(
  announcement_title TEXT,
  announcement_body TEXT,
  announcement_severity TEXT DEFAULT 'info'
)
RETURNS public.admin_announcements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.admin_announcements;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  IF announcement_severity NOT IN ('info', 'success', 'warning', 'danger') THEN
    RAISE EXCEPTION 'Invalid announcement severity';
  END IF;

  INSERT INTO public.admin_announcements (admin_id, title, body, severity, is_published)
  VALUES ((select auth.uid()), announcement_title, announcement_body, announcement_severity, true)
  RETURNING * INTO result;

  INSERT INTO public.community_notifications (recipient_id, actor_id, type, title, body)
  SELECT p.id, (select auth.uid()), 'system', announcement_title, announcement_body
  FROM public.profiles p;

  PERFORM public.admin_log_action(
    'publish_announcement',
    'admin_announcements',
    result.id,
    NULL,
    NULL,
    jsonb_build_object('severity', announcement_severity)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(TEXT, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_moderation;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_action_logs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_announcements;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
