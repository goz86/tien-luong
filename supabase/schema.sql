-- =============================================
-- DUHOC MATE - Safe Supabase Schema
-- Re-runnable: no destructive DROP TABLE commands.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  school TEXT,
  region TEXT,
  note TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles." ON public.profiles;
CREATE POLICY "Authenticated users can view profiles." ON public.profiles
FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

CREATE INDEX IF NOT EXISTS profiles_location_idx ON public.profiles(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles(last_seen_at DESC);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Shift Entries
CREATE TABLE IF NOT EXISTS public.shift_entries (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  work_date TEXT,
  venue TEXT,
  start_time TEXT,
  end_time TEXT,
  hourly_wage NUMERIC,
  break_minutes INTEGER,
  notes TEXT,
  night_shift BOOLEAN,
  tax_deduction BOOLEAN,
  holiday_allowance NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.shift_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own shifts." ON public.shift_entries;
CREATE POLICY "Users can view their own shifts." ON public.shift_entries FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own shifts." ON public.shift_entries;
CREATE POLICY "Users can insert their own shifts." ON public.shift_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own shifts." ON public.shift_entries;
CREATE POLICY "Users can update their own shifts." ON public.shift_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own shifts." ON public.shift_entries;
CREATE POLICY "Users can delete their own shifts." ON public.shift_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS shift_entries_user_date_idx ON public.shift_entries(user_id, work_date);

-- 3. Companion Requests
CREATE TABLE IF NOT EXISTS public.companion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id),
  companion_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.companion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own requests." ON public.companion_requests;
CREATE POLICY "Users can view their own requests." ON public.companion_requests FOR SELECT USING (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Users can insert their own requests." ON public.companion_requests;
CREATE POLICY "Users can insert their own requests." ON public.companion_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE INDEX IF NOT EXISTS companion_requests_requester_idx ON public.companion_requests(requester_id);

-- 3B. Friend Requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CHECK (requester_id <> target_profile_id)
);

ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_unique_pair_idx
ON public.friend_requests(LEAST(requester_id, target_profile_id), GREATEST(requester_id, target_profile_id));
CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx ON public.friend_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_target_status_idx ON public.friend_requests(target_profile_id, status);

DROP TRIGGER IF EXISTS set_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER set_friend_requests_updated_at
BEFORE UPDATE ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.are_profiles_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_a <> user_b
    AND ((select auth.uid()) = user_a OR (select auth.uid()) = user_b)
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

-- 3C. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read BOOLEAN NOT NULL DEFAULT false,
  CHECK (sender_id <> receiver_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants can view chat messages." ON public.chat_messages;
CREATE POLICY "Participants can view chat messages." ON public.chat_messages
FOR SELECT USING ((select auth.uid()) IN (sender_id, receiver_id));
DROP POLICY IF EXISTS "Friends can send chat messages." ON public.chat_messages;
CREATE POLICY "Friends can send chat messages." ON public.chat_messages
FOR INSERT WITH CHECK (
  (select auth.uid()) = sender_id
  AND public.are_profiles_friends(sender_id, receiver_id)
);
DROP POLICY IF EXISTS "Receivers can mark chat messages read." ON public.chat_messages;
CREATE POLICY "Receivers can mark chat messages read." ON public.chat_messages
FOR UPDATE USING ((select auth.uid()) = receiver_id)
WITH CHECK ((select auth.uid()) = receiver_id);
DROP POLICY IF EXISTS "Participants can delete chat messages." ON public.chat_messages;
CREATE POLICY "Participants can delete chat messages." ON public.chat_messages
FOR DELETE USING ((select auth.uid()) IN (sender_id, receiver_id));

CREATE INDEX IF NOT EXISTS chat_messages_sender_receiver_created_idx ON public.chat_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_receiver_sender_created_idx ON public.chat_messages(receiver_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_unread_receiver_idx ON public.chat_messages(receiver_id, is_read, created_at DESC) WHERE is_read = false;

-- 4. Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  category TEXT,
  amount NUMERIC,
  date TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own expenses." ON public.expenses;
CREATE POLICY "Users can view their own expenses." ON public.expenses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own expenses." ON public.expenses;
CREATE POLICY "Users can insert their own expenses." ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own expenses." ON public.expenses;
CREATE POLICY "Users can update their own expenses." ON public.expenses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own expenses." ON public.expenses;
CREATE POLICY "Users can delete their own expenses." ON public.expenses FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON public.expenses(user_id, date);

-- 5. Community Posts
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL DEFAULT 'free',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  display_name TEXT DEFAULT 'Ẩn danh',
  likes_count INTEGER DEFAULT 0,
  dislikes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view posts." ON public.community_posts;
CREATE POLICY "Anyone can view posts." ON public.community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert posts." ON public.community_posts;
CREATE POLICY "Authenticated users can insert posts." ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own posts." ON public.community_posts;
CREATE POLICY "Users can update own posts." ON public.community_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own posts." ON public.community_posts;
CREATE POLICY "Users can delete own posts." ON public.community_posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_posts_created_idx ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_category_created_idx ON public.community_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_user_idx ON public.community_posts(user_id);

DROP TRIGGER IF EXISTS set_community_posts_updated_at ON public.community_posts;
CREATE TRIGGER set_community_posts_updated_at
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Community Comments
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  display_name TEXT DEFAULT 'Ẩn danh',
  is_author BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comments." ON public.community_comments;
CREATE POLICY "Anyone can view comments." ON public.community_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert comments." ON public.community_comments;
CREATE POLICY "Authenticated users can insert comments." ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own comments." ON public.community_comments;
CREATE POLICY "Users can update own comments." ON public.community_comments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments." ON public.community_comments;
CREATE POLICY "Users can delete own comments." ON public.community_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_comments_post_created_idx ON public.community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS community_comments_parent_idx ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS community_comments_user_idx ON public.community_comments(user_id);

-- 7. Community Likes / Reactions
CREATE TABLE IF NOT EXISTS public.community_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  is_like BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view likes." ON public.community_likes;
CREATE POLICY "Anyone can view likes." ON public.community_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert likes." ON public.community_likes;
CREATE POLICY "Authenticated users can insert likes." ON public.community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own likes." ON public.community_likes;
CREATE POLICY "Users can update own likes." ON public.community_likes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own likes." ON public.community_likes;
CREATE POLICY "Users can delete own likes." ON public.community_likes FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_post_like ON public.community_likes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_comment_like ON public.community_likes(user_id, comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_likes_post_idx ON public.community_likes(post_id);
CREATE INDEX IF NOT EXISTS community_likes_comment_idx ON public.community_likes(comment_id);

-- 8. Community Bookmarks
CREATE TABLE IF NOT EXISTS public.community_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.community_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bookmarks." ON public.community_bookmarks;
CREATE POLICY "Users can view own bookmarks." ON public.community_bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert bookmarks." ON public.community_bookmarks;
CREATE POLICY "Users can insert bookmarks." ON public.community_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks." ON public.community_bookmarks;
CREATE POLICY "Users can delete own bookmarks." ON public.community_bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_bookmarks_user_idx ON public.community_bookmarks(user_id);

-- 9. Community Notifications
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES auth.users(id) NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications." ON public.community_notifications;
CREATE POLICY "Users can view own notifications." ON public.community_notifications FOR SELECT USING (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can insert relevant notifications." ON public.community_notifications;
CREATE POLICY "Users can insert relevant notifications." ON public.community_notifications
FOR INSERT WITH CHECK (auth.uid() = actor_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can update own notifications." ON public.community_notifications;
CREATE POLICY "Users can update own notifications." ON public.community_notifications
FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can delete own notifications." ON public.community_notifications;
CREATE POLICY "Users can delete own notifications." ON public.community_notifications FOR DELETE USING (auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS community_notifications_recipient_created_idx ON public.community_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_notifications_post_idx ON public.community_notifications(post_id);

-- 10. Investment Positions
CREATE TABLE IF NOT EXISTS public.investment_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'watchlist',
  quantity NUMERIC DEFAULT 0,
  average_price NUMERIC DEFAULT 0,
  current_price NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'KRW',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.investment_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own investments." ON public.investment_positions;
CREATE POLICY "Users can view own investments." ON public.investment_positions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own investments." ON public.investment_positions;
CREATE POLICY "Users can insert own investments." ON public.investment_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own investments." ON public.investment_positions;
CREATE POLICY "Users can update own investments." ON public.investment_positions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own investments." ON public.investment_positions;
CREATE POLICY "Users can delete own investments." ON public.investment_positions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS investment_positions_user_idx ON public.investment_positions(user_id);
CREATE INDEX IF NOT EXISTS investment_positions_symbol_idx ON public.investment_positions(symbol);

DROP TRIGGER IF EXISTS set_investment_positions_updated_at ON public.investment_positions;
CREATE TRIGGER set_investment_positions_updated_at
BEFORE UPDATE ON public.investment_positions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. Place Reviews
CREATE TABLE IF NOT EXISTS public.place_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  display_name TEXT DEFAULT 'Ẩn danh',
  is_anonymous BOOLEAN DEFAULT false,
  
  place_name TEXT NOT NULL,
  place_address TEXT NOT NULL,
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,
  category TEXT NOT NULL DEFAULT 'other',
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  
  helpful_count INTEGER DEFAULT 0,
  upvotes_count INTEGER DEFAULT 0,
  downvotes_count INTEGER DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS upvotes_count INTEGER DEFAULT 0;
ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS downvotes_count INTEGER DEFAULT 0;
ALTER TABLE public.place_reviews ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
ALTER TABLE public.place_reviews ALTER COLUMN upvotes_count SET DEFAULT 0;
ALTER TABLE public.place_reviews ALTER COLUMN downvotes_count SET DEFAULT 0;
ALTER TABLE public.place_reviews ALTER COLUMN images SET DEFAULT '{}';

ALTER TABLE public.place_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reviews." ON public.place_reviews;
CREATE POLICY "Anyone can view reviews." ON public.place_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert reviews." ON public.place_reviews;
CREATE POLICY "Authenticated users can insert reviews." ON public.place_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own reviews." ON public.place_reviews;
CREATE POLICY "Users can update own reviews." ON public.place_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own reviews." ON public.place_reviews;
CREATE POLICY "Users can delete own reviews." ON public.place_reviews FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS place_reviews_created_idx ON public.place_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS place_reviews_category_idx ON public.place_reviews(category);
CREATE INDEX IF NOT EXISTS place_reviews_user_idx ON public.place_reviews(user_id);

DROP TRIGGER IF EXISTS set_place_reviews_updated_at ON public.place_reviews;
CREATE TRIGGER set_place_reviews_updated_at
BEFORE UPDATE ON public.place_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.place_review_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES public.place_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(review_id, user_id)
);

ALTER TABLE public.place_review_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own review votes." ON public.place_review_votes;
CREATE POLICY "Users can view own review votes." ON public.place_review_votes
FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Authenticated users can insert own review votes." ON public.place_review_votes;
CREATE POLICY "Authenticated users can insert own review votes." ON public.place_review_votes
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own review votes." ON public.place_review_votes;
CREATE POLICY "Users can update own review votes." ON public.place_review_votes
FOR UPDATE USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own review votes." ON public.place_review_votes;
CREATE POLICY "Users can delete own review votes." ON public.place_review_votes
FOR DELETE USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS place_review_votes_user_idx ON public.place_review_votes(user_id);

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
-- 13. User Badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own badges." ON public.user_badges;
CREATE POLICY "Users can view own badges." ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own badges." ON public.user_badges;
CREATE POLICY "Users can insert own badges." ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 14. Enable Realtime for Community Tables
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_reviews;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_review_votes;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
