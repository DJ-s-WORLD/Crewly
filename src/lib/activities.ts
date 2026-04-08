import { supabase } from "@/integrations/supabase/client";

function startOfLocalDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Replace today's task_completed activity with an updated rollup message (one card per day). */
export async function recordTaskCompletionActivity(userId: string, displayName: string): Promise<void> {
  const dayStart = startOfLocalDayIso();
  const { count } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("completed_at", dayStart);

  const n = count ?? 1;
  const name = displayName.trim() || "Someone";
  const message =
    n <= 1 ? `${name} crushed a task today 🔥` : `${name} completed ${n} tasks today 🔥`;

  await supabase.from("activities").delete().eq("user_id", userId).eq("type", "task_completed").gte("created_at", dayStart);

  await supabase.from("activities").insert({
    user_id: userId,
    type: "task_completed",
    message,
  });

  await supabase.rpc("notify_followers_task_completion", { p_message: message });
}

export async function recordStreakMilestoneActivity(userId: string, displayName: string, streak: number): Promise<void> {
  if (streak < 7 || streak % 7 !== 0) return;
  const name = displayName.trim() || "Someone";
  await supabase.from("activities").insert({
    user_id: userId,
    type: "streak_update",
    message: `${name} reached a ${streak}-day streak 🔥`,
  });
}
