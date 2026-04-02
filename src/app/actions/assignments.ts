"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Create Assignment                                                  */
/* ------------------------------------------------------------------ */

export async function createAssignment(
  serviceRequestId: string,
  crewId: string,
  scheduledDate: string,
  startTime: string | null,
  endTime: string | null,
  assignedBy: string
) {
  try {
    const supabase = await createClient();

    // Create the assignment
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
      .insert({
        service_request_id: serviceRequestId,
        crew_id: crewId,
        assigned_by: assignedBy,
        scheduled_date: scheduledDate,
        scheduled_start_time: startTime,
        scheduled_end_time: endTime,
      })
      .select()
      .single();

    if (assignError) return { data: null, error: assignError.message };

    // Update service request status to crew_assigned
    const { data: sr } = await supabase
      .from("service_requests")
      .select("status, service_type_id")
      .eq("id", serviceRequestId)
      .single();

    if (sr) {
      await supabase
        .from("service_requests")
        .update({
          status: "crew_assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", serviceRequestId);

      // State log
      await supabase.from("service_state_log").insert({
        service_request_id: serviceRequestId,
        from_status: sr.status,
        to_status: "crew_assigned",
        changed_by: assignedBy,
        notes: "Cuadrilla asignada",
      });

      // Create checklist from template if one exists
      const { data: template } = await supabase
        .from("checklist_templates")
        .select("id")
        .eq("service_type_id", sr.service_type_id)
        .limit(1)
        .single();

      if (template) {
        // Create the checklist
        const { data: checklist } = await supabase
          .from("checklists")
          .insert({
            assignment_id: assignment.id,
            template_id: template.id,
          })
          .select()
          .single();

        if (checklist) {
          // Copy template items into checklist items
          const { data: templateItems } = await supabase
            .from("checklist_template_items")
            .select("description, sort_order, is_required")
            .eq("template_id", template.id)
            .order("sort_order");

          if (templateItems && templateItems.length > 0) {
            const checklistItems = templateItems.map((ti) => ({
              checklist_id: checklist.id,
              description: ti.description,
              sort_order: ti.sort_order,
              is_completed: false,
            }));

            await supabase.from("checklist_items").insert(checklistItems);
          }
        }
      }
    }

    return { data: assignment, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear la asignacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Assignment Detail                                                  */
/* ------------------------------------------------------------------ */

export async function getAssignmentDetail(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `*,
        service_request:service_requests(*,
          service_type:service_types(*),
          address:addresses(*),
          client:profiles!client_id(full_name, phone)
        ),
        crew:crews(*, members:crew_members(*, profile:profiles!user_id(full_name, phone, avatar_url))),
        checklist:checklists(*, items:checklist_items(*)),
        photos:service_photos(*),
        materials:materials_log(*)`
      )
      .eq("id", assignmentId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener detalle de asignacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Agenda Week                                                        */
/* ------------------------------------------------------------------ */

export async function getAgendaWeek(startDate: string, endDate: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("assignments")
      .select(
        `*,
        service_request:service_requests(request_number, status, service_type:service_types(name), address:addresses(street, number, city, zone), client:profiles!client_id(full_name)),
        crew:crews(name)`
      )
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
      .order("scheduled_date")
      .order("scheduled_start_time");

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener agenda" };
  }
}
