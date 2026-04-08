import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import TaskItem from "@/components/TaskItem";
import AddTaskInput from "@/components/AddTaskInput";
import MainHeader from "@/components/MainHeader";
import { updateStreak } from "@/hooks/useStreak";
import { recordTaskCompletionActivity } from "@/lib/activities";
import { ListTodo, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
  time_hhmm?: string | null;
  timezone?: string;
  scheduled_at?: string | null;
  remind_at?: string | null;
}

type Filter = "all" | "completed" | "pending";

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileName, setProfileName] = useState("");

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data }, prof] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("avatar_url, name").eq("user_id", user.id).maybeSingle(),
    ]);
    if (data) setTasks(data as Task[]);
    if (prof.data) {
      setAvatarUrl(prof.data.avatar_url ?? "");
      setProfileName(prof.data.name || "");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddTask = async (title: string, timeHHMM: string | null) => {
    if (!user) return;
    const timezone = "Asia/Kolkata";
    const now = new Date();

    // If time is provided, schedule today in IST and set remind_at = 2 minutes before.
    let scheduledAt: string | null = null;
    let remindAt: string | null = null;
    let time_hhmm: string | null = null;
    if (timeHHMM) {
      time_hhmm = timeHHMM;
      const [hh, mm] = timeHHMM.split(":").map((x) => Number(x));
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        // Build a Date that represents "today at HH:MM IST" converted to UTC.
        // We do this by taking today's date in IST, then applying the HH:MM, then converting.
        const istTodayParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .formatToParts(now)
          .reduce<Record<string, string>>((acc, p) => {
            if (p.type !== "literal") acc[p.type] = p.value;
            return acc;
          }, {});
        const y = Number(istTodayParts.year);
        const m = Number(istTodayParts.month);
        const d = Number(istTodayParts.day);
        // Create UTC date from IST components by subtracting 5:30.
        const utcMs = Date.UTC(y, m - 1, d, hh, mm) - 330 * 60_000;
        let scheduledMs = utcMs;
        // If the selected time already passed today (in IST), schedule it for tomorrow.
        if (scheduledMs <= Date.now()) {
          scheduledMs += 24 * 60 * 60_000;
        }
        const scheduled = new Date(scheduledMs);
        scheduledAt = scheduled.toISOString();
        remindAt = new Date(scheduledMs - 2 * 60_000).toISOString();
      }
    }

    const insertWithReminders = async () =>
      supabase
        .from("tasks")
        .insert({
          title,
          user_id: user.id,
          time_hhmm,
          timezone,
          scheduled_at: scheduledAt,
          remind_at: remindAt,
        })
        .select()
        .single();

    const insertBasic = async () =>
      supabase
        .from("tasks")
        .insert({
          title,
          user_id: user.id,
        })
        .select()
        .single();

    let res = await insertWithReminders();
    // Backwards-compatible fallback when DB hasn't been migrated / schema cache stale.
    if (res.error && (res.error as any).code === "PGRST204") {
      toast.message("Task time needs a quick DB update", {
        description:
          "Your Supabase tasks table is missing reminder columns (or schema cache is stale). For now, task will be saved without time. Run supabase/manual_apply_task_time_reminders.sql in Supabase SQL Editor to enable reminders.",
        duration: 9000,
      });
      res = await insertBasic();
    }

    if (res.error) {
      toast.error("Failed to add task");
      return;
    }

    setTasks((prev) => [res.data as any, ...prev]);
    toast.success("Task added!");
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    if (!user) return;
    const completedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase.from("tasks").update({ completed, completed_at: completedAt }).eq("id", id);
    if (error) { toast.error("Failed to update task"); return; }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed, completed_at: completedAt } : t)));
    if (completed) {
      await updateStreak(user.id);
      const { data: p } = await supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle();
      await recordTaskCompletionActivity(user.id, p?.name || profileName || user.user_metadata?.name || "You");
      toast.success("Task completed! 🎉");
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error("Failed to delete task"); return; }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast("Task deleted");
  };

  const filtered = tasks.filter((t) => {
    if (filter === "completed") return t.completed;
    if (filter === "pending") return !t.completed;
    return true;
  });

  const filters: { key: Filter; label: string; icon: React.ElementType }[] = [
    { key: "all", label: "All", icon: ListTodo },
    { key: "pending", label: "Pending", icon: Clock },
    { key: "completed", label: "Done", icon: CheckCircle2 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <MainHeader title="My Tasks" avatarUrl={avatarUrl} avatarFallback={profileName || user?.email || "U"} />
      <div className="mx-auto max-w-lg px-4 pt-2 pb-1">
        <p className="text-xs text-muted-foreground">
          {tasks.length} total · {tasks.filter((t) => t.completed).length} completed
        </p>
      </div>

      <main className="mx-auto max-w-lg px-4 py-3 space-y-4">
        <AddTaskInput onAdd={handleAddTask} />

        {/* Filters */}
        <div className="flex gap-2">
          {filters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                filter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
              <p className="text-muted-foreground">No tasks found</p>
            </div>
          ) : (
            filtered.map((task) => (
              <div key={task.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <TaskItem
                    id={task.id}
                    title={task.title}
                    completed={task.completed}
                    timeHHMM={task.time_hhmm ?? null}
                    onToggle={handleToggleTask}
                  />
                </div>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="shrink-0 rounded-xl p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Tasks;
