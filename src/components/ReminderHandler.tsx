import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { surfaceNotification } from "@/services/notificationService";

const IST_TZ = "Asia/Kolkata";

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Best-effort in-app reminders.
 * - When app is open, schedules timers for upcoming reminders (2 min before task time).
 * - Web apps cannot reliably schedule when fully closed; this is the best possible without push.
 */
const ReminderHandler = () => {
  const { user } = useAuth();
  const timersRef = useRef<Map<string, number>>(new Map());

  const canNotify = useMemo(() => supportsNotifications(), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const clearAll = () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };

    const schedule = async () => {
      clearAll();
      const now = new Date();
      const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data } = await supabase
        .from("tasks")
        .select("id, title, remind_at, timezone, completed")
        .eq("user_id", user.id)
        .eq("completed", false)
        .not("remind_at", "is", null)
        .gte("remind_at", now.toISOString())
        .lte("remind_at", soon.toISOString())
        .order("remind_at", { ascending: true })
        .limit(60);

      if (cancelled) return;

      for (const row of data ?? []) {
        if (!row.remind_at) continue;
        const ms = new Date(row.remind_at).getTime() - Date.now();
        if (ms <= 0) continue;
        const id = row.id as string;
        const timeoutId = window.setTimeout(() => {
          const tz = (row.timezone || IST_TZ) as string;
          surfaceNotification("Task reminder", row.title, {
            tag: `task-${id}`,
            url: `${window.location.origin}/tasks`,
          });
          // If permission hasn't been asked yet, prompt only when they create tasks;
          // so we don't request here.
          void tz;
        }, ms);
        timersRef.current.set(id, timeoutId);
      }
    };

    void schedule();
    const interval = window.setInterval(() => void schedule(), 60_000);

    // Realtime updates to tasks: reschedule quickly.
    const ch = supabase
      .channel(`tasks_reminders:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        () => {
          void schedule();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      clearAll();
      void supabase.removeChannel(ch);
      void canNotify;
    };
  }, [user?.id]);

  return null;
};

export default ReminderHandler;

