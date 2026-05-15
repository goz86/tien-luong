-- Duhoc Mate store-safety patch: reports, blocks, account deletion requests.
-- Safe to rerun in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'review', 'profile', 'chat')),
  target_id UUID,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
ON public.content_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_target_idx
ON public.content_reports(target_type, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create content reports." ON public.content_reports;
CREATE POLICY "Users can create content reports." ON public.content_reports
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = reporter_id OR reporter_id IS NULL);

DROP POLICY IF EXISTS "Users can view own content reports." ON public.content_reports;
CREATE POLICY "Users can view own content reports." ON public.content_reports
FOR SELECT TO authenticated
USING ((select auth.uid()) = reporter_id OR public.is_app_admin());

DROP POLICY IF EXISTS "Admins can update content reports." ON public.content_reports;
CREATE POLICY "Admins can update content reports." ON public.content_reports
FOR UPDATE TO authenticated
USING (public.is_app_admin())
WITH CHECK (public.is_app_admin());

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  blocked_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx
ON public.user_blocks(blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blocks." ON public.user_blocks;
CREATE POLICY "Users can view own blocks." ON public.user_blocks
FOR SELECT TO authenticated
USING ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Users can create own blocks." ON public.user_blocks;
CREATE POLICY "Users can create own blocks." ON public.user_blocks
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS "Users can delete own blocks." ON public.user_blocks;
CREATE POLICY "Users can delete own blocks." ON public.user_blocks
FOR DELETE TO authenticated
USING ((select auth.uid()) = blocker_id);

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  email TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_requests_status_created_idx
ON public.account_deletion_requests(status, created_at DESC);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can request own account deletion." ON public.account_deletion_requests;
CREATE POLICY "Users can request own account deletion." ON public.account_deletion_requests
FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own account deletion requests." ON public.account_deletion_requests;
CREATE POLICY "Users can view own account deletion requests." ON public.account_deletion_requests
FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id OR public.is_app_admin());

DROP POLICY IF EXISTS "Admins can update account deletion requests." ON public.account_deletion_requests;
CREATE POLICY "Admins can update account deletion requests." ON public.account_deletion_requests
FOR UPDATE TO authenticated
USING (public.is_app_admin())
WITH CHECK (public.is_app_admin());

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
