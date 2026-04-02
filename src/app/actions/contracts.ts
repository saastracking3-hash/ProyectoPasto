"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ContractStatus = "active" | "paused" | "expired" | "cancelled";

interface AuthorizedContact {
  name: string;
  phone: string;
  email: string;
}

interface CreateContractInput {
  client_id: string;
  name: string;
  start_date: string;
  end_date: string;
  monthly_amount_cents: number;
  sla_response_hours?: number;
  max_monthly_spend_cents?: number;
  location_ids?: string[];
  authorized_contacts?: AuthorizedContact[];
  notes?: string;
}

interface UpdateContractInput {
  name?: string;
  start_date?: string;
  end_date?: string;
  monthly_amount_cents?: number;
  sla_response_hours?: number;
  max_monthly_spend_cents?: number;
  location_ids?: string[];
  authorized_contacts?: AuthorizedContact[];
  notes?: string;
  status?: ContractStatus;
}

/* ------------------------------------------------------------------ */
/*  Create Contract                                                    */
/* ------------------------------------------------------------------ */

export async function createContract(data: CreateContractInput) {
  try {
    const supabase = await createClient();

    const { data: contract, error } = await supabase
      .from("contracts")
      .insert({
        client_id: data.client_id,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        monthly_amount_cents: data.monthly_amount_cents,
        sla_response_hours: data.sla_response_hours ?? null,
        max_monthly_spend_cents: data.max_monthly_spend_cents ?? null,
        location_ids: data.location_ids ?? [],
        authorized_contacts: data.authorized_contacts ?? [],
        status: "active" as ContractStatus,
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: contract, error: null };
  } catch {
    return { data: null, error: "Error al crear el contrato" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Client Contracts                                               */
/* ------------------------------------------------------------------ */

export async function getClientContracts(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener contratos del cliente" };
  }
}

/* ------------------------------------------------------------------ */
/*  Admin: All Contracts                                               */
/* ------------------------------------------------------------------ */

export async function getAllContracts(statusFilter?: ContractStatus) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("contracts")
      .select(
        "*, client:profiles!client_id(full_name, phone)"
      )
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener contratos" };
  }
}

/* ------------------------------------------------------------------ */
/*  Contract Detail                                                    */
/* ------------------------------------------------------------------ */

export async function getContractDetail(contractId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "*, client:profiles!client_id(full_name, phone, id)"
      )
      .eq("id", contractId)
      .single();

    if (error) return { data: null, error: error.message };

    // If there are location_ids, fetch the addresses
    if (data.location_ids && data.location_ids.length > 0) {
      const { data: addresses } = await supabase
        .from("addresses")
        .select("id, label, street, number, city, zone")
        .in("id", data.location_ids);
      data.locations = addresses || [];
    } else {
      data.locations = [];
    }

    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener detalle del contrato" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Contract                                                    */
/* ------------------------------------------------------------------ */

export async function updateContract(
  contractId: string,
  data: UpdateContractInput
) {
  try {
    const supabase = await createClient();
    const { data: contract, error } = await supabase
      .from("contracts")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", contractId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: contract, error: null };
  } catch {
    return { data: null, error: "Error al actualizar el contrato" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Services Under Contract                                        */
/* ------------------------------------------------------------------ */

export async function getContractServices(contractId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_requests")
      .select(
        "id, request_number, status, created_at, preferred_date, service_type:service_types(name), address:addresses(street, number, zone)"
      )
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data || [], error: null };
  } catch {
    return { data: null, error: "Error al obtener servicios del contrato" };
  }
}
