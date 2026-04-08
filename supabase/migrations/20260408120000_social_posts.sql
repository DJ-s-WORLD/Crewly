-- LifePilot: social posts, likes, comments, tags, storage, notifications extensions

-- ----- Extend app_notifications (optional columns for social) -----
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS app_notif_reference_idx ON public.app_notifications (reference_id)
  WHERE reference_id IS NOT NULL;

-- ----- posts -----
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
    OR (
      content IS NOT NULL
      AND length(trim(content)) > 0
    )
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
      SELECT following_id
      FROM public.follows
      WHERE follower_id = auth.uid ()
    )
  );

CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

-- ----- post_likes -----
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
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
          )
        )
    )
  );

CREATE POLICY "post_likes_insert_visible" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
          )
        )
    )
  );

CREATE POLICY "post_likes_delete_own" ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

-- ----- post_comments -----
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
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
          )
        )
    )
  );

CREATE POLICY "post_comments_insert_visible" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
          )
        )
    )
  );

CREATE POLICY "post_comments_delete_own" ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

-- ----- post_tags -----
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
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_tags.post_id
        AND (
          p.user_id = auth.uid ()
          OR p.user_id IN (
            SELECT following_id FROM public.follows WHERE follower_id = auth.uid ()
          )
        )
    )
  );

CREATE POLICY "post_tags_insert_owner" ON public.post_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts WHERE id = post_tags.post_id AND user_id = auth.uid ()
    )
    AND tagged_user_id <> auth.uid ()
  );

-- ----- Storage: posts bucket -----
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

-- ----- Notify followers: new post -----
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

-- ----- Notify: post like -----
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

-- ----- Notify: post comment -----
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

-- ----- Notify: tagged in post -----
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

-- ----- Notify followers: task completion (called from app after rollup activity saved) -----
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

NOTIFY pgrst, 'reload schema';
