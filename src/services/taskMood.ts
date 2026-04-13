import { supabase } from "@/integrations/supabase/client";
import { MOOD_ON_TASK_COMPLETE, isMoodUpdatedTodayLocal } from "@/lib/moodDisplay";

/** If the user has not set a mood today, set a motivated default after completing a task. */
export async function maybeSetMotivatedMoodOnTaskComplete(userId: string): Promise<void> {
  const { data: p } = await supabase
    .from("profiles")
    .select("mood_updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!p) return;
  if (isMoodUpdatedTodayLocal(p.mood_updated_at)) return;

  await supabase
    .from("profiles")
    .update({
      mood: MOOD_ON_TASK_COMPLETE,
      mood_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
