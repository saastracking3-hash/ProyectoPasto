"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PlanStatus = "active" | "paused" | "cancelled";
export type PlanFrequency = "weekly" | "biweekly" | "monthly" | "custom";

interface CreatePlanInput {
  client_id: string;
  address_id: string;
  service_type_id: string;
  frequency: PlanFrequency;
  custom_interval_days?: number;
  price_cents: number;
  tasks_included?: string[];
  start_date: string;
  end_date?: string;
  notes?: string;
}

interface UpdatePlanInput {
  frequency?: PlanFrequency;
  custom_interval_days?: number;
  price_cents?: number;
  tasks_included?: string[];
  end_date?: string | null;
  notes?: string;
  next_service_date?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function calculateNextServiceDate(
  fromDate: string,
  frequency: PlanFrequency,
  customDays?: number
): string {
  const date = new Date(fromDate);
  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "custom":
      date.setDate(date.getDate() + (customDays ?? 30));
      break;
  }
  return date.toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/*  Create Plan                                                        */
/* ------------------------------------------------------------------ */

export async function createPlan(data: CreatePlanInput) {
  try {
    const supabase = await createClient();

    const nextServiceDate = calculateNextServiceDate(
      data.start_date,
      data.frequency,
      data.custom_interval_days
    );

    const { data: plan, error } = await supabase
      .from("maintenance_plans")
      .insert({
        client_id: data.client_id,
        address_id: data.address_id,
        service_type_id: data.service_type_id,
        frequency: data.frequency,
        custom_interval_days: data.custom_interval_days ?? null,
        price_cents: data.price_cents,
        tasks_included: data.tasks_included ?? [],
        start_date: data.start_date,
        end_date: data.end_date ?? null,
        next_service_date: nextServiceDate,
        status: "active" as PlanStatus,
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: plan, error: null };
  } catch {
    return { data: null, error: "Error al crear el plan de mantenimiento" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Client Plans                                                   */
/* ------------------------------------------------------------------ */

export async function getClientPlans(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("maintenance_plans")
      .select(
        "*, service_type:service_types(name), address:addresses(street, number, city, zone)"
      )
      .eq("client_id", clientId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener planes del cliente" };
  }
}

/* ------------------------------------------------------------------ */
/*  Admin: All Plans                                                   */
/* ------------------------------------------------------------------ */

export async function getAllPlans(statusFilter?: PlanStatus) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("maintenance_plans")
      .select(
        "*, service_type:service_types(name), address:addresses(street, number, city, zone), client:profiles!client_id(full_name, phone)"
      )
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener planes" };
  }
}

/* ------------------------------------------------------------------ */
/*  Plan Detail                                                        */
/* ------------------------------------------------------------------ */

export async function getPlanDetail(planId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("maintenance_plans")
      .select(
        "*, service_type:service_types(*), address:addresses(*), client:profiles!client_id(full_name, phone, id)"
      )
      .eq("id", planId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener detalle del plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Plan                                                        */
/* ------------------------------------------------------------------ */

export async function updatePlan(planId: string, data: UpdatePlanInput) {
  try {
    const supabase = await createClient();
    const { data: plan, error } = await supabase
      .from("maintenance_plans")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", planId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: plan, error: null };
  } catch {
    return { data: null, error: "Error al actualizar el plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Pause Plan                                                         */
/* ------------------------------------------------------------------ */

export async function pausePlan(planId: string) {
  try {
    const supabase = await createClient();
    const { data: plan, error } = await supabase
      .from("maintenance_plans")
      .update({
        status: "paused" as PlanStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: plan, error: null };
  } catch {
    return { data: null, error: "Error al pausar el plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Cancel Plan                                                        */
/* ------------------------------------------------------------------ */

export async function cancelPlan(planId: string) {
  try {
    const supabase = await createClient();
    const { data: plan, error } = await supabase
      .from("maintenance_plans")
      .update({
        status: "cancelled" as PlanStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: plan, error: null };
  } catch {
    return { data: null, error: "Error al cancelar el plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Resume Plan                                                        */
/* ------------------------------------------------------------------ */

export async function resumePlan(planId: string) {
  try {
    const supabase = await createClient();

    // Get plan to recalculate next service date
    const { data: existing } = await supabase
      .from("maintenance_plans")
      .select("frequency, custom_interval_days")
      .eq("id", planId)
      .single();

    if (!existing) return { data: null, error: "Plan no encontrado" };

    const today = new Date().toISOString().split("T")[0];
    const nextDate = calculateNextServiceDate(
      today,
      existing.frequency as PlanFrequency,
      existing.custom_interval_days
    );

    const { data: plan, error } = await supabase
      .from("maintenance_plans")
      .update({
        status: "active" as PlanStatus,
        next_service_date: nextDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: plan, error: null };
  } catch {
    return { data: null, error: "Error al reactivar el plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Generate Next Service from Plan                                    */
/* ------------------------------------------------------------------ */

export async function generateNextService(planId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("maintenance_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) return { data: null, error: "Plan no encontrado" };

    if (plan.status !== "active") {
      return { data: null, error: "El plan no esta activo" };
    }

    // Create a service request from the plan
    const { data: sr, error: srError } = await supabase
      .from("service_requests")
      .insert({
        client_id: plan.client_id,
        address_id: plan.address_id,
        service_type_id: plan.service_type_id,
        urgency: "normal",
        description: `Servicio generado automaticamente desde plan de mantenimiento.${plan.notes ? ` Notas: ${plan.notes}` : ""}`,
        preferred_date: plan.next_service_date,
        status: "request_created",
        maintenance_plan_id: plan.id,
      })
      .select()
      .single();

    if (srError) return { data: null, error: srError.message };

    // Insert state log
    await supabase.from("service_state_log").insert({
      service_request_id: sr.id,
      from_status: null,
      to_status: "request_created",
      changed_by: user.id,
      notes: "Servicio generado desde plan de mantenimiento",
    });

    // Update the plan's next service date
    const nextDate = calculateNextServiceDate(
      plan.next_service_date,
      plan.frequency as PlanFrequency,
      plan.custom_interval_days
    );

    await supabase
      .from("maintenance_plans")
      .update({
        next_service_date: nextDate,
        last_service_date: plan.next_service_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId);

    return { data: sr, error: null };
  } catch {
    return { data: null, error: "Error al generar servicio desde el plan" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Services Generated from a Plan                                 */
/* ------------------------------------------------------------------ */

export async function getPlanServices(planId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        "id, request_number, status, created_at, preferred_date, service_type:service_types(name)"
      )
      .eq("maintenance_plan_id", planId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener servicios del plan" };
  }
}
