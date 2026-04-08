import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import SearchBarInline from "@/components/SearchBarInline";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type MainHeaderProps = {
  title?: string;
  avatarUrl?: string;
  avatarFallback?: string;
  showSearch?: boolean;
  rightExtra?: ReactNode;
};

const MainHeader = ({ title, avatarUrl, avatarFallback, showSearch = true, rightExtra }: MainHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="mx-auto max-w-lg flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate("/")}
            className={cn("flex items-center")}
            aria-label="Crewly home"
          >
            <img src="/logo.png" alt="Crewly" className="h-8 w-17 mr-1" />
            <div className="min-w-0 text-left">
              <p className="text-sm"></p>
              {title ? (
                <p className="text-[11px] text-muted-foreground leading-none mt-1 truncate">{title}</p>
              ) : null}
            </div>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {rightExtra}
          {showSearch && <SearchBarInline />}
          <NotificationBell />
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="rounded-full p-0.5 ring-offset-background transition hover:ring-2 hover:ring-primary/30"
            aria-label="Profile"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                {avatarFallback?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
          </button>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
