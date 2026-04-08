import { useRef } from "react";
import html2canvas from "html2canvas";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  avatarUrl: string;
  postsCount: number;
  followers: number;
  following: number;
  mood?: string;
  moodLabel?: string;
  streak?: number;
  totalCompleted?: number;
  onClose: () => void;
};

const ShareProfileCard = ({
  name,
  avatarUrl,
  postsCount,
  followers,
  following,
  mood,
  moodLabel,
  streak,
  totalCompleted,
  onClose,
}: Props) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `lifepilot-${name || "profile"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Saved to downloads");
    } catch {
      toast.error("Could not create image");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:rounded-3xl rounded-t-3xl bg-background border border-border shadow-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:bg-muted z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          ref={cardRef}
          className={cn(
            "rounded-2xl p-6 text-center overflow-hidden",
            "bg-gradient-to-br from-primary/25 via-background to-accent/20 border border-primary/10"
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/90">LifePilot</p>
          <div className="mt-4 flex justify-center">
            <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
              <AvatarImage src={avatarUrl || undefined} className="object-cover" />
              <AvatarFallback className="bg-primary text-2xl text-primary-foreground font-bold">
                {name ? name[0].toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground tracking-tight">{name || "Pilot"}</h2>
          {mood && moodLabel && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-2xl mr-1">{mood}</span> {moodLabel}
            </p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-card/90 border border-border/50 py-3 px-1 shadow-sm">
              <p className="text-lg font-bold tabular-nums text-foreground">{postsCount}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Posts</p>
            </div>
            <div className="rounded-xl bg-card/90 border border-border/50 py-3 px-1 shadow-sm">
              <p className="text-lg font-bold tabular-nums text-foreground">{followers}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Followers</p>
            </div>
            <div className="rounded-xl bg-card/90 border border-border/50 py-3 px-1 shadow-sm">
              <p className="text-lg font-bold tabular-nums text-foreground">{following}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Following</p>
            </div>
          </div>

          {(streak !== undefined || totalCompleted !== undefined) && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-card/80 py-2.5 px-2 border border-border/40">
                <p className="text-xl font-bold text-foreground">{streak ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Day streak</p>
              </div>
              <div className="rounded-xl bg-card/80 py-2.5 px-2 border border-border/40">
                <p className="text-xl font-bold text-foreground">{totalCompleted ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Tasks done</p>
              </div>
            </div>
          )}
        </div>

        <Button className="mt-4 w-full gap-2 rounded-2xl h-11 font-semibold" onClick={() => void download()}>
          <Download className="h-4 w-4" />
          Download card
        </Button>
      </div>
    </div>
  );
};

export default ShareProfileCard;
