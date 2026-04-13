import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

function firebaseWebConfig(): FirebaseOptions | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  if (!apiKey) return null;
  return {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  };
}

/** Registers FCM web token into user_devices when Firebase env vars are set (uses existing /sw.js registration). */
export async function registerFcmDeviceToken(
  userId: string,
  serviceWorkerRegistration: ServiceWorkerRegistration
): Promise<void> {
  const cfg = firebaseWebConfig();
  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim();
  if (!cfg?.projectId || !vapidKey) return;
  if (!(await isSupported())) return;
  try {
    const app = initializeApp(cfg);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
    if (!token) return;
    await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        device_token: token,
        platform: "web_fcm",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_token" }
    );
  } catch {
    /* FCM optional; Web Push may still work */
  }
}
