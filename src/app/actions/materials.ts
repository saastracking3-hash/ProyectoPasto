"use server";

import { createClient } from "@/lib/supabase/server";
import type { MaterialLog } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Log Material                                                       */
/* ------------------------------------------------------------------ */

export async function logMaterial(
  assignmentId: string,
  name: string,
  quantity: number,
  unit: string | null,
  costCents: number | null,
  loggedBy: string
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("materials_log")
      .insert({
        assignment_id: assignmentId,
        name,
        quantity,
        unit,
        cost_cents: costCents,
        logged_by: loggedBy,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as MaterialLog, error: null };
  } catch (e) {
    return { data: null, error: "Error al registrar material" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Materials                                                      */
/* ------------------------------------------------------------------ */

export async function getMaterials(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("materials_log")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at");

    if (error) return { data: null, error: error.message };
    return { data: data as MaterialLog[], error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener materiales" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Material                                                    */
/* ------------------------------------------------------------------ */

export async function deleteMaterial(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("materials_log")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: "Error al eliminar material" };
  }
}
