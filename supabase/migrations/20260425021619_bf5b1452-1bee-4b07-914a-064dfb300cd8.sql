-- Make direct chat creation and membership safer/reliable
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _other) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT c.id INTO _conv
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = c.id AND m.user_id = _other)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF _conv IS NOT NULL THEN
    RETURN _conv;
  END IF;

  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', _me)
  RETURNING id INTO _conv;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conv, _me)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (_conv, _other)
  ON CONFLICT DO NOTHING;

  RETURN _conv;
END;
$$;

-- Safe helper for read receipts / last-read updates
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = _conversation
    AND user_id = _me;
END;
$$;

-- Keep the conversation list fresh when a message is created
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation_on_message_trigger ON public.messages;
CREATE TRIGGER touch_conversation_on_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_conversation_on_message();