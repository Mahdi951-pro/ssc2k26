-- Function to find or create a direct conversation between two users.
-- SECURITY DEFINER bypasses the (auth.uid() = user_id) WITH CHECK on
-- conversation_members so the creator can add the other participant.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _other IS NULL OR _other = _me THEN
    RAISE EXCEPTION 'Invalid other user';
  END IF;

  -- Find existing direct conversation that contains BOTH users
  SELECT c.id INTO _conv
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _other)
  LIMIT 1;

  IF _conv IS NOT NULL THEN
    RETURN _conv;
  END IF;

  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', _me)
  RETURNING id INTO _conv;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conv, _me), (_conv, _other);

  RETURN _conv;
END;
$$;