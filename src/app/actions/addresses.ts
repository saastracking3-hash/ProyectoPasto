"use server";

import { createClient } from "@/lib/supabase/server";
import type { Address } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Get Client Addresses                                               */
/* ------------------------------------------------------------------ */

export async function getClientAddresses(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("client_id", clientId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as Address[], error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener direcciones" };
  }
}

/* ------------------------------------------------------------------ */
/*  Create Address                                                     */
/* ------------------------------------------------------------------ */

interface CreateAddressInput {
  client_id: string;
  label: string;
  street: string;
  number: string;
  floor_apt?: string;
  city: string;
  zone: string;
  postal_code?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  is_default?: boolean;
}

export async function createAddress(data: CreateAddressInput) {
  try {
    const supabase = await createClient();

    // If this is set as default, unset other defaults first
    if (data.is_default) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("client_id", data.client_id)
        .eq("is_default", true);
    }

    const { data: address, error } = await supabase
      .from("addresses")
      .insert({
        client_id: data.client_id,
        label: data.label,
        street: data.street,
        number: data.number,
        floor_apt: data.floor_apt ?? null,
        city: data.city,
        zone: data.zone,
        postal_code: data.postal_code ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        notes: data.notes ?? null,
        is_default: data.is_default ?? false,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: address as Address, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear direccion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Address                                                     */
/* ------------------------------------------------------------------ */

export async function updateAddress(
  id: string,
  data: Partial<Omit<CreateAddressInput, "client_id">>
) {
  try {
    const supabase = await createClient();

    // If setting as default, unset other defaults
    if (data.is_default) {
      const { data: existing } = await supabase
        .from("addresses")
        .select("client_id")
        .eq("id", id)
        .single();

      if (existing) {
        await supabase
          .from("addresses")
          .update({ is_default: false })
          .eq("client_id", existing.client_id)
          .eq("is_default", true);
      }
    }

    const { data: address, error } = await supabase
      .from("addresses")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: address as Address, error: null };
  } catch (e) {
    return { data: null, error: "Error al actualizar direccion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Address                                                     */
/* ------------------------------------------------------------------ */

export async function deleteAddress(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: "Error al eliminar direccion" };
  }
}
