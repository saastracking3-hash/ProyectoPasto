"use server";

import { createClient } from "@/lib/supabase/server";
import type { Equipment, EquipmentWithCrew } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Get All Equipment                                                   */
/* ------------------------------------------------------------------ */

export async function getAllEquipment(filters?: {
  type?: string;
  status?: string;
}) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("equipment")
      .select("*, crew:crews!assigned_to_crew(id, name)")
      .order("name");

    if (filters?.type) {
      query = query.eq("type", filters.type);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as EquipmentWithCrew[], error: null };
  } catch {
    return { data: null, error: "Error al obtener equipos" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Equipment Detail                                                */
/* ------------------------------------------------------------------ */

export async function getEquipmentDetail(id: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .select("*, crew:crews!assigned_to_crew(id, name)")
      .eq("id", id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as EquipmentWithCrew, error: null };
  } catch {
    return { data: null, error: "Error al obtener detalle del equipo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create Equipment                                                    */
/* ------------------------------------------------------------------ */

export async function createEquipment(equipmentData: {
  name: string;
  type: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  status?: string;
  purchase_date?: string;
  next_maintenance?: string;
  notes?: string;
}) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .insert({
        name: equipmentData.name,
        type: equipmentData.type,
        brand: equipmentData.brand || null,
        model: equipmentData.model || null,
        serial_number: equipmentData.serial_number || null,
        status: equipmentData.status || "available",
        purchase_date: equipmentData.purchase_date || null,
        next_maintenance: equipmentData.next_maintenance || null,
        notes: equipmentData.notes || null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Equipment, error: null };
  } catch {
    return { data: null, error: "Error al crear equipo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Equipment                                                    */
/* ------------------------------------------------------------------ */

export async function updateEquipment(
  id: string,
  updates: Partial<{
    name: string;
    type: string;
    brand: string;
    model: string;
    serial_number: string;
    status: string;
    purchase_date: string;
    last_maintenance: string;
    next_maintenance: string;
    notes: string;
    assigned_to_crew: string | null;
  }>
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Equipment, error: null };
  } catch {
    return { data: null, error: "Error al actualizar equipo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Equipment                                                    */
/* ------------------------------------------------------------------ */

export async function deleteEquipment(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("equipment").delete().eq("id", id);

    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "Error al eliminar equipo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Assign to Crew                                                      */
/* ------------------------------------------------------------------ */

export async function assignToCrew(equipmentId: string, crewId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .update({ assigned_to_crew: crewId, status: "in_use" })
      .eq("id", equipmentId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Equipment, error: null };
  } catch {
    return { data: null, error: "Error al asignar equipo a cuadrilla" };
  }
}

/* ------------------------------------------------------------------ */
/*  Unassign from Crew                                                  */
/* ------------------------------------------------------------------ */

export async function unassignFromCrew(equipmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .update({ assigned_to_crew: null, status: "available" })
      .eq("id", equipmentId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Equipment, error: null };
  } catch {
    return { data: null, error: "Error al desasignar equipo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Equipment by Crew                                               */
/* ------------------------------------------------------------------ */

export async function getEquipmentByCrew(crewId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .eq("assigned_to_crew", crewId)
      .order("name");

    if (error) return { data: null, error: error.message };
    return { data: data as Equipment[], error: null };
  } catch {
    return { data: null, error: "Error al obtener equipos de la cuadrilla" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Maintenance Due (next 7 days)                                   */
/* ------------------------------------------------------------------ */

export async function getMaintenanceDue() {
  try {
    const supabase = await createClient();
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data, error } = await supabase
      .from("equipment")
      .select("*, crew:crews!assigned_to_crew(id, name)")
      .not("next_maintenance", "is", null)
      .lte("next_maintenance", nextWeek.toISOString().split("T")[0])
      .neq("status", "retired")
      .order("next_maintenance");

    if (error) return { data: null, error: error.message };
    return { data: data as EquipmentWithCrew[], error: null };
  } catch {
    return { data: null, error: "Error al obtener mantenimientos pendientes" };
  }
}
