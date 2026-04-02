"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, UserRole } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Get All Staff (non-client profiles)                                 */
/* ------------------------------------------------------------------ */

export async function getAllStaff(roleFilter?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("profiles")
      .select(
        "*, crew_member:crew_members(crew_id, role_in_crew, crew:crews(id, name))"
      )
      .neq("role", "client")
      .order("full_name");

    if (roleFilter) {
      query = query.eq("role", roleFilter);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener personal" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Staff Detail                                                    */
/* ------------------------------------------------------------------ */

export async function getStaffDetail(userId: string) {
  try {
    const supabase = await createClient();

    const [profileResult, crewResult, assignmentsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase
        .from("crew_members")
        .select("*, crew:crews(id, name)")
        .eq("user_id", userId)
        .limit(1),
      supabase
        .from("assignments")
        .select(
          "*, service_request:service_requests(request_number, status, service_type:service_types(name), address:addresses(street, number, city))"
        )
        .eq("crew_id", (
          await supabase
            .from("crew_members")
            .select("crew_id")
            .eq("user_id", userId)
            .limit(1)
            .single()
        ).data?.crew_id ?? "00000000-0000-0000-0000-000000000000")
        .order("scheduled_date", { ascending: false })
        .limit(10),
    ]);

    if (profileResult.error)
      return { data: null, error: profileResult.error.message };

    return {
      data: {
        ...profileResult.data,
        crew_info: crewResult.data?.[0] ?? null,
        recent_assignments: assignmentsResult.data ?? [],
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Error al obtener detalle del personal" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Staff Profile                                                */
/* ------------------------------------------------------------------ */

export async function updateStaffProfile(
  userId: string,
  updates: Partial<{
    full_name: string;
    phone: string;
    role: UserRole;
    is_active: boolean;
    avatar_url: string;
  }>
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Profile, error: null };
  } catch {
    return { data: null, error: "Error al actualizar perfil" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create Staff User (admin API)                                       */
/* ------------------------------------------------------------------ */

export async function createStaffUser(
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: UserRole
) {
  try {
    const admin = createAdminClient();

    // Create user in auth
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) return { data: null, error: authError.message };

    // Create profile
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        role,
        is_active: true,
      })
      .eq("id", authData.user.id)
      .select()
      .single();

    if (profileError) {
      // If profile update fails, try insert
      const { data: inserted, error: insertError } = await admin
        .from("profiles")
        .insert({
          id: authData.user.id,
          full_name: fullName,
          phone: phone || null,
          role,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) return { data: null, error: insertError.message };
      return { data: inserted as Profile, error: null };
    }

    return { data: profile as Profile, error: null };
  } catch {
    return { data: null, error: "Error al crear usuario" };
  }
}

/* ------------------------------------------------------------------ */
/*  Deactivate Staff                                                    */
/* ------------------------------------------------------------------ */

export async function deactivateStaff(userId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) return { error: error.message };
    return { error: null };
  } catch {
    return { error: "Error al desactivar personal" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Staff Stats                                                     */
/* ------------------------------------------------------------------ */

export async function getStaffStats(userId: string) {
  try {
    const supabase = await createClient();

    // Get crew_id for the user
    const { data: crewMember } = await supabase
      .from("crew_members")
      .select("crew_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!crewMember) {
      return {
        data: {
          completed_assignments: 0,
          avg_rating: null,
          total_hours: 0,
        },
        error: null,
      };
    }

    // Get completed assignments count
    const { count: completedCount } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("crew_id", crewMember.crew_id)
      .not("actual_end_at", "is", null);

    // Get average review rating for assignments by this crew
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating, service_request_id")
      .in(
        "service_request_id",
        (
          await supabase
            .from("assignments")
            .select("service_request_id")
            .eq("crew_id", crewMember.crew_id)
        ).data?.map((a: { service_request_id: string }) => a.service_request_id) ?? []
      );

    const avgRating =
      reviews && reviews.length > 0
        ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
        : null;

    // Estimate hours from actual start/end
    const { data: timeData } = await supabase
      .from("assignments")
      .select("actual_start_at, actual_end_at")
      .eq("crew_id", crewMember.crew_id)
      .not("actual_start_at", "is", null)
      .not("actual_end_at", "is", null);

    let totalHours = 0;
    if (timeData) {
      for (const row of timeData) {
        const start = new Date(row.actual_start_at).getTime();
        const end = new Date(row.actual_end_at).getTime();
        totalHours += (end - start) / (1000 * 60 * 60);
      }
    }

    return {
      data: {
        completed_assignments: completedCount ?? 0,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        total_hours: Math.round(totalHours),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Error al obtener estadisticas" };
  }
}
