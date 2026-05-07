-- =============================================
-- DUHOC MATE - Admin comment delete hotfix
-- Run this if the admin dashboard can open but comment delete still fails.
-- Safe to run more than once.
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

DROP POLICY IF EXISTS "Users can delete own comments." ON public.community_comments;
CREATE POLICY "Users can delete own comments." ON public.community_comments
FOR DELETE TO authenticated USING ((select auth.uid()) = user_id OR public.is_app_admin());

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

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view action logs." ON public.admin_action_logs;
CREATE POLICY "Admins can view action logs." ON public.admin_action_logs
FOR SELECT TO authenticated USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admins can insert action logs." ON public.admin_action_logs;
CREATE POLICY "Admins can insert action logs." ON public.admin_action_logs
FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());

CREATE TABLE IF NOT EXISTS public.admin_dashboard_seen_state (
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  comments_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01T00:00:00Z',
  notifications_seen_at TIMESTAMP WITH TIME ZONE DEFAULT '1970-01-01T00:00:00Z',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

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
  result public.admin_dashboard_seen_state;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Admin permission required';
  END IF;

  IF seen_kind NOT IN ('comments', 'notifications') THEN
    RAISE EXCEPTION 'Invalid seen kind';
  END IF;

  INSERT INTO public.admin_dashboard_seen_state (
    admin_id,
    comments_seen_at,
    notifications_seen_at,
    updated_at
  )
  VALUES (
    (select auth.uid()),
    CASE WHEN seen_kind = 'comments' THEN seen_at ELSE '1970-01-01T00:00:00Z'::timestamptz END,
    CASE WHEN seen_kind = 'notifications' THEN seen_at ELSE '1970-01-01T00:00:00Z'::timestamptz END,
    now()
  )
  ON CONFLICT (admin_id) DO UPDATE
  SET comments_seen_at = CASE
        WHEN seen_kind = 'comments'
          THEN GREATEST(public.admin_dashboard_seen_state.comments_seen_at, EXCLUDED.comments_seen_at)
        ELSE public.admin_dashboard_seen_state.comments_seen_at
      END,
      notifications_seen_at = CASE
        WHEN seen_kind = 'notifications'
          THEN GREATEST(public.admin_dashboard_seen_state.notifications_seen_at, EXCLUDED.notifications_seen_at)
        ELSE public.admin_dashboard_seen_state.notifications_seen_at
      END,
      updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_dashboard_seen(TEXT, TIMESTAMP WITH TIME ZONE) TO authenticated;

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

  BEGIN
    PERFORM public.admin_log_action(
      'delete_comment',
      'community_comments',
      row_id,
      safe_log_user_id,
      reason_text,
      jsonb_build_object('post_id', target_post_id, 'deleted_count', deleted_count)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_community_comment_hard(row_id UUID, reason_text TEXT DEFAULT NULL)
RETURNS INTEGER
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

  UPDATE public.community_posts
  SET comments_count = GREATEST(COALESCE(comments_count, 0) - deleted_count, 0),
      updated_at = now()
  WHERE id = target_post_id;

  SELECT p.id
  INTO safe_log_user_id
  FROM public.profiles p
  WHERE p.id = deleted_user_id
  LIMIT 1;

  BEGIN
    PERFORM public.admin_log_action(
      'delete_comment',
      'community_comments',
      row_id,
      safe_log_user_id,
      reason_text,
      jsonb_build_object('post_id', target_post_id, 'deleted_count', deleted_count)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_community_comment_hard(UUID, TEXT) TO authenticated;
