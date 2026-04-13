import { cn } from "@/lib/utils";
import {
  PROFILE_MOODS,
  isMoodUpdatedTodayLocal,
  moodAccentClass,
  moodLabelForEmoji,
} from "@/lib/moodDisplay";

type Props = {
  mood: string | null | undefined;
  moodUpdatedAt: string | null | undefined;
  /** Self profile: show picker row */
  interactive?: boolean;
  selectedMood?: string;
  onSelectMood?: (emoji: string) => void;
};

const TodayMoodSection = ({
  mood,
  moodUpdatedAt,
  interactive = false,
  selectedMood = "",
  onSelectMood,
}: Props) => {
  const fresh = isMoodUpdatedTodayLocal(moodUpdatedAt);
  const label = moodLabelForEmoji(mood);
  const accent = moodAccentClass(mood);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg",
        accent
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 text-center">
        Today&apos;s Mood
      </p>

      {fresh && mood ? (
        <div className="flex flex-col items-center gap-1 py-1">
          <span className="text-4xl leading-none" aria-hidden>
            {mood}
          </span>
          <span className="text-sm font-semibold text-foreground">{label ?? "Custom"}</span>
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-2">No mood updated today</p>
      )}

      {interactive && onSelectMood ? (
        <>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-4 mb-2 text-center">
            Set your mood
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 p-2 [scrollbar-width:thin]">
            {PROFILE_MOODS.map((m) => (
              <button
                key={m.emoji}
                type="button"
                onClick={() => onSelectMood(m.emoji)}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 rounded-2xl px-3 py-2 min-w-[4.25rem] transition-all",
                  "border border-transparent active:scale-95",
                  selectedMood === m.emoji
                    ? "bg-primary/15 ring-2 ring-primary shadow-sm scale-[1.02]"
                    : "bg-muted/40 hover:bg-muted/70"
                )}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] text-muted-foreground font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default TodayMoodSection;
