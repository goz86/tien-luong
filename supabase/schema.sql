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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
CREATE POLICY "Users can view their own profile." ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

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
