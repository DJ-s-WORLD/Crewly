-- =============================================================================
-- LifePilot: fix PGRST205 "Could not find the table 'public.tasks'"
-- Run this ONCE in Supabase Dashboard → SQL Editor → Run (as postgres)
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where needed
-- =============================================================================

-- ----- profiles -----
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bg_color TEXT DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON public.profiles (user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Social: any signed-in user can read basic profiles (name, avatar, streak) for Explore / feeds
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ----- tasks -----
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_user_id_created_at_idx ON public.tasks (user_id, created_at DESC);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- ----- chat_messages -----
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx ON public.chat_messages (user_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;

CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----- profile auto-create on signup -----
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----- updated_at on profiles -----
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ----- avatars bucket + storage policies -----
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- =============================================================================
-- Social & community (follows, activities, DMs, app_notifications)
-- Fixes PGRST205 for public.follows, public.activities, public.app_notifications, etc.
-- =============================================================================

-- ----- follows -----
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

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

-- ----- activities -----
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_completed', 'streak_update')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activities_user_created ON public.activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_created ON public.activities (created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_feed" ON public.activities;
DROP POLICY IF EXISTS "activities_select_auth" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_own" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_own" ON public.activities;

CREATE POLICY "activities_select_auth" ON public.activities FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "activities_insert_own" ON public.activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activities_delete_own" ON public.activities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ----- conversations & DMs -----
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS cp_user_idx ON public.conversation_participants (user_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_select_participant" ON public.conversations;
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.conversation_participants;

-- conversations: no self-reference on conversation_participants policy
CREATE POLICY "conv_select_participant" ON public.conversations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );
-- participants: only own rows — never reference conversation_participants inside this policy (avoids recursion)
CREATE POLICY "cp_select" ON public.conversation_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "cp_insert" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_messages_conv_created ON public.social_messages (conversation_id, created_at DESC);

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

-- ----- in-app notifications -----
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notif_user_idx ON public.app_notifications (user_id, created_at DESC);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_notif_select" ON public.app_notifications;
DROP POLICY IF EXISTS "app_notif_update" ON public.app_notifications;

CREATE POLICY "app_notif_select" ON public.app_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "app_notif_update" ON public.app_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ----- RPC: 1:1 conversation -----
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation (p_other_user UUID)
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

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, me);
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, p_other_user);
  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation (UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation (UUID) FROM PUBLIC;

-- ----- RPC: other participant (RLS only exposes own participant row) -----
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

-- ----- Triggers: notify on follow / DM -----
CREATE OR REPLACE FUNCTION public.notify_new_follower ()
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
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_follower ();

CREATE OR REPLACE FUNCTION public.notify_new_dm ()
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
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_dm ();

-- ----- Social posts (mirrors migration 20260408120000_social_posts.sql) -----
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS app_notif_reference_idx ON public.app_notifications (reference_id)
  WHERE reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  CONSTRAINT posts_content_or_image CHECK (
    (
      image_url IS NOT NULL
      AND trim(image_url) <> ''
    )
    OR  (content IS NOT NULL AND length(trim(content)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS posts_user_created ON public.posts (user_id, created_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_followers" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;

CREATE POLICY "posts_select_followers" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid ()
    OR user_id IN (
      SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
    )
  );

CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_idx ON public.post_likes (post_id);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select_visible" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_visible" ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own" ON public.post_likes;

CREATE POLICY "post_likes_select_visible" ON public.post_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid ())
        )
    )
  );

CREATE POLICY "post_likes_insert_visible" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid ())
        )
    )
  );

CREATE POLICY "post_likes_delete_own" ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  CONSTRAINT post_comments_text_nonempty CHECK (length(trim(text)) > 0)
);

CREATE INDEX IF NOT EXISTS post_comments_post_created ON public.post_comments (post_id, created_at);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select_visible" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_visible" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

CREATE POLICY "post_comments_select_visible" ON public.post_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid ())
        )
    )
  );

CREATE POLICY "post_comments_insert_visible" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid ())
        )
    )
  );

CREATE POLICY "post_comments_delete_own" ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

CREATE TABLE IF NOT EXISTS public.post_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts (id) ON DELETE CASCADE,
  tagged_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  UNIQUE (post_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS post_tags_tagged_idx ON public.post_tags (tagged_user_id);

ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_tags_select_visible" ON public.post_tags;
DROP POLICY IF EXISTS "post_tags_insert_owner" ON public.post_tags;

CREATE POLICY "post_tags_select_visible" ON public.post_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_tags.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid ())
        )
    )
  );

