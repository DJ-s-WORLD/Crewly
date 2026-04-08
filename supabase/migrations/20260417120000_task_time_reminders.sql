-- Task time + reminder (IST)
-- Stores a task's scheduled time-of-day and the computed reminder timestamp.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_hhmm TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tasks_user_remind_at ON public.tasks (user_id, remind_at)
  WHERE remind_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';

