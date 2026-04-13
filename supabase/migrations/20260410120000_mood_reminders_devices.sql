-- Today's mood timestamp; server-side task reminder dedupe; optional FCM device tokens.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mood_updated_at TIMESTAMPTZ;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS reminder_push_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_reminder_due_idx ON public.tasks (remind_at, reminder_push_sent_at)
WHERE
  remind_at IS NOT NULL
  AND completed = FALSE;

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web_fcm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  CONSTRAINT user_devices_user_token UNIQUE (user_id, device_token)
);

CREATE INDEX IF NOT EXISTS user_devices_user_idx ON public.user_devices (user_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_devices_own_select" ON public.user_devices;

DROP POLICY IF EXISTS "user_devices_own_insert" ON public.user_devices;

DROP POLICY IF EXISTS "user_devices_own_update" ON public.user_devices;

DROP POLICY IF EXISTS "user_devices_own_delete" ON public.user_devices;

CREATE POLICY "user_devices_own_select" ON public.user_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid ());

CREATE POLICY "user_devices_own_insert" ON public.user_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "user_devices_own_update" ON public.user_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

CREATE POLICY "user_devices_own_delete" ON public.user_devices FOR DELETE TO authenticated
  USING (user_id = auth.uid ());

NOTIFY pgrst,
'reload schema';
