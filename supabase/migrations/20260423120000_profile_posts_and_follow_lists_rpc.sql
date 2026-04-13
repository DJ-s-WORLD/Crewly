-- Profile grid + follower/following lists: SECURITY DEFINER RPCs with explicit Instagram rules
-- (public = any signed-in viewer; private = owner or accepted followers only).
-- Avoids brittle RLS on direct SELECT from posts/follows for other users' profiles.

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

NOTIFY pgrst, 'reload schema';
