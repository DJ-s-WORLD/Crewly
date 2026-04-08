import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerServiceWorker, runPushOnboarding } from "@/services/notificationService";

/**
 * Registers SW early; after a short delay requests Notification permission once (stores result in localStorage).
 */
const PushNotificationBootstrap = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void registerServiceWorker();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => {
      void runPushOnboarding(user.id);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  return null;
};

export default PushNotificationBootstrap;
