-- LifePilot: social & community (follows, feed, DMs, notifications)
-- Safe to run once; use IF NOT EXISTS where applicable

-- ----- Public read for profiles (authenticated members) -----
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ----- Task completion timestamp (for feed accuracy) -----
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ----- follows -----
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- ----- activities (motivation feed) -----
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_completed', 'streak_update')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_user_created ON public.activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_created ON public.activities(created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_feed" ON public.activities;
DROP POLICY IF EXISTS "activities_select_auth" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;

-- Any signed-in user can read activities (small community / motivation). Home feed filters to followed in the app.
CREATE POLICY "activities_select_auth" ON public.activities FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "activities_insert_own" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "activities_delete_own" ON public.activities;
CREATE POLICY "activities_delete_own" ON public.activities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----- direct conversations (1:1) -----
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS cp_user_idx ON public.conversation_participants(user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_select_participant" ON public.conversations;
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.conversation_participants;

CREATE POLICY "conv_select_participant" ON public.conversations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "cp_select" ON public.conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ----- messages -----
CREATE TABLE IF NOT EXISTS public.social_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_messages_conv_created ON public.social_messages(conversation_id, created_at DESC);

ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;

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

-- ----- notifications -----
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notif_user_idx ON public.app_notifications(user_id, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_notif_select" ON public.app_notifications;
DROP POLICY IF EXISTS "app_notif_update" ON public.app_notifications;

CREATE POLICY "app_notif_select" ON public.app_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "app_notif_update" ON public.app_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ----- RPC: find or create 1:1 conversation -----
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  conv_id UUID;
BEGIN
  IF p_other_user IS NULL OR me IS NULL OR p_other_user = me THEN
    RAISE EXCEPTION 'invalid conversation';
  END IF;
  SELECT c.id INTO conv_id
  FROM public.conversations c
  WHERE EXISTS (
    SELECT 1 FROM public.conversation_participants x
    WHERE x.conversation_id = c.id AND x.user_id = me
  )
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants y
    WHERE y.conversation_id = c.id AND y.user_id = p_other_user
  )
  AND (SELECT COUNT(*) FROM public.conversation_participants z WHERE z.conversation_id = c.id) = 2
  LIMIT 1;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, me);
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, p_other_user);
  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_other_participant(p_conversation_id UUID)
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

GRANT EXECUTE ON FUNCTION public.get_other_participant(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_other_participant(UUID) FROM PUBLIC;

-- ----- Notify on new follower -----
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fname TEXT;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO fname FROM public.profiles WHERE user_id = NEW.follower_id LIMIT 1;
  INSERT INTO public.app_notifications (user_id, type, title, body, data)
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    fname || ' started following you',
    jsonb_build_object('follower_id', NEW.follower_id::text)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_new_follower ON public.follows;
CREATE TRIGGER tr_notify_new_follower
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_follower();

-- ----- Notify on DM + bump conversation -----
CREATE OR REPLACE FUNCTION public.notify_new_dm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient UUID;
  sname TEXT;
BEGIN
  SELECT cp.user_id INTO recipient
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id <> NEW.sender_id
  LIMIT 1;

  IF recipient IS NOT NULL THEN
    SELECT COALESCE(name, 'Someone') INTO sname FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
    INSERT INTO public.app_notifications (user_id, type, title, body, data)
    VALUES (
      recipient,
      'message',
      'New message',
      sname || ': ' || LEFT(NEW.text, 100),
      jsonb_build_object(
        'conversation_id', NEW.conversation_id::text,
        'sender_id', NEW.sender_id::text
      )
    );
  END IF;

  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_new_dm ON public.social_messages;
CREATE TRIGGER tr_notify_new_dm
  AFTER INSERT ON public.social_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_dm();
