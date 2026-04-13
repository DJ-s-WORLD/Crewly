-- Superseded by manual_apply_profile_visibility_fix.sql (SECURITY DEFINER + RPC counts).
-- Run in Supabase SQL Editor if migrations are not applied from CLI.
-- Fixes follower/following counts and lists on public profiles (Instagram-style).

DROP POLICY IF EXISTS "follows_select" ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR NOT COALESCE(
      (SELECT is_private FROM public.profiles pr WHERE pr.user_id = follows.following_id LIMIT 1),
      false
    )
    OR (
      COALESCE(
        (SELECT is_private FROM public.profiles pr WHERE pr.user_id = follows.following_id LIMIT 1),
        false
      )
      AND (
        follows.following_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.following_id = follows.following_id
            AND f.follower_id = auth.uid()
        )
      )
    )
    OR (
      NOT COALESCE(
        (SELECT is_private FROM public.profiles pr WHERE pr.user_id = follows.follower_id LIMIT 1),
        false
      )
      AND (
        NOT COALESCE(
          (SELECT is_private FROM public.profiles pr WHERE pr.user_id = follows.following_id LIMIT 1),
          false
        )
        OR follows.following_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.following_id = follows.following_id
            AND f.follower_id = auth.uid()
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
