"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export interface RealtimeFilter {
  event?: RealtimeEvent;
  schema?: string;
  table: string;
  filter?: string; // e.g. "id=eq.some-uuid"
}

export interface UseRealtimeSubscriptionOptions {
  /** Filter configuration for postgres_changes */
  filters: RealtimeFilter;
  /** Callback when a change is received */
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** Whether subscription is enabled (default true) */
  enabled?: boolean;
}

export type RealtimeStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Generic hook that subscribes to Supabase Realtime changes on a table.
 * Returns the connection status and a cleanup function.
 * Auto-reconnects on channel errors.
 */
export function useRealtimeSubscription({
  filters,
  onPayload,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPayloadRef = useRef(onPayload);

  // Keep callback ref up to date without re-subscribing
  useEffect(() => {
    onPayloadRef.current = onPayload;
  }, [onPayload]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (channelRef.current) {
      const supabase = createClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    const supabase = createClient();
    const channelName = `realtime-${filters.table}-${filters.filter ?? "all"}-${Date.now()}`;

    setStatus("connecting");

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event: filters.event ?? "*",
          schema: filters.schema ?? "public",
          table: filters.table,
          ...(filters.filter ? { filter: filters.filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onPayloadRef.current(payload);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("connected");
        } else if (status === "CHANNEL_ERROR") {
          setStatus("error");
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            supabase.removeChannel(channel);
            channelRef.current = null;
            // Re-trigger effect by forcing a state change
            setStatus("connecting");
          }, 3000);
        } else if (status === "CLOSED") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [filters.table, filters.filter, filters.event, filters.schema, enabled, cleanup]);

  return { status, cleanup };
}
