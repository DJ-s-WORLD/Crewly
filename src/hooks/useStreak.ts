import { recordStreakMilestoneActivity } from "@/lib/activities";
import { supabase } from "@/integrations/supabase/client";

export const updateStreak = async (userId: string) => {
  const today = new Date().toISOString().split("T")[0];

  const { data: profile } = await supabase
    .from("profiles")
    .select("streak, last_active_date, name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return 0;

  const lastActive = profile.last_active_date;
  let newStreak = profile.streak;

  if (lastActive === today) {
    return newStreak;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (lastActive === yesterdayStr) {
    newStreak += 1;
  } else {
    newStreak = 1;
  }

  await supabase
    .from("profiles")
    .update({ streak: newStreak, last_active_date: today })
    .eq("user_id", userId);

  void recordStreakMilestoneActivity(userId, profile.name ?? "", newStreak);

  return newStreak;
};
