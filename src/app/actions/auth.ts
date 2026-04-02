"use server";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSession() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) return { data: null, error: error.message };
    return { data: session, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener la sesion" };
  }
}

export async function getProfile() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Profile, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener el perfil" };
  }
}

export async function signOut() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: "Error al cerrar sesion" };
  }
}
