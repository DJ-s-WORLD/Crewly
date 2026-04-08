-- Run in Supabase Dashboard → SQL Editor if Tasks add fails with:
-- "Could not find the 'remind_at' column of 'tasks' in the schema cache" (PGRST204).
-- Safe to run multiple times.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_hhmm TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_user_remind_at ON public.tasks (user_id, remind_at)
  WHERE remind_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

