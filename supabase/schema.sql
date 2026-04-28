-- =============================================
-- DUHOC MATE — Full Database Schema
-- =============================================

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  school TEXT,
  region TEXT,
  note TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile." ON profiles;
CREATE POLICY "Users can view their own profile." ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;
CREATE POLICY "Users can update their own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Shift Entries
CREATE TABLE IF NOT EXISTS shift_entries (
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

ALTER TABLE shift_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own shifts." ON shift_entries;
CREATE POLICY "Users can view their own shifts." ON shift_entries FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own shifts." ON shift_entries;
CREATE POLICY "Users can insert their own shifts." ON shift_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own shifts." ON shift_entries;
CREATE POLICY "Users can update their own shifts." ON shift_entries FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own shifts." ON shift_entries;
CREATE POLICY "Users can delete their own shifts." ON shift_entries FOR DELETE USING (auth.uid() = user_id);

-- 3. Companion Requests
CREATE TABLE IF NOT EXISTS companion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id),
  companion_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE companion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own requests." ON companion_requests;
CREATE POLICY "Users can view their own requests." ON companion_requests FOR SELECT USING (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Users can insert their own requests." ON companion_requests;
CREATE POLICY "Users can insert their own requests." ON companion_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- 4. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  category TEXT,
  amount NUMERIC,
  date TEXT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own expenses." ON expenses;
CREATE POLICY "Users can view their own expenses." ON expenses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own expenses." ON expenses;
CREATE POLICY "Users can insert their own expenses." ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own expenses." ON expenses;
CREATE POLICY "Users can update their own expenses." ON expenses FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own expenses." ON expenses;
CREATE POLICY "Users can delete their own expenses." ON expenses FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 5. Community Posts (Updated)
-- =============================================
DROP TABLE IF EXISTS community_bookmarks CASCADE;
DROP TABLE IF EXISTS community_likes CASCADE;
DROP TABLE IF EXISTS community_comments CASCADE;
DROP TABLE IF EXISTS community_posts CASCADE;

CREATE TABLE community_posts (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view posts." ON community_posts;
CREATE POLICY "Anyone can view posts." ON community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert posts." ON community_posts;
CREATE POLICY "Authenticated users can insert posts." ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own posts." ON community_posts;
CREATE POLICY "Users can update own posts." ON community_posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own posts." ON community_posts;
CREATE POLICY "Users can delete own posts." ON community_posts FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 6. Community Comments (with threading)
-- =============================================
CREATE TABLE community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  display_name TEXT DEFAULT 'Ẩn danh',
  is_author BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comments." ON community_comments;
CREATE POLICY "Anyone can view comments." ON community_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert comments." ON community_comments;
CREATE POLICY "Authenticated users can insert comments." ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments." ON community_comments;
CREATE POLICY "Users can delete own comments." ON community_comments FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- 7. Community Likes
-- =============================================
CREATE TABLE community_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  is_like BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view likes." ON community_likes;
CREATE POLICY "Anyone can view likes." ON community_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert likes." ON community_likes;
CREATE POLICY "Authenticated users can insert likes." ON community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own likes." ON community_likes;
CREATE POLICY "Users can delete own likes." ON community_likes FOR DELETE USING (auth.uid() = user_id);

-- Unique constraints to prevent duplicate likes
CREATE UNIQUE INDEX IF NOT EXISTS unique_post_like ON community_likes(user_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_comment_like ON community_likes(user_id, comment_id) WHERE comment_id IS NOT NULL;

-- =============================================
-- 8. Community Bookmarks
-- =============================================
CREATE TABLE community_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, post_id)
);

ALTER TABLE community_bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bookmarks." ON community_bookmarks;
CREATE POLICY "Users can view own bookmarks." ON community_bookmarks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert bookmarks." ON community_bookmarks;
CREATE POLICY "Users can insert bookmarks." ON community_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks." ON community_bookmarks;
CREATE POLICY "Users can delete own bookmarks." ON community_bookmarks FOR DELETE USING (auth.uid() = user_id);
