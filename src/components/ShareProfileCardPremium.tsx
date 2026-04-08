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
  onClose: () => void;
};

const ShareProfileCardPremium = ({ name, avatarUrl, postsCount, followers, following, onClose }: Props) => {
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
      link.download = `lifepilot-${(name || "profile").toLowerCase().replace(/\s+/g, "-")}.png`;
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
            "relative overflow-hidden rounded-3xl p-6 text-center",
            "border border-white/10 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.6)]"
          )}
          style={{
            background:
              "radial-gradient(1200px 400px at 10% 0%, rgba(99,102,241,0.45), transparent 55%), radial-gradient(900px 480px at 95% 10%, rgba(236,72,153,0.35), transparent 60%), linear-gradient(135deg, rgba(17,24,39,0.92), rgba(2,6,23,0.95))",
          }}
        >
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:14px_14px]" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/80">LifePilot</p>

            <div className="mt-4 flex justify-center">
              <div className="rounded-full p-1.5 bg-white/10 shadow-lg">
                <Avatar className="h-20 w-20 ring-2 ring-white/20">
                  <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                  <AvatarFallback className="bg-white/10 text-2xl text-white font-extrabold">
                    {name ? name[0].toUpperCase() : "?"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white truncate">{name || "Pilot"}</h2>
            <p className="mt-1 text-xs text-white/70">Building consistency every day</p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                { label: "Posts", value: postsCount },
                { label: "Followers", value: followers },
                { label: "Following", value: following },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl bg-white/10 border border-white/10 py-3 px-2">
                  <p className="text-xl font-extrabold tabular-nums text-white leading-none">{s.value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-left">
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Share my profile</p>
              <p className="text-sm text-white/90 leading-snug mt-1">
                Join me on LifePilot — daily wins, tasks, and streaks.
              </p>
            </div>
          </div>
        </div>

        <Button className="mt-4 w-full gap-2 rounded-2xl h-11 font-semibold" onClick={() => void download()}>
          <Download className="h-4 w-4" />
          Download card
        </Button>
      </div>
    </div>
  );
};

export default ShareProfileCardPremium;

