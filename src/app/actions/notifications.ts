"use server";

import { createClient } from "@/lib/supabase/server";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "action";
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(userId: string, limit = 20) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: data as Notification[], error: null };
  } catch {
    return { data: null, error: "Error al obtener notificaciones" };
  }
}

export async function getUnreadCount(userId: string) {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) return { data: null, error: error.message };
    return { data: count ?? 0, error: null };
  } catch {
    return { data: null, error: "Error al obtener conteo de notificaciones" };
  }
}

export async function markAsRead(notificationId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al marcar notificacion como leida" };
  }
}

export async function markAllAsRead(userId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al marcar todas como leidas" };
  }
}

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "action",
  link?: string
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link: link ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Notification, error: null };
  } catch {
    return { data: null, error: "Error al crear notificacion" };
  }
}
