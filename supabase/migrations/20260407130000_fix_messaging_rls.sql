-- Fix infinite recursion on conversation_participants RLS.
-- Old "cp_select" referenced conversation_participants inside its own USING clause.

-- ----- conversation_participants: only own rows (non-recursive) -----
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.conversation_participants;

CREATE POLICY "cp_select" ON public.conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ----- conversations: membership via subquery (reads cp with simple policy only) -----
DROP POLICY IF EXISTS "conv_select_participant" ON public.conversations;

CREATE POLICY "conv_select_participant" ON public.conversations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- ----- social_messages (DMs): IN subquery pattern -----
DROP POLICY IF EXISTS "social_messages_select" ON public.social_messages;
DROP POLICY IF EXISTS "social_messages_insert" ON public.social_messages;

CREATE POLICY "social_messages_select" ON public.social_messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "social_messages_insert" ON public.social_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- ----- Resolve peer user without SELECT on other users' participant rows -----
CREATE OR REPLACE FUNCTION public.get_other_participant (p_conversation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  member_ok BOOLEAN;
  other_id UUID;
BEGIN
  IF me IS NULL OR p_conversation_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = p_conversation_id AND p.user_id = me
  ) INTO member_ok;

  IF NOT member_ok THEN
    RETURN NULL;
  END IF;

  SELECT p.user_id INTO other_id
  FROM public.conversation_participants p
  WHERE p.conversation_id = p_conversation_id AND p.user_id <> me
  LIMIT 1;

  RETURN other_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_other_participant (UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_other_participant (UUID) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
