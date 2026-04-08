-- Crewly: Instagram-style follow requests for private accounts

CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS follow_requests_receiver_status ON public.follow_requests (receiver_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS follow_requests_sender_status ON public.follow_requests (sender_id, status, created_at DESC);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_requests_select_own" ON public.follow_requests;
CREATE POLICY "follow_requests_select_own" ON public.follow_requests FOR SELECT TO authenticated
  USING (sender_id = auth.uid () OR receiver_id = auth.uid ());

DROP POLICY IF EXISTS "follow_requests_insert_sender" ON public.follow_requests;
CREATE POLICY "follow_requests_insert_sender" ON public.follow_requests FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid ());

DROP POLICY IF EXISTS "follow_requests_update_receiver" ON public.follow_requests;
CREATE POLICY "follow_requests_update_receiver" ON public.follow_requests FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid ())
  WITH CHECK (receiver_id = auth.uid ());

DROP POLICY IF EXISTS "follow_requests_delete_own" ON public.follow_requests;
CREATE POLICY "follow_requests_delete_own" ON public.follow_requests FOR DELETE TO authenticated
  USING (sender_id = auth.uid () OR receiver_id = auth.uid ());

-- RPC: send follow request (idempotent)
CREATE OR REPLACE FUNCTION public.send_follow_request (p_receiver UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid ();
  rid UUID;
BEGIN
  IF me IS NULL OR p_receiver IS NULL OR p_receiver = me THEN
    RAISE EXCEPTION 'invalid request';
  END IF;

  INSERT INTO public.follow_requests (sender_id, receiver_id, status)
  VALUES (me, p_receiver, 'pending')
  ON CONFLICT (sender_id, receiver_id)
  DO UPDATE SET status = 'pending', updated_at = now()
  RETURNING id INTO rid;

  RETURN rid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_follow_request (UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.send_follow_request (UUID) FROM PUBLIC;

-- RPC: accept follow request (atomic: accept + create follow)
CREATE OR REPLACE FUNCTION public.accept_follow_request (p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid ();
  s UUID;
  r UUID;
BEGIN
  IF me IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid request';
  END IF;

  SELECT sender_id, receiver_id INTO s, r
  FROM public.follow_requests
  WHERE id = p_request_id AND status = 'pending'
  LIMIT 1;

  IF r IS NULL OR r <> me THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.follow_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (s, r)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_follow_request (UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_follow_request (UUID) FROM PUBLIC;

-- RPC: reject follow request
CREATE OR REPLACE FUNCTION public.reject_follow_request (p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid ();
BEGIN
  IF me IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'invalid request';
  END IF;

  UPDATE public.follow_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = p_request_id
    AND receiver_id = me
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_follow_request (UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_follow_request (UUID) FROM PUBLIC;

-- Notify on request + accepted/rejected
CREATE OR REPLACE FUNCTION public.notify_follow_request ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sname TEXT;
  rname TEXT;
BEGIN
  SELECT COALESCE(name, 'Someone') INTO sname FROM public.profiles WHERE user_id = NEW.sender_id LIMIT 1;
  SELECT COALESCE(name, 'Someone') INTO rname FROM public.profiles WHERE user_id = NEW.receiver_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
    VALUES (
      NEW.receiver_id,
      'follow_request',
      'Follow request',
      sname || ' sent you a follow request',
      NEW.sender_id,
      NEW.id,
      jsonb_build_object('request_id', NEW.id::text, 'sender_id', NEW.sender_id::text)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
    VALUES (
      NEW.sender_id,
      'follow_request_accepted',
      'Request accepted',
      rname || ' accepted your follow request',
      NEW.receiver_id,
      NEW.id,
      jsonb_build_object('request_id', NEW.id::text, 'receiver_id', NEW.receiver_id::text)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected' THEN
    INSERT INTO public.app_notifications (user_id, type, title, body, sender_id, reference_id, data)
    VALUES (
      NEW.sender_id,
      'follow_request_rejected',
      'Request declined',
      rname || ' declined your follow request',
      NEW.receiver_id,
      NEW.id,
      jsonb_build_object('request_id', NEW.id::text, 'receiver_id', NEW.receiver_id::text)
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_notify_follow_request ON public.follow_requests;
CREATE TRIGGER tr_notify_follow_request
AFTER INSERT OR UPDATE ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_follow_request ();

NOTIFY pgrst, 'reload schema';

