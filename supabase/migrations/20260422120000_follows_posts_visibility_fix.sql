-- Fix Instagram-style public profiles when plain RLS on `follows` misbehaves (self-reference / evaluation order).
-- 1) SECURITY DEFINER helpers (row_security off inside) for reliable counts + follow-row visibility.
-- 2) Re-apply posts SELECT policy (in case an older migration reverted it to "followers only").

-- ----- Follow visibility (used by follows SELECT policy) -----
CREATE OR REPLACE FUNCTION public.follows_select_visible (p_follower uuid, p_following uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    p_follower = auth.uid ()
    OR p_following = auth.uid ()
    OR NOT COALESCE((SELECT is_private FROM public.profiles pr WHERE pr.user_id = p_following LIMIT 1), false)
    OR (
      COALESCE((SELECT is_private FROM public.profiles pr WHERE pr.user_id = p_following LIMIT 1), false)
      AND (
        p_following = auth.uid ()
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.following_id = p_following
            AND f.follower_id = auth.uid ()
        )
      )
    )
    OR (
      NOT COALESCE((SELECT is_private FROM public.profiles pr WHERE pr.user_id = p_follower LIMIT 1), false)
      AND (
        NOT COALESCE((SELECT is_private FROM public.profiles pr WHERE pr.user_id = p_following LIMIT 1), false)
        OR p_following = auth.uid ()
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.following_id = p_following
            AND f.follower_id = auth.uid ()
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.follows_select_visible (uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.follows_select_visible (uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "follows_select" ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated
  USING (public.follows_select_visible (follower_id, following_id));

-- ----- Accurate follower/following counts for any profile (matches DB; not filtered by RLS) -----
CREATE OR REPLACE FUNCTION public.get_public_follow_counts (p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT json_build_object(
    'followers',
    (SELECT COUNT(*)::int FROM public.follows WHERE following_id = p_user_id),
    'following',
    (SELECT COUNT(*)::int FROM public.follows WHERE follower_id = p_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_follow_counts (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_follow_counts (uuid) TO authenticated, service_role;

-- ----- Post count for profile header (non-archived) -----
CREATE OR REPLACE FUNCTION public.get_public_post_count_for_user (p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COUNT(*)::int
  FROM public.posts
  WHERE user_id = p_user_id
    AND NOT COALESCE(archived, false);
$$;

REVOKE ALL ON FUNCTION public.get_public_post_count_for_user (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_post_count_for_user (uuid) TO authenticated, service_role;

-- ----- Posts: public profile grid + private followers-only -----
DROP POLICY IF EXISTS "posts_select_followers" ON public.posts;

CREATE POLICY "posts_select_followers" ON public.posts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid ()
    OR (
      NOT COALESCE(archived, false)
      AND (
        NOT COALESCE((SELECT is_private FROM public.profiles pr WHERE pr.user_id = posts.user_id LIMIT 1), false)
        OR EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.following_id = posts.user_id
            AND f.follower_id = auth.uid ()
        )
      )
    )
  );

NOTIFY pgrst, 'reload schema';
