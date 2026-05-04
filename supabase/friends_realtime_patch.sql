-- DUHOC MATE - Friends / Chat / Review realtime patch
-- Run this whole file in Supabase SQL Editor.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS profiles_location_idx
ON public.profiles(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx
ON public.profiles(last_seen_at DESC);

DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles." ON public.profiles;
CREATE POLICY "Authenticated users can view profiles." ON public.profiles
FOR SELECT TO authenticated USING (true);

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

CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx
ON public.friend_requests(requester_id, status);

CREATE INDEX IF NOT EXISTS friend_requests_target_status_idx
ON public.friend_requests(target_profile_id, status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE INDEX IF NOT EXISTS chat_messages_sender_receiver_created_idx
ON public.chat_messages(sender_id, receiver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_receiver_sender_created_idx
ON public.chat_messages(receiver_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_unread_receiver_idx
ON public.chat_messages(receiver_id, is_read, created_at DESC)
WHERE is_read = false;

CREATE OR REPLACE FUNCTION public.increment_review_upvote(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.place_reviews
  SET upvotes_count = COALESCE(upvotes_count, 0) + 1
  WHERE id = row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_review_downvote(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.place_reviews
  SET downvotes_count = COALESCE(downvotes_count, 0) + 1
  WHERE id = row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_review_upvote(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_review_downvote(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_review_upvote(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_review_downvote(UUID) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.place_reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
