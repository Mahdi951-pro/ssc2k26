
-- 1. Pinned message per conversation
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_message_id uuid;

-- 2. Per-user wallpaper for each conversation
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS wallpaper text;

-- 3. RPC to mark a single message as read by current user (idempotent)
CREATE OR REPLACE FUNCTION public.mark_message_read(_message uuid)
RETURNS void
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

  SELECT conversation_id INTO _conv FROM public.messages WHERE id = _message;
  IF _conv IS NULL THEN RETURN; END IF;
  IF NOT public.is_member(_conv, _me) THEN RETURN; END IF;

  INSERT INTO public.message_reads (message_id, user_id)
  VALUES (_message, _me)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Helpful uniqueness for reads (one read row per user/message)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_reads_unique_user_msg'
  ) THEN
    ALTER TABLE public.message_reads
      ADD CONSTRAINT message_reads_unique_user_msg UNIQUE (message_id, user_id);
  END IF;
END $$;

-- Enable realtime for message_reads so ticks update live
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
