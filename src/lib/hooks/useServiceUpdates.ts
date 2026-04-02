"use client";

import { useCallback } from "react";
import { useRealtimeSubscription, type RealtimeStatus } from "./useRealtimeSubscription";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface UseServiceUpdatesOptions {
  /** Optional service request ID to filter on a single service */
  serviceRequestId?: string;
  /** Called when a service_requests row changes status */
  onStatusChange?: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    newRecord: Record<string, unknown>;
    oldRecord: Record<string, unknown>;
  }) => void;
  /** Whether subscription is enabled */
  enabled?: boolean;
}

/**
 * Hook that listens to changes on the service_requests table.
 * Calls a callback when status changes. Used by client and admin portals.
 */
export function useServiceUpdates({
  serviceRequestId,
  onStatusChange,
  enabled = true,
}: UseServiceUpdatesOptions): { status: RealtimeStatus } {
  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (!onStatusChange) return;

      const newRecord = (payload as any).new ?? {};
      const oldRecord = (payload as any).old ?? {};

      // For UPDATE events, only fire if status actually changed
      if (payload.eventType === "UPDATE") {
        if (oldRecord.status && newRecord.status && oldRecord.status === newRecord.status) {
          return;
        }
      }

      onStatusChange({
        eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
        newRecord,
        oldRecord,
      });
    },
    [onStatusChange]
  );

  const { status } = useRealtimeSubscription({
    filters: {
      event: "*",
      table: "service_requests",
      ...(serviceRequestId ? { filter: `id=eq.${serviceRequestId}` } : {}),
    },
    onPayload: handlePayload,
    enabled,
  });

  return { status };
}
