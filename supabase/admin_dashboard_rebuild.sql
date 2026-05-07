-- =============================================
-- DUHOC MATE - Admin dashboard rebuild
-- Safe to rerun. No ALTER PUBLICATION statements are used here.
-- Admin seed: michintashop@gmail.com
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Admin roles
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_roles_email_idx ON public.admin_roles (lower(email));

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
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'michintashop@gmail.com'
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
DROP POLICY IF EXISTS "Admins can manage admin roles." ON public.admin_roles;
CREATE POLICY "Admins can manage admin roles." ON public.admin_roles
FOR ALL TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

-- 2. User moderation
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

CREATE OR REPLACE FUNCTION public.can_current_user_write_community()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_moderation_status() NOT IN ('muted', 'suspended', 'banned');
$$;

GRANT EXECUTE ON FUNCTION public.current_user_moderation_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_current_user_write_community() TO authenticated;

-- 3. Admin audit logs
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
DROP POLICY IF EXISTS "Admins can view logs." ON public.admin_action_logs;
CREATE POLICY "Admins can view logs." ON public.admin_action_logs
FOR SELECT TO authenticated USING (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert logs." ON public.admin_action_logs;
CREATE POLICY "Admins can insert logs." ON public.admin_action_logs
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());

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

  IF target_user_id_input IS NOT NULL THEN
    SELECT id INTO safe_target_user_id
    FROM public.profiles
    WHERE id = target_user_id_input;
  END IF;

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

