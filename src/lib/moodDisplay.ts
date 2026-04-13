export const PROFILE_MOODS = [
  { emoji: "\u{1F60A}", label: "Happy", accent: "border-amber-400/50 bg-amber-500/10" },
  { emoji: "\u{1F60E}", label: "Confident", accent: "border-violet-400/50 bg-violet-500/10" },
  { emoji: "\u{1F525}", label: "Fired Up", accent: "border-orange-400/50 bg-orange-500/10" },
  { emoji: "\u{1F634}", label: "Tired", accent: "border-slate-400/50 bg-slate-500/10" },
  { emoji: "\u{1F624}", label: "Frustrated", accent: "border-red-400/50 bg-red-500/10" },
  { emoji: "\u{1F9D8}", label: "Calm", accent: "border-emerald-400/50 bg-emerald-500/10" },
  { emoji: "\u{1F914}", label: "Thinking", accent: "border-cyan-400/50 bg-cyan-500/10" },
  { emoji: "\u{1F622}", label: "Sad", accent: "border-blue-400/50 bg-blue-500/10" },
  { emoji: "\u{1F4AA}", label: "Motivated", accent: "border-yellow-400/50 bg-yellow-500/15" },
] as const;

/** Task completion default when no mood was set yet today. */
export const MOOD_ON_TASK_COMPLETE = "\u{1F4AA}";

export function isMoodUpdatedTodayLocal(moodUpdatedAt: string | null | undefined): boolean {
  if (!moodUpdatedAt) return false;
  const t = new Date(moodUpdatedAt);
  if (Number.isNaN(t.getTime())) return false;
  const now = new Date();
  return (
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate()
  );
}

export function moodAccentClass(emoji: string | null | undefined): string {
  const row = PROFILE_MOODS.find((m) => m.emoji === emoji);
  return row?.accent ?? "border-border/60 bg-muted/30";
}

export function moodLabelForEmoji(emoji: string | null | undefined): string | null {
  if (!emoji) return null;
  return PROFILE_MOODS.find((m) => m.emoji === emoji)?.label ?? null;
}
