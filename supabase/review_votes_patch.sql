-- Review votes: one active up/down vote per account, realtime friendly.

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
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_review_votes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
