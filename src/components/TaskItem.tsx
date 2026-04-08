import { useMemo, useState } from "react";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  id: string;
  title: string;
  completed: boolean;
  timeHHMM?: string | null;
  onToggle: (id: string, completed: boolean) => void;
}

function format12h(timeHHMM: string) {
  const [hhRaw, mmRaw] = timeHHMM.split(":");
  const hh = Number(hhRaw);
  const mm = (mmRaw || "00").padStart(2, "0");
  if (!Number.isFinite(hh)) return timeHHMM;
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = ((hh + 11) % 12) + 1;
  return `${hour12}:${mm} ${ampm}`;
}

const TaskItem = ({ id, title, completed, timeHHMM, onToggle }: TaskItemProps) => {
  const [animating, setAnimating] = useState(false);
  const timeLabel = useMemo(() => (timeHHMM ? format12h(timeHHMM) : ""), [timeHHMM]);

  const handleToggle = () => {
    setAnimating(true);
    onToggle(id, !completed);
    window.setTimeout(() => setAnimating(false), 300);
  };

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md",
        completed && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
          completed ? "border-primary bg-primary" : "border-muted-foreground/30 hover:border-primary",
          animating && "animate-check"
        )}
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
      >
        {completed && <Check className="h-4 w-4 text-primary-foreground" />}
      </button>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm font-medium transition-all duration-300 block truncate",
            completed && "line-through text-muted-foreground"
          )}
        >
          {title}
        </span>
        {timeLabel ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {timeLabel} <span className="opacity-70">(IST)</span>
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default TaskItem;
