-- ============================================================
-- delete_own_account()
-- Cho phép user tự xoá tài khoản của mình ngay lập tức.
-- SECURITY DEFINER = chạy với quyền owner (postgres),
-- nhưng chỉ xoá được row của chính người gọi (auth.uid()).
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Xoá dữ liệu liên quan trước (nếu chưa có ON DELETE CASCADE)
  DELETE FROM public.community_likes    WHERE user_id = uid;
  DELETE FROM public.community_bookmarks WHERE user_id = uid;
  DELETE FROM public.community_comments WHERE user_id = uid;
  DELETE FROM public.community_posts    WHERE user_id = uid;
  DELETE FROM public.shifts             WHERE user_id = uid;
  DELETE FROM public.expenses           WHERE user_id = uid;
  DELETE FROM public.friends            WHERE user_id = uid OR friend_id = uid;
  DELETE FROM public.place_reviews      WHERE user_id = uid;
  DELETE FROM public.profiles           WHERE id = uid;

  -- Cuối cùng xoá auth user (cascade auth.sessions, tokens...)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Chỉ user đã đăng nhập mới gọi được
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
