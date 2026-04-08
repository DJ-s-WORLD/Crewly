-- Crewly: UID + privacy + deleted user blocklist

-- Profiles: 5-digit UID + privacy
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS uid INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_uid_unique ON public.profiles (uid)
  WHERE uid IS NOT NULL;

-- Generate unique 5-digit uid for new profiles
CREATE OR REPLACE FUNCTION public.generate_unique_profile_uid ()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate INTEGER;
  tries INTEGER := 0;
BEGIN
  LOOP
    candidate := (10000 + floor(random() * 90000))::int;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE uid = candidate);
    tries := tries + 1;
    IF tries > 25 THEN
      RAISE EXCEPTION 'could not allocate unique uid';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Ensure uid is set on insert
CREATE OR REPLACE FUNCTION public.profiles_set_uid ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.uid IS NULL THEN
    NEW.uid := public.generate_unique_profile_uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_set_uid ON public.profiles;
CREATE TRIGGER tr_profiles_set_uid
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_set_uid();

-- Email blocklist for 3 months after deletion
CREATE TABLE IF NOT EXISTS public.deleted_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;

-- Nobody can read list directly (avoid leaking emails)
DROP POLICY IF EXISTS "deleted_users_no_select" ON public.deleted_users;
CREATE POLICY "deleted_users_no_select" ON public.deleted_users FOR SELECT TO authenticated
  USING (false);

DROP POLICY IF EXISTS "deleted_users_no_insert" ON public.deleted_users;
CREATE POLICY "deleted_users_no_insert" ON public.deleted_users FOR INSERT TO authenticated
  WITH CHECK (false);

-- RPC: can this email register?
CREATE OR REPLACE FUNCTION public.can_register_email (p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_deleted_at TIMESTAMPTZ;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN FALSE;
  END IF;
  SELECT deleted_at INTO row_deleted_at FROM public.deleted_users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF row_deleted_at IS NULL THEN
    RETURN TRUE;
  END IF;
  RETURN row_deleted_at < (now() - interval '3 months');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_register_email (TEXT) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.can_register_email (TEXT) FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

