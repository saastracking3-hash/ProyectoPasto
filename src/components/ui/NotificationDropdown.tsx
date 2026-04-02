"use client";

import { useRouter } from "next/navigation";
import type { Notification } from "@/app/actions/notifications";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function typeIcon(type: Notification["type"]) {
  switch (type) {
    case "success":
      return (
        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
      );
    case "warning":
      return (
        <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
      );
    case "action":
      return (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
      );
    default:
      return (
        <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
      );
  }
}

interface NotificationDropdownProps {
  notifications: Notification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export default function NotificationDropdown({
  notifications,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter();
  const displayNotifications = notifications.slice(0, 10);
  const hasUnread = notifications.some((n) => !n.is_read);

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
        {hasUnread && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-green-700 hover:text-green-900 font-medium"
          >
            Marcar todas como leidas
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Sin notificaciones</p>
          </div>
        ) : (
          displayNotifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-l-3 ${
                !notification.is_read
                  ? "border-l-green-600 bg-green-50/40"
                  : "border-l-transparent"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-1.5">{typeIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm truncate ${
                        !notification.is_read
                          ? "font-semibold text-gray-900"
                          : "font-medium text-gray-700"
                      }`}
                    >
                      {notification.title}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {timeAgo(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
