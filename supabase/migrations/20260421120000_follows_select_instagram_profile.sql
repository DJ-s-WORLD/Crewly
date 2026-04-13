-- Instagram-style visibility for `follows` rows:
-- - Follower / following COUNTS and lists for a PUBLIC profile: any signed-in user can read those edges.
-- - Edges TO a private account: only the private user or their accepted followers can read.
-- - Edges FROM a public account: readable unless they expose a private target to someone who is not
--   the target, not the follower, and does not follow the private target (prevents enumerating a
--   private user's follower list through a public intermediary).

DROP POLICY IF EXISTS "follows_select" ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    -- Incoming: anyone can see who follows a PUBLIC account (follower lists + counts).
    OR NOT COALESCE(
      (SELECT is_private FROM public.profiles pr WHERE pr.user_id = follows.following_id LIMIT 1),
      false
    )
    -- Incoming: PRIVATE account — only owner or accepted followers see incoming edges.
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
    -- Outgoing from a PUBLIC account — needed for "Following" lists, but do not leak a PRIVATE
    -- user's incoming follower list through arbitrary public followers.
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
