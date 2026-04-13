-- Run once in Supabase SQL Editor (same as migration 20260422120000_follows_posts_visibility_fix.sql).

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

-- ----- Profile posts grid + follower/following lists (same as 20260423120000_profile_posts_and_follow_lists_rpc.sql) -----
CREATE OR REPLACE FUNCTION public.profile_posts_page (
  p_profile_user_id uuid,
  p_limit int,
  p_offset int
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.user_id = p_profile_user_id
    AND NOT COALESCE(p.archived, false)
    AND (
      p_profile_user_id = auth.uid ()
      OR NOT COALESCE(
        (SELECT is_private FROM public.profiles pr WHERE pr.user_id = p_profile_user_id LIMIT 1),
        false
      )
      OR EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.following_id = p_profile_user_id
          AND f.follower_id = auth.uid ()
      )
    )
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 100))
  OFFSET greatest(0, coalesce(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.profile_posts_page (uuid, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_posts_page (uuid, int, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profile_follower_ids (p_profile_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  priv boolean;
BEGIN
  IF auth.uid () IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT COALESCE(pr.is_private, false) INTO priv
  FROM public.profiles pr
  WHERE pr.user_id = p_profile_user_id;

  IF NOT FOUND THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  IF priv
     AND p_profile_user_id <> auth.uid ()
     AND NOT EXISTS (
       SELECT 1
       FROM public.follows f
       WHERE f.follower_id = auth.uid ()
         AND f.following_id = p_profile_user_id
     )
  THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  RETURN ARRAY(
    SELECT f.follower_id
    FROM public.follows f
    WHERE f.following_id = p_profile_user_id
    ORDER BY f.created_at DESC NULLS LAST
  );
END;
$$;

REVOKE ALL ON FUNCTION public.profile_follower_ids (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_follower_ids (uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.profile_following_ids (p_profile_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  priv boolean;
BEGIN
  IF auth.uid () IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT COALESCE(pr.is_private, false) INTO priv
  FROM public.profiles pr
  WHERE pr.user_id = p_profile_user_id;

  IF NOT FOUND THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  IF priv
     AND p_profile_user_id <> auth.uid ()
     AND NOT EXISTS (
       SELECT 1
       FROM public.follows f
       WHERE f.follower_id = auth.uid ()
         AND f.following_id = p_profile_user_id
     )
  THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  RETURN ARRAY(
    SELECT f.following_id
    FROM public.follows f
    WHERE f.follower_id = p_profile_user_id
    ORDER BY f.created_at DESC NULLS LAST
  );
END;
$$;

REVOKE ALL ON FUNCTION public.profile_following_ids (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_following_ids (uuid) TO authenticated, service_role;

-- ----- Home feed (Instagram-style; same as manual_apply_feed_posts_rpc.sql) -----
CREATE OR REPLACE FUNCTION public.feed_posts_page (p_limit int, p_offset int)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT p.*
  FROM public.posts p
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE auth.uid () IS NOT NULL
    AND NOT COALESCE(p.archived, false)
    AND (
      p.user_id = auth.uid ()
      OR NOT COALESCE(pr.is_private, false)
      OR EXISTS (
        SELECT 1
        FROM public.follows f
        WHERE f.follower_id = auth.uid ()
          AND f.following_id = p.user_id
      )
    )
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 100))
  OFFSET greatest(0, coalesce(p_offset, 0));
$$;

REVOKE ALL ON FUNCTION public.feed_posts_page (int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_posts_page (int, int) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
