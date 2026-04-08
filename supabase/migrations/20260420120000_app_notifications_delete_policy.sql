-- Allow users to delete their own notifications

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_notif_delete" ON public.app_notifications;

CREATE POLICY "app_notif_delete" ON public.app_notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

