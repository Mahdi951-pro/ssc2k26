-- 1. Add section lock columns to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_section_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_section text;

-- 2. Mark Section A and Section B groups
UPDATE public.conversations SET is_section_locked = true, locked_section = 'A'
  WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE public.conversations SET is_section_locked = true, locked_section = 'B'
  WHERE id = '33333333-3333-3333-3333-333333333333';

-- 3. Helper: get a user's section
CREATE OR REPLACE FUNCTION public.get_user_section(_user uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NULLIF(upper(trim(section)), '') FROM public.profiles WHERE user_id = _user
$$;

-- 4. Replace the messages insert policy to enforce section lock
DROP POLICY IF EXISTS "Members send messages" ON public.messages;
CREATE POLICY "Members send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND is_member(conversation_id, auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.is_section_locked = true
        AND c.locked_section IS DISTINCT FROM public.get_user_section(auth.uid())
    )
  )
);

-- 5. Auto-join section groups when profile section changes
CREATE OR REPLACE FUNCTION public.sync_section_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sec text := NULLIF(upper(trim(NEW.section)), '');
  _target_id uuid;
BEGIN
  IF _sec = 'A' THEN
    _target_id := '22222222-2222-2222-2222-222222222222';
  ELSIF _sec = 'B' THEN
    _target_id := '33333333-3333-3333-3333-333333333333';
  END IF;

  IF _target_id IS NOT NULL THEN
    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (_target_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_section_sync ON public.profiles;
CREATE TRIGGER profile_section_sync
AFTER INSERT OR UPDATE OF section ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_section_membership();

-- 6. Backfill: ensure existing users with section are in correct group
INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT '22222222-2222-2222-2222-222222222222', user_id FROM public.profiles
WHERE NULLIF(upper(trim(section)), '') = 'A'
ON CONFLICT DO NOTHING;
INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT '33333333-3333-3333-3333-333333333333', user_id FROM public.profiles
WHERE NULLIF(upper(trim(section)), '') = 'B'
ON CONFLICT DO NOTHING;

-- 7. Verified badge for admins
UPDATE public.profiles
SET badges = (
  SELECT array_agg(DISTINCT b)
  FROM unnest(COALESCE(badges, ARRAY[]::text[]) || ARRAY['verified','admin']) AS b
)
WHERE user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

-- 8. Allow group admins (conversation_members.is_admin) to update group conversations
DROP POLICY IF EXISTS "Group admins update conversations" ON public.conversations;
CREATE POLICY "Group admins update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = id AND m.user_id = auth.uid() AND m.is_admin = true
  )
);
