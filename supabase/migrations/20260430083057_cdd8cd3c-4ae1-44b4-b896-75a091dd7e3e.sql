DROP POLICY IF EXISTS "Members send messages" ON public.messages;

CREATE POLICY "Members send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_member(conversation_id, auth.uid())
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'announcement'
    )
    OR public.has_role(auth.uid(), 'admin')
  )
);