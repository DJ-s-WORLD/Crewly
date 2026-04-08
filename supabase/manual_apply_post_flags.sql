-- Run in Supabase SQL Editor (see also manual_apply_public_profile_rls.sql for policy-only refresh).
-- Part 1: columns + posts UPDATE. Part 2: public profile SELECT + related RLS (Instagram-style grids).

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS download_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS posts_user_archived ON public.posts (user_id, archived);

DROP POLICY IF EXISTS "posts_select_followers" ON public.posts;

CREATE POLICY "posts_select_followers" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid ()
    OR NOT COALESCE(archived, false)
  );

DROP POLICY IF EXISTS "posts_update_own" ON public.posts;

CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "post_likes_select_visible" ON public.post_likes;

DROP POLICY IF EXISTS "post_likes_insert_visible" ON public.post_likes;

CREATE POLICY "post_likes_select_visible" ON public.post_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_likes.post_id
        AND (
          p.user_id = auth.uid ()
          OR NOT COALESCE(p.archived, false)
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
          OR NOT COALESCE(p.archived, false)
        )
    )
  );

DROP POLICY IF EXISTS "post_comments_select_visible" ON public.post_comments;

DROP POLICY IF EXISTS "post_comments_insert_visible" ON public.post_comments;

CREATE POLICY "post_comments_select_visible" ON public.post_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_comments.post_id
        AND (
          p.user_id = auth.uid ()
          OR NOT COALESCE(p.archived, false)
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
          OR NOT COALESCE(p.archived, false)
        )
    )
  );

DROP POLICY IF EXISTS "post_tags_select_visible" ON public.post_tags;

CREATE POLICY "post_tags_select_visible" ON public.post_tags FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_tags.post_id
        AND (
          p.user_id = auth.uid ()
          OR NOT COALESCE(p.archived, false)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
