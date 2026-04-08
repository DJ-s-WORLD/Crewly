-- Web Push subscription storage (optional; server still needs to send pushes via web-push / FCM).
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  CONSTRAINT web_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx ON public.web_push_subscriptions (user_id);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_push_own_select" ON public.web_push_subscriptions;

DROP POLICY IF EXISTS "web_push_own_insert" ON public.web_push_subscriptions;

DROP POLICY IF EXISTS "web_push_own_update" ON public.web_push_subscriptions;

DROP POLICY IF EXISTS "web_push_own_delete" ON public.web_push_subscriptions;

CREATE POLICY "web_push_own_select" ON public.web_push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid ());

CREATE POLICY "web_push_own_insert" ON public.web_push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "web_push_own_update" ON public.web_push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "web_push_own_delete" ON public.web_push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

NOTIFY pgrst, 'reload schema';
