"use server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "service-photos";

/* ------------------------------------------------------------------ */
/*  Upload file to storage                                             */
/* ------------------------------------------------------------------ */

export async function uploadToStorage(
  path: string,
  file: File
): Promise<{ data: { path: string } | null; error: string | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) return { data: null, error: error.message };
    return { data: { path: data.path }, error: null };
  } catch (e) {
    return { data: null, error: "Error al subir archivo" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get public URL for a storage path                                  */
/* ------------------------------------------------------------------ */

export async function getStoragePublicUrl(path: string) {
  try {
    const supabase = await createClient();
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { data: data.publicUrl, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener URL publica" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete file from storage                                           */
/* ------------------------------------------------------------------ */

export async function deleteFromStorage(path: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: "Error al eliminar archivo" };
  }
}
