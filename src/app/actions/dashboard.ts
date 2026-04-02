"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Client Dashboard                                                   */
/* ------------------------------------------------------------------ */

export async function getClientDashboard(clientId: string) {
  try {
    const supabase = await createClient();

    const activeStatuses = [
      "approved",
      "scheduled",
      "crew_assigned",
      "in_transit",
      "arrived",
      "in_progress",
      "paused",
    ];
    const pendingQuoteStatuses = ["quoted", "pending_approval"];

    const [activeResult, pendingResult, completedResult] = await Promise.all([
      supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", activeStatuses),
      supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", pendingQuoteStatuses),
      supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .in("status", ["completed_by_crew", "validated", "closed"]),
    ]);

    return {
      data: {
        active: activeResult.count ?? 0,
        pending_quotes: pendingResult.count ?? 0,
        completed: completedResult.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: "Error al obtener dashboard" };
  }
}

/* ------------------------------------------------------------------ */
/*  Admin Dashboard                                                    */
/* ------------------------------------------------------------------ */

export async function getAdminDashboard() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const activeStatuses = [
      "approved",
      "scheduled",
      "crew_assigned",
      "in_transit",
      "arrived",
      "in_progress",
      "paused",
    ];

    const [newTodayResult, pendingQuotesResult, activeResult, crewsWorkingResult] =
      await Promise.all([
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["request_created", "pending_review"]),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .in("status", activeStatuses),
        supabase
          .from("assignments")
          .select("crew_id")
          .eq("scheduled_date", today)
          .then(({ data }) => {
            const uniqueCrews = new Set(data?.map((a) => a.crew_id));
            return uniqueCrews.size;
          }),
      ]);

    return {
      data: {
        new_today: newTodayResult.count ?? 0,
        pending_quotes: pendingQuotesResult.count ?? 0,
        active_services: activeResult.count ?? 0,
        crews_working: crewsWorkingResult,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: "Error al obtener dashboard admin" };
  }
}

/* ------------------------------------------------------------------ */
/*  Admin Recent Activity                                              */
/* ------------------------------------------------------------------ */

export async function getAdminRecentActivity(limit = 20) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_state_log")
      .select(
        `*,
        changed_by_profile:profiles!changed_by(full_name, role),
        service_request:service_requests(request_number, service_type:service_types(name), client:profiles!client_id(full_name))`
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener actividad reciente" };
  }
}
