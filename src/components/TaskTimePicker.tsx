import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** Stored as 24h HH:MM (e.g. "18:05") */
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

function to12h(hhmm: string): { hour12: number; minute: string; ampm: "AM" | "PM" } {
  const [hhRaw, mmRaw] = hhmm.split(":");
  const hh = Number(hhRaw);
  const minute = (mmRaw || "00").padStart(2, "0");
  const ampm: "AM" | "PM" = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  return { hour12, minute, ampm };
}

function to24h(hour12: number, minute: string, ampm: "AM" | "PM"): string {
  const m = minute.padStart(2, "0");
  let hh = hour12 % 12;
  if (ampm === "PM") hh += 12;
  return `${String(hh).padStart(2, "0")}:${m}`;
}

/** 12-hour (AM/PM) picker that stores a 24h HH:MM string for IST scheduling. */
const TaskTimePicker = ({ value, onChange, className }: Props) => {
  const parsed = value && value.includes(":") ? to12h(value) : { hour12: 9, minute: "00", ampm: "AM" as const };
  const hour12 = parsed.hour12;
  const minute = parsed.minute;
  const ampm = parsed.ampm;

  return (
    <div className={cn("rounded-2xl bg-card shadow-sm p-3", className)}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs font-semibold text-muted-foreground">Time (IST)</p>
        <span className="ml-auto text-[10px] text-muted-foreground">Asia/Kolkata</span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_1fr_1fr] gap-2">
        <select
          value={String(hour12)}
          onChange={(e) => onChange(to24h(Number(e.target.value), minute, ampm))}
          className="h-10 rounded-xl bg-background border border-border px-3 text-sm"
          aria-label="Hour"
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const h = i + 1;
            return (
              <option key={h} value={String(h)}>
                {h}
              </option>
            );
          })}
        </select>

        <select
          value={minute}
          onChange={(e) => onChange(to24h(hour12, e.target.value, ampm))}
          className="h-10 rounded-xl bg-background border border-border px-3 text-sm"
          aria-label="Minute"
        >
          {Array.from({ length: 60 }).map((_, i) => {
            const m = String(i).padStart(2, "0");
            return (
              <option key={m} value={m}>
                {m}
              </option>
            );
          })}
        </select>

        <select
          value={ampm}
          onChange={(e) => onChange(to24h(hour12, minute, e.target.value as "AM" | "PM"))}
          className="h-10 rounded-xl bg-background border border-border px-3 text-sm"
          aria-label="AM/PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};

export default TaskTimePicker;

