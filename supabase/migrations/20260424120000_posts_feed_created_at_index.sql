-- Speed up global feed ordering (newest first). Safe if index already exists.
CREATE INDEX IF NOT EXISTS posts_created_at_desc_idx ON public.posts (created_at DESC);

NOTIFY pgrst, 'reload schema';
