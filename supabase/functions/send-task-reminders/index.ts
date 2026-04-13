/// <reference path="../deno-shim.d.ts" />
import { createClient } from "@supabase/supabase-js";
import webpush from "npm:web-push@3.6.7";

/**
 * Cron-invoked: sends Web Push (VAPID) and/or FCM (legacy HTTP) for due task reminders.
 *
 * Schedule: POST every minute with header Authorization: Bearer <TASK_REMINDER_CRON_SECRET>
 *
 * Secrets (Dashboard → Edge Functions):
 * - TASK_REMINDER_CRON_SECRET — required
 * - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY — Web Push (match client VITE_VAPID_PUBLIC_KEY)
 * - VAPID_CONTACT_EMAIL — optional, default mailto:notify@lifepilot.app
 * - FCM_SERVER_KEY — optional Firebase Cloud Messaging legacy server key for rows in user_devices
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendFcmLegacy(serverKey: string, token: string, title: string, body: string): Promise<boolean> {
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      notification: {
        title,
        body,
        sound: "default",
        icon: "/favicon.ico",
      },
      data: { url: "/tasks" },
    }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: number; failure?: number };
  return (data.success ?? 0) > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("TASK_REMINDER_CRON_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Missing Supabase env" }, 500);
  }

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")?.trim();
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  const vapidContact = Deno.env.get("VAPID_CONTACT_EMAIL")?.trim() || "mailto:notify@lifepilot.app";
  const fcmKey = Deno.env.get("FCM_SERVER_KEY")?.trim();

  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, title, user_id, remind_at")
    .eq("completed", false)
    .is("reminder_push_sent_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", now.toISOString())
    .gte("remind_at", windowStart.toISOString())
    .limit(80);

  if (taskErr) {
    return json({ error: taskErr.message }, 500);
  }

  let sent = 0;
  let skipped = 0;

  for (const task of tasks ?? []) {
    const title = "Reminder: Complete your task";
    const body = String(task.title ?? "Task");
    const payload = JSON.stringify({
      title,
      body,
      url: "/tasks",
      tag: `task-reminder-${task.id}`,
    });

    let delivered = false;

    if (vapidPublic && vapidPrivate) {
      const { data: subs } = await supabase
        .from("web_push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", task.user_id);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: 300 }
          );
          delivered = true;
        } catch (e) {
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 410 || status === 404) {
            await supabase.from("web_push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
    }

    if (fcmKey) {
      const { data: devices } = await supabase
        .from("user_devices")
        .select("device_token")
        .eq("user_id", task.user_id);

      for (const row of devices ?? []) {
        if (await sendFcmLegacy(fcmKey, row.device_token, title, body)) {
          delivered = true;
        }
      }
    }

    if (delivered) {
      await supabase.from("tasks").update({ reminder_push_sent_at: now.toISOString() }).eq("id", task.id);
      sent++;
    } else {
      skipped++;
    }
  }

  return json({ ok: true, processed: tasks?.length ?? 0, sent, skipped });
});
