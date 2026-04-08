import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { updateStreak } from "@/hooks/useStreak";
import { useNavigate, Link } from "react-router-dom";
import MainHeader from "@/components/MainHeader";
import { Flame, CheckCircle2, CalendarDays, Target, ArrowRight, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getActivityFeed, type FeedItem } from "@/services/social";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [profileRes, todayTasksRes, completedRes, feedRes] = await Promise.all([
      supabase.from("profiles").select("name, streak, last_active_date, avatar_url, mood").eq("user_id", user.id).maybeSingle(),
      supabase.from("tasks").select("id, title, completed").eq("user_id", user.id).gte("created_at", today + "T00:00:00").order("created_at", { ascending: false }).limit(5),
      supabase.from("tasks").select("id", { count: "exact" }).eq("user_id", user.id).eq("completed", true),
      getActivityFeed(25),
    ]);

    if (profileRes.data) {
      setProfileName(profileRes.data.name || user.user_metadata?.name || "");
      setStreak(profileRes.data.streak || 0);
      setAvatarUrl(profileRes.data.avatar_url || "");
      setMood(profileRes.data.mood || "");
    }
    if (todayTasksRes.data) setTodayTasks(todayTasksRes.data);
    setTotalCompleted(completedRes.count || 0);
    setFeed(feedRes.data);

    const newStreak = await updateStreak(user.id);
    setStreak(newStreak);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendingToday = todayTasks.filter((t) => !t.completed).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader avatarUrl={avatarUrl} avatarFallback={profileName || "U"} />

      <div className="mx-auto max-w-lg px-4 py-2 flex items-center justify-between border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          {mood && <span className="text-xl shrink-0">{mood}</span>}
          <span className="text-xs text-muted-foreground font-medium truncate">
            {mood ? "Today's mood" : "Set mood in Profile"}
          </span>
        </div>
        <Link
          to="/feed"
          className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold text-primary shadow-sm border border-border/50"
        >
          <Users className="h-3 w-3" />
          Feed
        </Link>
      </div>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-5">
        <div className="animate-slide-up">
          <h2 className="text-2xl font-bold text-foreground">
            {getGreeting()}, {profileName || "there"} 👋
          </h2>
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{todayStr}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 shadow-sm border border-border/50 animate-slide-up" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Crew feed</h3>
            <Link to="/feed" className="text-[10px] font-semibold text-primary uppercase tracking-wide hover:underline">
              Social feed
            </Link>
          </div>
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Follow teammates to see their wins here.
            </p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {feed.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl bg-background/80 p-3 border border-border/40 shadow-sm"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={item.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/15 text-primary font-bold">
                      {(item.profile?.name || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">{item.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {item.profile?.name || "Member"} · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm border border-border/40">
            <Flame className="h-6 w-6 text-streak" />
            <p className="text-2xl font-bold text-foreground">{streak}</p>
            <p className="text-[10px] text-muted-foreground">Streak 🔥</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm border border-border/40">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <p className="text-2xl font-bold text-foreground">{totalCompleted}</p>
            <p className="text-[10px] text-muted-foreground">Total Done</p>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm border border-border/40">
            <Target className="h-6 w-6 text-primary" />
            <p className="text-2xl font-bold text-foreground">{pendingToday}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today&apos;s Focus</h3>
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {todayTasks.length === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center shadow-sm border border-border/40">
              <p className="text-muted-foreground text-sm">No tasks today. Head to Tasks to add some!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm border border-border/40"
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${task.completed ? "bg-success" : "bg-primary/40"}`} />
                  <span className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "150ms" }}>
          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="flex flex-col items-start gap-2 rounded-2xl bg-primary p-4 text-left shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
            <span className="text-sm font-semibold text-primary-foreground">Add Tasks</span>
            <span className="text-[10px] text-primary-foreground/70">Manage your to-dos</span>
          </button>
          <div
            className="flex flex-col items-start gap-2 rounded-2xl bg-muted/60 p-4 text-left shadow-sm border border-border/40 opacity-90 cursor-not-allowed pointer-events-none select-none"
            aria-disabled="true"
          >
            <span className="text-lg" aria-hidden>
              ✨
            </span>
            <span className="text-sm font-semibold text-muted-foreground">Coming Soon…</span>
            <span className="text-[10px] text-muted-foreground">AI assistant</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
