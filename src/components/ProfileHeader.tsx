import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import SearchBarInline from "@/components/SearchBarInline";

type Props = {
  username: string;
  onOpenSettings: () => void;
  className?: string;
};

const ProfileHeader = ({ username, onOpenSettings, className }: Props) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl px-4 py-3 pt-[max(0.5rem,env(safe-area-inset-top))]",
        className
      )}
    >
      <div className="mx-auto max-w-lg flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight text-foreground truncate min-w-0">{username || "Profile"}</h1>
        <div className="flex items-center gap-0.5 shrink-0">
          <SearchBarInline />
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/70 active:scale-95"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProfileHeader;
