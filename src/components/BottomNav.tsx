import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, ListTodo, User, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreatePostUI } from "@/context/CreatePostUIContext";

const leftTabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/feed", icon: LayoutGrid, label: "Feed" },
];

const rightTabs = [
  { path: "/tasks", icon: ListTodo, label: "Tasks" },
  { path: "/messages", icon: MessageCircle, label: "Messages", prefix: true },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePostUI();

  const hide =
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    /^\/messages\/.+/.test(location.pathname);

  if (hide) return null;

  const isActive = (path: string, prefix?: boolean) =>
    prefix ? location.pathname === path || location.pathname.startsWith(`${path}/`) : location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] backdrop-blur-lg">
      <div className="relative mx-auto max-w-lg">
        <div className="flex items-end justify-between px-1 pt-1">
          <div className="flex flex-1 justify-around min-w-0">
            {leftTabs.map(({ path, icon: Icon, label }) => {
              const active = isActive(path);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all duration-200 min-w-0",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-transform shrink-0", active && "scale-110")} />
                  <span className="text-[9px] font-medium truncate max-w-[3.5rem]">{label}</span>
                  {active ? <span className="h-1 w-1 rounded-full bg-primary" /> : <span className="h-1 w-1" />}
                </button>
              );
            })}
          </div>

          <div className="w-16 shrink-0 flex justify-center pb-1" aria-hidden />

          <div className="flex flex-1 justify-around min-w-0">
            {rightTabs.map(({ path, icon: Icon, label, prefix }) => {
              const active = isActive(path, prefix);
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all duration-200 min-w-0",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 transition-transform shrink-0", active && "scale-110")} />
                  <span className="text-[9px] font-medium truncate max-w-[3.25rem]">{label}</span>
                  {active ? <span className="h-1 w-1 rounded-full bg-primary" /> : <span className="h-1 w-1" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openCreatePost()}
          className={cn(
            "absolute left-1/2 bottom-[calc(0.55rem+env(safe-area-inset-bottom))] -translate-x-1/2 -translate-y-1/2",
            "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25",
            "ring-4 ring-background border border-primary/20",
            "transition-transform active:scale-95 hover:brightness-110"
          )}
          aria-label="Create post"
        >
          <Plus className="h-7 w-7 stroke-[2.5]" />
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
