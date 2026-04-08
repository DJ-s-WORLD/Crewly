import { memo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  onOpen: () => void;
  onDelete: () => Promise<void>;
};

const NotificationItem = ({ title, body, createdAt, read, onOpen, onDelete }: Props) => {
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const doDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    setRemoving(true);
    // Allow the slide/fade animation to play a bit before DB round-trip.
    window.setTimeout(() => {
      void onDelete().finally(() => setDeleting(false));
    }, 160);
  };

  return (
    <div
      className={cn(
        "group relative",
        "transition-all duration-200",
        removing && "opacity-0 -translate-x-2 pointer-events-none"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50",
          !read && "bg-primary/5"
        )}
        onClick={onOpen}
      >
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground block">{title}</span>
          <span className="text-xs text-muted-foreground line-clamp-3 mt-0.5 block">{body}</span>
          <span className="text-[10px] text-muted-foreground/80 pt-1 block">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
          </span>
        </div>

        <button
          type="button"
          onClick={doDelete}
          disabled={deleting}
          aria-label="Delete notification"
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </button>
    </div>
  );
};

export default memo(NotificationItem);