CREATE POLICY "post_tags_insert_owner" ON public.post_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts WHERE id = post_tags.post_id AND user_id = auth.uid ())
    AND tagged_user_id <> auth.uid ()
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "posts_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "posts_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "posts_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "posts_storage_delete" ON storage.objects;

CREATE POLICY "posts_storage_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'posts');

CREATE POLICY "posts_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'posts'
    AND (storage.foldername (name))[1] = auth.uid ()::text
  );

CREATE POLICY "posts_storage_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername (name))[1] = auth.uid ()::text
  );

CREATE POLICY "posts_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'posts'
    AND (storage.foldername (name))[1] = auth.uid ()::text
  );

CREATE OR REPLACE FUNCTION public.notify_followers_new_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pname TEXT;
  follower RECORD;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO pname FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  FOR follower IN
  SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id
  LOOP
    INSERT INTO public.app_notifications (
      user_id,
      type,
      title,
      body,
      sender_id,
      reference_id,
      data
    )
    VALUES (
      follower.follower_id,
      'post',
      'New post',
      pname || ' shared a new post',
      NEW.user_id,
      NEW.id,
      jsonb_build_object('post_id', NEW.id::text, 'sender_id', NEW.user_id::text)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_followers_new_post ON public.posts;
CREATE TRIGGER tr_notify_followers_new_post
  AFTER INSERT ON public.posts FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_new_post ();

CREATE OR REPLACE FUNCTION public.notify_post_like ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  liker_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id LIMIT 1;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(name, 'Someone') INTO liker_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
  VALUES (
    owner_id,
    'like',
    'New like',
    liker_name || ' liked your post',
    NEW.user_id,
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id::text, 'sender_id', NEW.user_id::text)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_post_like ON public.post_likes;
CREATE TRIGGER tr_notify_post_like
  AFTER INSERT ON public.post_likes FOR EACH ROW
EXECUTE FUNCTION public.notify_post_like ();

CREATE OR REPLACE FUNCTION public.notify_post_comment ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  author_name TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM public.posts WHERE id = NEW.post_id LIMIT 1;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(name, 'Someone') INTO author_name FROM public.profiles WHERE user_id = NEW.user_id LIMIT 1;
  INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
  VALUES (
    owner_id,
    'comment',
    'New comment',
    author_name || ': ' || LEFT(NEW.text, 120),
    NEW.user_id,
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id::text, 'sender_id', NEW.user_id::text)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_post_comment ON public.post_comments;
CREATE TRIGGER tr_notify_post_comment
  AFTER INSERT ON public.post_comments FOR EACH ROW
EXECUTE FUNCTION public.notify_post_comment ();

CREATE OR REPLACE FUNCTION public.notify_post_tag ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_id UUID;
  author_name TEXT;
BEGIN
  SELECT user_id INTO author_id FROM public.posts WHERE id = NEW.post_id LIMIT 1;
  IF author_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(name, 'Someone') INTO author_name FROM public.profiles WHERE user_id = author_id LIMIT 1;
  INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
  VALUES (
    NEW.tagged_user_id,
    'post_tag',
    'You were mentioned',
    author_name || ' tagged you in a post',
    author_id,
    NEW.post_id,
    jsonb_build_object('post_id', NEW.post_id::text, 'sender_id', author_id::text)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_post_tag ON public.post_tags;
CREATE TRIGGER tr_notify_post_tag
  AFTER INSERT ON public.post_tags FOR EACH ROW
EXECUTE FUNCTION public.notify_post_tag ();

CREATE OR REPLACE FUNCTION public.notify_followers_task_completion (p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid ();
  follower RECORD;
BEGIN
  IF me IS NULL OR p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RETURN;
  END IF;
  FOR follower IN
  SELECT follower_id FROM public.follows WHERE following_id = me
  LOOP
    INSERT INTO public.app_notifications (
      user_id,
      type,
      title,
      body,
      sender_id,
      reference_id,
      data
    )
    VALUES (
      follower.follower_id,
      'task_completed',
      'Crew update',
      trim(p_message),
      me,
      NULL,
      jsonb_build_object('sender_id', me::text)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_followers_task_completion (TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.notify_followers_task_completion (TEXT) FROM PUBLIC;

-- Refresh PostgREST schema cache (hosted Supabase)
NOTIFY pgrst, 'reload schema';
