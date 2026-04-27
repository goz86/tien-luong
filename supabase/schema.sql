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

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  board TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view posts." ON community_posts;
CREATE POLICY "Anyone can view posts." ON community_posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert posts." ON community_posts;
CREATE POLICY "Users can insert posts." ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own posts." ON community_posts;
CREATE POLICY "Users can delete own posts." ON community_posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view comments." ON community_comments;
CREATE POLICY "Anyone can view comments." ON community_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert comments." ON community_comments;
CREATE POLICY "Users can insert comments." ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own comments." ON community_comments;
CREATE POLICY "Users can delete own comments." ON community_comments FOR DELETE USING (auth.uid() = user_id);