-- 4. Dashboard seen state. This keeps counters as "new since viewed" instead of lifetime totals.
CREATE TABLE IF NOT EXISTS public.admin_dashboard_seen_state (
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  comments_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00+00',
  notifications_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00+00',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_dashboard_seen_updated_idx ON public.admin_dashboard_seen_state(updated_at DESC);

ALTER TABLE public.admin_dashboard_seen_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view own dashboard seen state." ON public.admin_dashboard_seen_state;
CREATE POLICY "Admins can view own dashboard seen state." ON public.admin_dashboard_seen_state
FOR SELECT TO authenticated USING ((select auth.uid()) = admin_id AND public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert own dashboard seen state." ON public.admin_dashboard_seen_state;
CREATE POLICY "Admins can insert own dashboard seen state." ON public.admin_dashboard_seen_state
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = admin_id AND public.is_app_admin());
DROP POLICY IF EXISTS "Admins can update own dashboard seen state." ON public.admin_dashboard_seen_state;
CREATE POLICY "Admins can update own dashboard seen state." ON public.admin_dashboard_seen_state
FOR UPDATE TO authenticated USING ((select auth.uid()) = admin_id AND public.is_app_admin())
WITH CHECK ((select auth.uid()) = admin_id AND public.is_app_admin());

CREATE OR REPLACE FUNCTION public.admin_mark_dashboard_seen(
  seen_kind TEXT,
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS public.admin_dashboard_seen_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.admin_dashboard_seen_state;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  IF seen_kind NOT IN ('comments', 'notifications') THEN
    RAISE EXCEPTION 'Unknown dashboard seen kind: %', seen_kind;
  END IF;

  INSERT INTO public.admin_dashboard_seen_state (
    admin_id,
    comments_seen_at,
    notifications_seen_at,
    updated_at
  )
  VALUES (
    (select auth.uid()),
    CASE WHEN seen_kind = 'comments' THEN seen_at ELSE '1970-01-01 00:00:00+00'::timestamptz END,
    CASE WHEN seen_kind = 'notifications' THEN seen_at ELSE '1970-01-01 00:00:00+00'::timestamptz END,
    now()
  )
  ON CONFLICT (admin_id) DO UPDATE
  SET comments_seen_at = CASE
        WHEN seen_kind = 'comments' THEN EXCLUDED.comments_seen_at
        ELSE public.admin_dashboard_seen_state.comments_seen_at
      END,
      notifications_seen_at = CASE
        WHEN seen_kind = 'notifications' THEN EXCLUDED.notifications_seen_at
        ELSE public.admin_dashboard_seen_state.notifications_seen_at
      END,
      updated_at = now()
  RETURNING * INTO row_data;

  RETURN row_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_dashboard_seen(TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 5. Announcements
CREATE TABLE IF NOT EXISTS public.admin_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'danger')),
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_announcements_created_idx ON public.admin_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_announcements_published_idx ON public.admin_announcements(is_published, created_at DESC);

ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Published announcements are visible." ON public.admin_announcements;
CREATE POLICY "Published announcements are visible." ON public.admin_announcements
FOR SELECT TO authenticated USING (is_published OR public.is_app_admin());
DROP POLICY IF EXISTS "Admins can insert announcements." ON public.admin_announcements;
CREATE POLICY "Admins can insert announcements." ON public.admin_announcements
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can update announcements." ON public.admin_announcements;
CREATE POLICY "Admins can update announcements." ON public.admin_announcements
FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admins can delete announcements." ON public.admin_announcements;
CREATE POLICY "Admins can delete announcements." ON public.admin_announcements
FOR DELETE TO authenticated USING (public.is_app_admin());

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
  row_data public.admin_announcements;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  INSERT INTO public.admin_announcements (admin_id, title, body, severity, is_published)
  VALUES (
    (select auth.uid()),
    announcement_title,
    announcement_body,
    COALESCE(NULLIF(announcement_severity, ''), 'info'),
    true
  )
  RETURNING * INTO row_data;

  BEGIN
    PERFORM public.admin_log_action('publish_announcement', 'admin_announcements', row_data.id, NULL, announcement_title, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN row_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(TEXT, TEXT, TEXT) TO authenticated;

-- 6. One-call dashboard counters
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats(
  comments_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00+00',
  notifications_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01 00:00:00+00'
)
RETURNS TABLE (
  users_count BIGINT,
  posts_count BIGINT,
  comments_new_count BIGINT,
  reviews_count BIGINT,
  notifications_new_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles)::bigint AS users_count,
    (SELECT count(*) FROM public.community_posts)::bigint AS posts_count,
    (SELECT count(*) FROM public.community_comments WHERE created_at > comments_seen_at)::bigint AS comments_new_count,
    (SELECT count(*) FROM public.place_reviews)::bigint AS reviews_count,
    (SELECT count(*) FROM public.community_notifications WHERE created_at > notifications_seen_at)::bigint AS notifications_new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 7. Admin content moderation helpers
DROP POLICY IF EXISTS "Admins can delete community posts." ON public.community_posts;
CREATE POLICY "Admins can delete community posts." ON public.community_posts
FOR DELETE TO authenticated USING (public.is_app_admin() OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can delete community comments." ON public.community_comments;
CREATE POLICY "Admins can delete community comments." ON public.community_comments
FOR DELETE TO authenticated USING (public.is_app_admin() OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can delete place reviews." ON public.place_reviews;
CREATE POLICY "Admins can delete place reviews." ON public.place_reviews
FOR DELETE TO authenticated USING (public.is_app_admin() OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all notifications." ON public.community_notifications;
CREATE POLICY "Admins can view all notifications." ON public.community_notifications
FOR SELECT TO authenticated USING (public.is_app_admin() OR (select auth.uid()) = recipient_id);

CREATE OR REPLACE FUNCTION public.admin_delete_community_post(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
  deleted_count INTEGER;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT user_id INTO target_user
  FROM public.community_posts
  WHERE id = row_id;

  DELETE FROM public.community_posts
  WHERE id = row_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    BEGIN
      PERFORM public.admin_log_action('delete_post', 'community_posts', row_id, target_user, reason_text, '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN deleted_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_community_comment(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
  deleted_count INTEGER;
  child_deleted_count INTEGER;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT user_id INTO target_user
  FROM public.community_comments
  WHERE id = row_id;

  DELETE FROM public.community_comments
  WHERE parent_id = row_id;
  GET DIAGNOSTICS child_deleted_count = ROW_COUNT;

  DELETE FROM public.community_comments
  WHERE id = row_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 OR child_deleted_count > 0 THEN
    BEGIN
      PERFORM public.admin_log_action('delete_comment', 'community_comments', row_id, target_user, reason_text, '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN deleted_count > 0 OR child_deleted_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_community_comment_hard(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
  deleted_count INTEGER := 0;
  child_deleted_count INTEGER := 0;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT user_id INTO target_user
  FROM public.community_comments
  WHERE id = row_id;

  DELETE FROM public.community_comments
  WHERE parent_id = row_id;
  GET DIAGNOSTICS child_deleted_count = ROW_COUNT;

  DELETE FROM public.community_comments
  WHERE id = row_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 OR child_deleted_count > 0 THEN
    BEGIN
      PERFORM public.admin_log_action(
        'delete_comment',
        'community_comments',
        row_id,
        target_user,
        reason_text,
        jsonb_build_object('child_deleted_count', child_deleted_count)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN deleted_count + child_deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_place_review(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user UUID;
  deleted_count INTEGER;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  SELECT user_id INTO target_user
  FROM public.place_reviews
  WHERE id = row_id;

  DELETE FROM public.place_reviews
  WHERE id = row_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    BEGIN
      PERFORM public.admin_log_action('delete_review', 'place_reviews', row_id, target_user, reason_text, '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN deleted_count > 0;
END;
$$;

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
  row_data public.user_moderation;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  IF next_status NOT IN ('active', 'muted', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid moderation status: %', next_status;
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
  RETURNING * INTO row_data;

  BEGIN
    PERFORM public.admin_log_action('set_user_status', 'user_moderation', target_user_id_input, target_user_id_input, reason_text, jsonb_build_object('status', next_status));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN row_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_community_post(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment_hard(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_place_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- 8. Helpful indexes for dashboard lists
CREATE INDEX IF NOT EXISTS community_posts_created_idx ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS community_comments_created_idx ON public.community_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS community_comments_parent_idx ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS place_reviews_created_idx ON public.place_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS community_notifications_created_idx ON public.community_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS community_notifications_recipient_created_idx ON public.community_notifications(recipient_id, created_at DESC);
