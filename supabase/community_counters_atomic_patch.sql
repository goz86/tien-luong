-- DUHOC MATE - Atomic community counters
-- Run this in Supabase SQL editor if post likes/views/comments are not counted reliably.

CREATE OR REPLACE FUNCTION public.increment_community_post_counter(
  row_id UUID,
  column_name TEXT,
  delta_value INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF column_name NOT IN ('likes_count', 'dislikes_count', 'comments_count', 'views_count') THEN
    RAISE EXCEPTION 'Unsupported counter column: %', column_name;
  END IF;

  EXECUTE format(
    'UPDATE public.community_posts SET %I = GREATEST(COALESCE(%I, 0) + $1, 0) WHERE id = $2',
    column_name,
    column_name
  )
  USING delta_value, row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_community_comment_likes(
  row_id UUID,
  delta_value INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.community_comments
  SET likes_count = GREATEST(COALESCE(likes_count, 0) + delta_value, 0)
  WHERE id = row_id;
$$;

REVOKE ALL ON FUNCTION public.increment_community_post_counter(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_community_comment_likes(UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.increment_community_post_counter(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_community_comment_likes(UUID, INTEGER) TO authenticated;
