"use client";
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

export default function PushNotificationToggle({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem("push_enabled") === "true");
  }, []);

  const toggle = async () => {
    if (enabled) {
      localStorage.removeItem("push_enabled");
      setEnabled(false);
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      // Register service worker
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.ready;
        // VAPID key would be needed for real push — store placeholder
        localStorage.setItem("push_enabled", "true");
        setEnabled(true);
        // Send to API
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, subscription: { endpoint: "pending_vapid_setup" } }),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        enabled
          ? "bg-green-100 text-green-800"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      {loading ? "..." : enabled ? "Notificaciones ON" : "Activar notificaciones"}
    </button>
  );
}
