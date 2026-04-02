"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Get Checklist                                                      */
/* ------------------------------------------------------------------ */

export async function getChecklist(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checklists")
      .select("*, items:checklist_items(*)")
      .eq("assignment_id", assignmentId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener checklist" };
  }
}

/* ------------------------------------------------------------------ */
/*  Toggle Checklist Item                                              */
/* ------------------------------------------------------------------ */

export async function toggleChecklistItem(
  itemId: string,
  completedBy: string
) {
  try {
    const supabase = await createClient();

    // Get current state
    const { data: item, error: fetchError } = await supabase
      .from("checklist_items")
      .select("is_completed")
      .eq("id", itemId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const nowCompleted = !item.is_completed;

    const { data, error } = await supabase
      .from("checklist_items")
      .update({
        is_completed: nowCompleted,
        completed_at: nowCompleted ? new Date().toISOString() : null,
        completed_by: nowCompleted ? completedBy : null,
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al actualizar item" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Checklist Item Notes                                        */
/* ------------------------------------------------------------------ */

export async function updateChecklistItemNotes(
  itemId: string,
  notes: string
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("checklist_items")
      .update({ notes })
      .eq("id", itemId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al actualizar notas" };
  }
}
