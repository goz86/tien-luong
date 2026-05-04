-- Run if the accept friend request button does not update.
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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

DROP POLICY IF EXISTS "Participants can update friend requests." ON public.friend_requests;
CREATE POLICY "Participants can update friend requests." ON public.friend_requests
FOR UPDATE USING ((select auth.uid()) IN (requester_id, target_profile_id))
WITH CHECK ((select auth.uid()) IN (requester_id, target_profile_id));
