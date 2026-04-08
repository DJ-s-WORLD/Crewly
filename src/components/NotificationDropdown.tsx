import { useNavigate } from "react-router-dom";
import { markNotificationsRead, deleteNotification } from "@/services/social";
import { useNotifications } from "@/context/NotificationsContext";
import { cn } from "@/lib/utils";
import NotificationItem from "@/components/NotificationItem";
import FollowRequestCard from "@/components/FollowRequestCard";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

/**
 * Notification list panel: responsive (dropdown on desktop, anchored sheet on narrow screens).
 */
const NotificationDropdown = () => {
  const { notifications, unreadCount, open, setOpen, markAllRead, loading, refresh, removeNotificationLocal } =
    useNotifications();
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <div
      className={cn(
        "z-50 flex max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl",
        "animate-in fade-in zoom-in-95 duration-200",
        "max-md:fixed max-md:inset-x-3 max-md:top-[max(0.75rem,env(safe-area-inset-bottom))] max-md:bottom-auto max-md:max-h-[min(72vh,calc(100dvh-5rem))]",
        "md:absolute md:right-0 md:top-full md:mt-2 md:w-[min(22rem,calc(100vw-2rem))]"
      )}
      role="list"
      aria-label="Notifications"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Notifications</p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => {
              void markAllRead();
            }}
            className="text-xs font-medium text-primary hover:underline shrink-0"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading && notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => (
              <li key={n.id}>
                {n.type === "follow_request" ? (
                  (() => {
                    const data =
                      n.data && typeof n.data === "object" && n.data !== null ? (n.data as Record<string, unknown>) : null;
                    const requestId = (data && "request_id" in data ? String(data.request_id ?? "") : "") || n.reference_id || "";
                    const senderId = data && "sender_id" in data ? String(data.sender_id ?? "") : "";
                    if (!requestId || !senderId) {
                      return (
                        <NotificationItem
                          id={n.id}
                          title={n.title}
                          body={n.body}
                          createdAt={n.created_at}
                          read={n.read}
                          onOpen={() => {
                            setOpen(false);
                          }}
                          onDelete={async () => {
                            removeNotificationLocal(n.id);
                            const { error } = await deleteNotification(n.id);
                            if (error) {
                              toast.error("Could not delete");
                              void refresh();
                              return;
                            }
                            toast.success("Deleted");
                          }}
                        />
                      );
                    }
                    return (
                      <div className="relative group">
                        <FollowRequestCard
                          notificationId={n.id}
                          requestId={requestId}
                          senderId={senderId}
                          title={n.title}
                          body={n.body}
                          read={n.read}
                          onOpen={() => setOpen(false)}
                          onDone={(_result) => {
                            // mark read + refresh list after accept/reject
                            void markNotificationsRead([n.id]).then(() => void refresh());
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Delete notification"
                          className={cn(
                            "absolute right-2 top-2 rounded-lg p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                            "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          )}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeNotificationLocal(n.id);
                            const { error } = await deleteNotification(n.id);
                            if (error) {
                              toast.error("Could not delete");
                              void refresh();
                              return;
                            }
                            toast.success("Deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <NotificationItem
                    id={n.id}
                    title={n.title}
                    body={n.body}
                    createdAt={n.created_at}
                    read={n.read}
                    onOpen={() => {
                      setOpen(false);
                      if (!n.read) {
                        void markNotificationsRead([n.id]).then(() => void refresh());
                      }
                      const data =
                        n.data && typeof n.data === "object" && n.data !== null ? (n.data as Record<string, unknown>) : null;
                      const senderId =
                        ((n as unknown as { sender_id?: string | null }).sender_id ?? "") ||
                        (data && "sender_id" in data ? String(data.sender_id ?? "") : "");
                      const cid = data && "conversation_id" in data ? String(data.conversation_id ?? "") : "";
                      const postId =
                        (n.reference_id ? String(n.reference_id) : "") ||
                        (data && "post_id" in data ? String(data.post_id ?? "") : "");
                      if (n.type === "message" && cid) navigate(`/messages/${cid}`);
                      else if (["post", "like", "comment", "post_tag"].includes(n.type) && postId) navigate(`/post/${postId}`);
                      else if (["follow_request", "follow_accepted", "follow_rejected", "follow"].includes(n.type) && senderId)
                        navigate(`/u/${senderId}`);
                    }}
                    onDelete={async () => {
                      removeNotificationLocal(n.id);
                      const { error } = await deleteNotification(n.id);
                      if (error) {
                        toast.error("Could not delete");
                        void refresh();
                        return;
                      }
                      toast.success("Deleted");
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
