-- DUHOC MATE - Community review, images, votes and friend accept patch.
-- Run this whole file in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('michintashop@gmail.com');
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- Friend requests: robust accept RPC for the incoming-request button.
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own friend requests." ON public.friend_requests;
CREATE POLICY "Users can view own friend requests." ON public.friend_requests
FOR SELECT USING ((select auth.uid()) IN (requester_id, target_profile_id));

DROP POLICY IF EXISTS "Users can create outgoing friend requests." ON public.friend_requests;
CREATE POLICY "Users can create outgoing friend requests." ON public.friend_requests
FOR INSERT WITH CHECK ((select auth.uid()) = requester_id AND requester_id <> target_profile_id);

DROP POLICY IF EXISTS "Participants can update friend requests." ON public.friend_requests;
CREATE POLICY "Participants can update friend requests." ON public.friend_requests
FOR UPDATE USING ((select auth.uid()) IN (requester_id, target_profile_id))
WITH CHECK ((select auth.uid()) IN (requester_id, target_profile_id));

DROP POLICY IF EXISTS "Participants can delete friend requests." ON public.friend_requests;
CREATE POLICY "Participants can delete friend requests." ON public.friend_requests
FOR DELETE USING ((select auth.uid()) IN (requester_id, target_profile_id));

DROP TRIGGER IF EXISTS set_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER set_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.accept_friend_request(other_user_id UUID)
RETURNS TABLE(id UUID, requester_id UUID, target_profile_id UUID, status TEXT, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (select auth.uid());
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE public.friend_requests fr
    SET status = 'accepted', updated_at = now()
    WHERE fr.requester_id = other_user_id
      AND fr.target_profile_id = current_user_id
      AND fr.status = 'pending'
    RETURNING fr.id, fr.requester_id, fr.target_profile_id, fr.status, fr.created_at, fr.updated_at
  )
  SELECT * FROM updated
  UNION ALL
  SELECT fr.id, fr.requester_id, fr.target_profile_id, fr.status, fr.created_at, fr.updated_at
  FROM public.friend_requests fr
  WHERE fr.requester_id = other_user_id
    AND fr.target_profile_id = current_user_id
    AND fr.status = 'accepted'
    AND NOT EXISTS (SELECT 1 FROM updated)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;

-- Review rows, ownership, admin deletion and image storage.
ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0;
ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS downvotes_count INTEGER DEFAULT 0;
ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.place_reviews ALTER COLUMN upvotes_count SET DEFAULT 0;
ALTER TABLE public.place_reviews ALTER COLUMN downvotes_count SET DEFAULT 0;
ALTER TABLE public.place_reviews ALTER COLUMN images SET DEFAULT '{}';

UPDATE public.place_reviews
SET
  upvotes_count = COALESCE(upvotes_count, 0),
  downvotes_count = COALESCE(downvotes_count, 0)
WHERE upvotes_count IS NULL OR downvotes_count IS NULL;

