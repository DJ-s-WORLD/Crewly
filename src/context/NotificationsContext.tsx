import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchNotifications, markAllNotificationsRead } from "@/services/social";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { surfaceAppNotificationRow } from "@/services/notificationService";

type AppNotification = Tables<"app_notifications">;

const POLL_MS = 20_000;

type Ctx = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotificationLocal: (id: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
};

const NotificationsContext = createContext<Ctx | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const lastSeenIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    const { data } = await fetchNotifications(60);
    const list = data ?? [];
    setNotifications(list);
    lastSeenIdRef.current = list[0]?.id ?? lastSeenIdRef.current;
    setLoading(false);
  }, [user]);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const t = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [user, refresh]);

  // Realtime inserts: keep in-app list fresh + surface a toast + system notification.
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`app_notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => {
            // Avoid duplicates (poll + realtime overlap).
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev].slice(0, 80);
          });

          // Avoid surfacing the "first load" as a push by only notifying after we've seen at least one ID.
          if (lastSeenIdRef.current) {
            surfaceAppNotificationRow({
              title: row.title,
              body: row.body,
              type: row.type,
              reference_id: row.reference_id,
              data: row.data,
            });
          }
          lastSeenIdRef.current = row.id;
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markAllRead,
      removeNotificationLocal: (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      open,
      setOpen,
    }),
    [notifications, unreadCount, loading, refresh, markAllRead, open]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const x = useContext(NotificationsContext);
  if (!x) throw new Error("useNotifications must be used within NotificationsProvider");
  return x;
}
