import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROMPT_KEY = "lifepilot_push_prompt_v1";

function browserNotificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return window.btoa(binary);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Ask once after login; registers SW and saves Web Push subscription when VITE_VAPID_PUBLIC_KEY is set. */
export async function runPushOnboarding(userId: string): Promise<void> {
  if (!browserNotificationsSupported()) return;
  if (localStorage.getItem(PROMPT_KEY)) return;

  const permission = await Notification.requestPermission();
  localStorage.setItem(PROMPT_KEY, permission === "granted" ? "granted" : "asked");

  const reg = await registerServiceWorker();
  if (!reg || permission !== "granted") return;

  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapid || typeof vapid !== "string" || vapid.length < 20) {
    return;
  }

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.trim()),
    });
    const key = sub.getKey("p256dh");
    const auth = sub.getKey("auth");
    if (!key || !auth) return;

    await supabase
      .from("web_push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", sub.endpoint);
    await supabase.from("web_push_subscriptions").insert({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(key),
      auth: arrayBufferToBase64(auth),
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* VAPID mismatch or table missing — foreground notifications still work */
  }
}

/** In-app toast (top-right) + system notification when permitted. */
export function surfaceNotification(title: string, body: string, opts?: { url?: string; tag?: string }) {
  toast.info(title, {
    description: body,
    duration: 6500,
    position: "top-right",
    classNames: { toast: "rounded-xl shadow-lg border border-border" },
  });

  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    return;
  }

  if (!browserNotificationsSupported() || Notification.permission !== "granted") return;

  try {
    const n = new Notification(title, { body, icon: "/favicon.ico", tag: opts?.tag || "lifepilot" });
    n.onclick = () => {
      window.focus();
      if (opts?.url) window.location.href = opts.url;
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function notificationUrlForRow(type: string, referenceId: string | null, data: unknown): string {
  const base = window.location.origin;
  const d = data && typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  const postId = (referenceId ?? (d?.post_id ? String(d.post_id) : "")) || "";
  const cid = d?.conversation_id ? String(d.conversation_id) : "";
  if (type === "message" && cid) return `${base}/messages/${cid}`;
  if (["post", "like", "comment", "post_tag"].includes(type) && postId) return `${base}/post/${postId}`;
  return `${base}/feed`;
}

export function surfaceAppNotificationRow(row: {
  title: string;
  body: string;
  type: string;
  reference_id: string | null;
  data: unknown;
}) {
  const url = notificationUrlForRow(row.type, row.reference_id, row.data);
  surfaceNotification(row.title, row.body, { url, tag: `${row.type}-${row.reference_id ?? "noref"}` });
}
