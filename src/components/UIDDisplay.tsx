import { Copy } from "lucide-react";
import { toast } from "sonner";

const UIDDisplay = ({ uid }: { uid: number | null | undefined }) => {
  if (!uid) return null;
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-muted-foreground">
        UID <span className="font-semibold text-foreground tabular-nums">{uid}</span>
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(String(uid));
            toast.success("UID copied");
          } catch {
            toast.error("Could not copy");
          }
        }}
        className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        aria-label="Copy UID"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default UIDDisplay;

