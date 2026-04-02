"use server";

import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "./storage";
import type { PhotoType, ServicePhoto } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Upload Service Photo                                               */
/* ------------------------------------------------------------------ */

export async function uploadServicePhoto(
  assignmentId: string,
  file: File,
  photoType: PhotoType,
  caption: string | null,
  uploadedBy: string
) {
  try {
    const supabase = await createClient();

    // Build a unique storage path
    const ext = file.name.split(".").pop() ?? "jpg";
    const timestamp = Date.now();
    const storagePath = `${assignmentId}/${photoType}_${timestamp}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await uploadToStorage(storagePath, file);
    if (uploadError) return { data: null, error: uploadError };

    // Insert record
    const { data, error } = await supabase
      .from("service_photos")
      .insert({
        assignment_id: assignmentId,
        uploaded_by: uploadedBy,
        storage_path: storagePath,
        photo_type: photoType,
        caption,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as ServicePhoto, error: null };
  } catch (e) {
    return { data: null, error: "Error al subir foto" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Service Photos                                                 */
/* ------------------------------------------------------------------ */

export async function getServicePhotos(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("service_photos")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at");

    if (error) return { data: null, error: error.message };
    return { data: data as ServicePhoto[], error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener fotos" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Service Photo                                               */
/* ------------------------------------------------------------------ */

export async function deleteServicePhoto(photoId: string) {
  try {
    const supabase = await createClient();

    // Get the storage path first
    const { data: photo, error: fetchError } = await supabase
      .from("service_photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();

    if (fetchError) return { error: fetchError.message };

    // Delete from storage
    const { error: storageError } = await deleteFromStorage(photo.storage_path);
    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete record
    const { error } = await supabase
      .from("service_photos")
      .delete()
      .eq("id", photoId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e) {
    return { error: "Error al eliminar foto" };
  }
}
