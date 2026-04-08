import { useRef } from "react";
import html2canvas from "html2canvas";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface SharePosterProps {
  name: string;
  avatarUrl: string;
  mood: string;
  moodLabel: string;
  streak: number;
  totalCompleted: number;
  onClose: () => void;
}

const SharePoster = ({
  name,
  avatarUrl,
  mood,
  moodLabel,
  streak,
  totalCompleted,
  onClose,
}: SharePosterProps) => {
  const posterRef = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!posterRef.current) return;
    try {
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `lifepilot-${name || "stats"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Saved to downloads");
    } catch {
      toast.error("Could not create image");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-background p-4 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          ref={posterRef}
          className="rounded-xl bg-gradient-to-br from-primary/20 via-background to-accent/30 p-6 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">LifePilot</p>
          <div className="mt-4 flex justify-center">
            <Avatar className="h-16 w-16 border-2 border-primary/30">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {name ? name[0].toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">{name || "Pilot"}</h2>
          {mood && (
            <p className="mt-1 text-3xl">
              {mood} <span className="text-sm font-medium text-muted-foreground">{moodLabel}</span>
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg bg-card/80 p-3 shadow-sm">
              <p className="text-2xl font-bold text-foreground">{streak}</p>
              <p className="text-xs text-muted-foreground">Day streak</p>
            </div>
            <div className="rounded-lg bg-card/80 p-3 shadow-sm">
              <p className="text-2xl font-bold text-foreground">{totalCompleted}</p>
              <p className="text-xs text-muted-foreground">Tasks done</p>
            </div>
          </div>
        </div>

        <Button className="mt-4 w-full gap-2 rounded-xl" onClick={download}>
          <Download className="h-4 w-4" />
          Download poster
        </Button>
      </div>
    </div>
  );
};

export default SharePoster;
