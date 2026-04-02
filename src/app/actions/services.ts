"use server";

import { createClient } from "@/lib/supabase/server";
import { canTransition } from "@/lib/services/state-machine";
import type {
  ServiceType,
  ServiceRequest,
  ServiceStatus,
  UserRole,
  UrgencyLevel,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Service Types                                                      */
/* ------------------------------------------------------------------ */

export async function getServiceTypes() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (error) return { data: null, error: error.message };
    return { data: data as ServiceType[], error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener tipos de servicio" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create Service Request                                             */
/* ------------------------------------------------------------------ */

interface CreateServiceRequestInput {
  client_id: string;
  address_id: string;
  service_type_id: string;
  urgency?: UrgencyLevel;
  description?: string;
  preferred_date?: string;
  preferred_time_slot?: string;
  estimated_area_sqm?: number;
  photos?: string[];
}

export async function createServiceRequest(data: CreateServiceRequestInput) {
  try {
    const supabase = await createClient();

    const { data: sr, error: srError } = await supabase
      .from("service_requests")
      .insert({
        client_id: data.client_id,
        address_id: data.address_id,
        service_type_id: data.service_type_id,
        urgency: data.urgency ?? "normal",
        description: data.description ?? null,
        preferred_date: data.preferred_date ?? null,
        preferred_time_slot: data.preferred_time_slot ?? null,
        estimated_area_sqm: data.estimated_area_sqm ?? null,
        photos: data.photos ?? [],
        status: "request_created" as ServiceStatus,
      })
      .select()
      .single();

    if (srError) return { data: null, error: srError.message };

    // Insert initial state log
    await supabase.from("service_state_log").insert({
      service_request_id: sr.id,
      from_status: null,
      to_status: "request_created",
      changed_by: data.client_id,
      notes: "Solicitud creada por el cliente",
    });

    return { data: sr as ServiceRequest, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear la solicitud" };
  }
}

/* ------------------------------------------------------------------ */
/*  Client Services                                                    */
/* ------------------------------------------------------------------ */

export async function getClientServices(
  clientId: string,
  statusFilter?: ServiceStatus
) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("service_requests")
      .select(
        "*, service_type:service_types(*), address:addresses(*)"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener servicios del cliente" };
  }
}

/* ------------------------------------------------------------------ */
/*  Service Detail                                                     */
/* ------------------------------------------------------------------ */

export async function getServiceDetail(serviceId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        `*,
        service_type:service_types(*),
        address:addresses(*),
        quotes(*, items:quote_items(*)),
        assignment:assignments(*,
          crew:crews(*),
          photos:service_photos(*),
          checklist:checklists(*, items:checklist_items(*))
        ),
        reviews(*),
        state_log:service_state_log(*, changed_by_profile:profiles!changed_by(full_name))`
      )
      .eq("id", serviceId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener detalle del servicio" };
  }
}

/* ------------------------------------------------------------------ */
/*  Admin: All Services                                                */
/* ------------------------------------------------------------------ */

export async function getAllServices(
  statusFilter?: ServiceStatus,
  search?: string
) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("service_requests")
      .select(
        "*, service_type:service_types(name), address:addresses(street, number, city, zone), client:profiles!client_id(full_name, phone)"
      )
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (search) {
      query = query.or(
        `description.ilike.%${search}%,request_number::text.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener servicios" };
  }
}

/* ------------------------------------------------------------------ */
/*  Crew: Today's assignments                                          */
/* ------------------------------------------------------------------ */

export async function getServicesByCrewToday(crewId: string) {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("assignments")
      .select(
        `*, service_request:service_requests(*, service_type:service_types(name), address:addresses(street, number, city, zone), client:profiles!client_id(full_name, phone))`
      )
      .eq("crew_id", crewId)
      .eq("scheduled_date", today)
      .order("scheduled_start_time", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener servicios de hoy" };
  }
}

/* ------------------------------------------------------------------ */
/*  Crew: All assignments                                              */
/* ------------------------------------------------------------------ */

export async function getServicesByCrewAll(crewId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `*, service_request:service_requests(*, service_type:service_types(name), address:addresses(street, number, city, zone))`
      )
      .eq("crew_id", crewId)
      .order("scheduled_date", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener historial de servicios" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Service Status                                              */
/* ------------------------------------------------------------------ */

export async function updateServiceStatus(
  serviceRequestId: string,
  newStatus: ServiceStatus,
  userId: string,
  notes?: string
) {
  try {
    const supabase = await createClient();

    // Get current status and user role
    const [{ data: sr }, { data: profile }] = await Promise.all([
      supabase
        .from("service_requests")
        .select("status")
        .eq("id", serviceRequestId)
        .single(),
      supabase.from("profiles").select("role").eq("id", userId).single(),
    ]);

    if (!sr || !profile) {
      return { data: null, error: "Servicio o usuario no encontrado" };
    }

    const currentStatus = sr.status as ServiceStatus;
    const role = profile.role as UserRole;

    if (!canTransition(currentStatus, newStatus, role)) {
      return {
        data: null,
        error: `Transicion no permitida de "${currentStatus}" a "${newStatus}" para rol "${role}"`,
      };
    }

    // Update status
    const { error: updateError } = await supabase
      .from("service_requests")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", serviceRequestId);

    if (updateError) return { data: null, error: updateError.message };

    // Insert state log
    const { error: logError } = await supabase
      .from("service_state_log")
      .insert({
        service_request_id: serviceRequestId,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: userId,
        notes: notes ?? null,
      });

    if (logError) {
      console.error("Error inserting state log:", logError.message);
    }

    return { data: { status: newStatus }, error: null };
  } catch (e) {
    return { data: null, error: "Error al actualizar el estado" };
  }
}
