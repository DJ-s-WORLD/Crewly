-- Post archive + interaction flags

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS posts_user_archived ON public.posts (user_id, archived);

DROP POLICY IF EXISTS "posts_select_followers" ON public.posts;

CREATE POLICY "posts_select_followers" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid ()
    OR (
      NOT archived
      AND user_id IN (
        SELECT following_id
        FROM public.follows
        WHERE follower_id = auth.uid ()
      )
    )
  );

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;

CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

NOTIFY pgrst, 'reload schema';
