"use server";

import { createClient } from "@/lib/supabase/server";
import type { Crew } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Get All Crews                                                      */
/* ------------------------------------------------------------------ */

export async function getCrews() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crews")
      .select("*, members:crew_members(count)")
      .eq("is_active", true)
      .order("name");

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener cuadrillas" };
  }
}

/* ------------------------------------------------------------------ */
/*  Crew Detail                                                        */
/* ------------------------------------------------------------------ */

export async function getCrewDetail(crewId: string) {
  try {
    const supabase = await createClient();

    const [crewResult, membersResult, assignmentsResult] = await Promise.all([
      supabase.from("crews").select("*").eq("id", crewId).single(),
      supabase
        .from("crew_members")
        .select("*, profile:profiles!user_id(id, full_name, phone, avatar_url, role)")
        .eq("crew_id", crewId),
      supabase
        .from("assignments")
        .select(
          "*, service_request:service_requests(request_number, status, service_type:service_types(name), address:addresses(street, number, city))"
        )
        .eq("crew_id", crewId)
        .order("scheduled_date", { ascending: false })
        .limit(10),
    ]);

    if (crewResult.error) return { data: null, error: crewResult.error.message };

    return {
      data: {
        ...crewResult.data,
        members: membersResult.data ?? [],
        recent_assignments: assignmentsResult.data ?? [],
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: "Error al obtener detalle de cuadrilla" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create Crew                                                        */
/* ------------------------------------------------------------------ */

export async function createCrew(name: string, zone?: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crews")
      .insert({ name, zone: zone ?? null, is_active: true })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Crew, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear cuadrilla" };
  }
}

/* ------------------------------------------------------------------ */
/*  Add Crew Member                                                    */
/* ------------------------------------------------------------------ */

export async function addCrewMember(
  crewId: string,
  userId: string,
  role: "leader" | "operator"
) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("crew_members")
      .insert({ crew_id: crewId, user_id: userId, role_in_crew: role })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // If adding a leader, update the crew's leader_id
    if (role === "leader") {
      await supabase
        .from("crews")
        .update({ leader_id: userId })
        .eq("id", crewId);
    }

    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al agregar miembro" };
  }
}

/* ------------------------------------------------------------------ */
/*  Remove Crew Member                                                 */
/* ------------------------------------------------------------------ */

export async function removeCrewMember(crewId: string, userId: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("crew_members")
      .delete()
      .eq("crew_id", crewId)
      .eq("user_id", userId);

    if (error) return { error: error.message };

    // If removed member was the leader, clear leader_id
    const { data: crew } = await supabase
      .from("crews")
      .select("leader_id")
      .eq("id", crewId)
      .single();

    if (crew?.leader_id === userId) {
      await supabase
        .from("crews")
        .update({ leader_id: null })
        .eq("id", crewId);
    }

    return { error: null };
  } catch (e) {
    return { error: "Error al remover miembro" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get User Crew ID                                                   */
/* ------------------------------------------------------------------ */

export async function getUserCrewId(userId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("crew_members")
      .select("crew_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data.crew_id as string, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener cuadrilla del usuario" };
  }
}