ALTER TABLE public.place_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reviews." ON public.place_reviews;
CREATE POLICY "Anyone can view reviews." ON public.place_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reviews." ON public.place_reviews;
CREATE POLICY "Authenticated users can insert reviews." ON public.place_reviews
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own reviews." ON public.place_reviews;
CREATE POLICY "Users can update own reviews." ON public.place_reviews
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews." ON public.place_reviews;
CREATE POLICY "Users can delete own reviews." ON public.place_reviews
FOR DELETE USING ((select auth.uid()) = user_id OR public.is_app_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone can view review images." ON storage.objects;
CREATE POLICY "Anyone can view review images." ON storage.objects
FOR SELECT USING (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Users can upload own review images." ON storage.objects;
CREATE POLICY "Users can upload own review images." ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'review-images'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete own review images." ON storage.objects;
CREATE POLICY "Users can delete own review images." ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'review-images'
  AND ((storage.foldername(name))[1] = (select auth.uid())::text OR public.is_app_admin())
);

-- Review votes: one active up/down vote per account.
CREATE TABLE IF NOT EXISTS public.place_review_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES public.place_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS place_review_votes_user_idx
ON public.place_review_votes(user_id);

ALTER TABLE public.place_review_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own review votes." ON public.place_review_votes;
CREATE POLICY "Users can view own review votes." ON public.place_review_votes
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert own review votes." ON public.place_review_votes;
CREATE POLICY "Authenticated users can insert own review votes." ON public.place_review_votes
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own review votes." ON public.place_review_votes;
CREATE POLICY "Users can update own review votes." ON public.place_review_votes
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own review votes." ON public.place_review_votes;
CREATE POLICY "Users can delete own review votes." ON public.place_review_votes
FOR DELETE USING ((select auth.uid()) = user_id);

DROP TRIGGER IF EXISTS set_place_review_votes_updated_at ON public.place_review_votes;
CREATE TRIGGER set_place_review_votes_updated_at
BEFORE UPDATE ON public.place_review_votes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

UPDATE public.place_reviews pr
SET
  upvotes_count = counts.up_total,
  downvotes_count = counts.down_total
FROM (
  SELECT
    pr_inner.id,
    COUNT(v.id) FILTER (WHERE v.vote_type = 'up')::INTEGER AS up_total,
    COUNT(v.id) FILTER (WHERE v.vote_type = 'down')::INTEGER AS down_total
  FROM public.place_reviews pr_inner
  LEFT JOIN public.place_review_votes v ON v.review_id = pr_inner.id
  GROUP BY pr_inner.id
) AS counts
WHERE pr.id = counts.id;

DROP FUNCTION IF EXISTS public.increment_review_upvote(UUID);
DROP FUNCTION IF EXISTS public.increment_review_downvote(UUID);
DROP FUNCTION IF EXISTS public.set_review_vote(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.set_review_vote(row_id UUID, next_vote TEXT)
RETURNS TABLE(upvotes_count INTEGER, downvotes_count INTEGER, vote_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (select auth.uid());
  previous_vote TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF next_vote NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'Invalid vote type';
  END IF;

  PERFORM 1 FROM public.place_reviews WHERE id = row_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;

  SELECT prv.vote_type
  INTO previous_vote
  FROM public.place_review_votes prv
  WHERE prv.review_id = row_id AND prv.user_id = current_user_id
  FOR UPDATE;

  IF previous_vote IS NULL THEN
    INSERT INTO public.place_review_votes (review_id, user_id, vote_type)
    VALUES (row_id, current_user_id, next_vote);
  ELSIF previous_vote <> next_vote THEN
    UPDATE public.place_review_votes
    SET vote_type = next_vote, updated_at = now()
    WHERE review_id = row_id AND user_id = current_user_id;
  END IF;

  WITH counts AS (
    SELECT
      COUNT(*) FILTER (WHERE prv.vote_type = 'up')::INTEGER AS up_total,
      COUNT(*) FILTER (WHERE prv.vote_type = 'down')::INTEGER AS down_total
    FROM public.place_review_votes prv
    WHERE prv.review_id = row_id
  )
  UPDATE public.place_reviews pr
  SET
    upvotes_count = counts.up_total,
    downvotes_count = counts.down_total
  FROM counts
  WHERE pr.id = row_id;

  RETURN QUERY
  SELECT COALESCE(pr.upvotes_count, 0), COALESCE(pr.downvotes_count, 0), next_vote
  FROM public.place_reviews pr
  WHERE pr.id = row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_review_upvote(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM * FROM public.set_review_vote(row_id, 'up');
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_review_downvote(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM * FROM public.set_review_vote(row_id, 'down');
END;
$$;

REVOKE ALL ON FUNCTION public.set_review_vote(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_review_upvote(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_review_downvote(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_review_vote(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_review_upvote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_review_downvote(UUID) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_reviews;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_review_votes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;
