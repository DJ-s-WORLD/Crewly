-- Run in Supabase SQL Editor: Instagram-style feed RPC (same as migration 20260425120000_feed_posts_page_rpc.sql).

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
