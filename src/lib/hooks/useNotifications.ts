"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import {
  getNotifications,
  getUnreadCount,
  markAsRead as markAsReadAction,
  markAllAsRead as markAllAsReadAction,
} from "@/app/actions/notifications";
import type { Notification } from "@/app/actions/notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Get the current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // Fetch notifications and unread count
  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [notifResult, countResult] = await Promise.all([
      getNotifications(userId, 20),
      getUnreadCount(userId),
    ]);
    if (notifResult.data) setNotifications(notifResult.data);
    if (countResult.data !== null) setUnreadCount(countResult.data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime inserts for this user
  useRealtimeSubscription({
    filters: {
      event: "INSERT",
      table: "notifications",
      filter: userId ? `user_id=eq.${userId}` : undefined,
    },
    onPayload: (payload) => {
      const newNotification = payload.new as Notification;
      setNotifications((prev) => [newNotification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    },
    enabled: !!userId,
  });

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const result = await markAsReadAction(notificationId);
      if (!result.success) {
        // Revert on error
        fetchData();
      }
    },
    [fetchData]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const result = await markAllAsReadAction(userId);
    if (!result.success) {
      fetchData();
    }
  }, [userId, fetchData]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
