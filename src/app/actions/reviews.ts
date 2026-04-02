"use server";

import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Create Review                                                      */
/* ------------------------------------------------------------------ */

export async function createReview(
  serviceRequestId: string,
  clientId: string,
  rating: number,
  punctualityRating?: number,
  qualityRating?: number,
  comment?: string
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        service_request_id: serviceRequestId,
        client_id: clientId,
        rating,
        punctuality_rating: punctualityRating ?? null,
        quality_rating: qualityRating ?? null,
        comment: comment ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Review, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear resena" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Review                                                         */
/* ------------------------------------------------------------------ */

export async function getReview(serviceRequestId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("service_request_id", serviceRequestId)
      .single();

    if (error && error.code !== "PGRST116") {
      return { data: null, error: error.message };
    }
    return { data: (data as Review) ?? null, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener resena" };
  }
}
