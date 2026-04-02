"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, X, Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import type { PhotoType } from "@/lib/types";

interface Photo {
  id: string;
  url: string;
  storage_path: string;
  photo_type: PhotoType;
  caption: string | null;
}

const photoTypes: { value: PhotoType; label: string; color: string }[] = [
  { value: "before", label: "Antes", color: "bg-orange-100 text-orange-700" },
  { value: "during", label: "Durante", color: "bg-blue-100 text-blue-700" },
  { value: "after", label: "Despues", color: "bg-green-100 text-green-700" },
];

function SkeletonPhotos() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
        <div>
          <div className="h-6 w-20 bg-gray-200 rounded mb-1" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-20 bg-gray-200 rounded-full" />
        <div className="h-9 w-24 bg-gray-200 rounded-full" />
        <div className="h-9 w-24 bg-gray-200 rounded-full" />
      </div>
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        <div className="aspect-square bg-gray-200 rounded-lg" />
        <div className="aspect-square bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export default function FotosPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<PhotoType>("before");
  const [userId, setUserId] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No se pudo obtener el usuario");
        return;
      }
      setUserId(user.id);

      const { data: servicePhotos, error: fetchError } = await supabase
        .from("service_photos")
        .select("id, storage_path, photo_type, caption")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError("Error al cargar fotos: " + fetchError.message);
        return;
      }

      const mapped: Photo[] = (servicePhotos || []).map((p: any) => {
        const {
          data: { publicUrl },
        } = supabase.storage
          .from("service-photos")
          .getPublicUrl(p.storage_path);

        return {
          id: p.id,
          url: publicUrl,
          storage_path: p.storage_path,
          photo_type: p.photo_type as PhotoType,
          caption: p.caption,
        };
      });

      setPhotos(mapped);
    } catch (err: any) {
      setError("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !userId) return;

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const storagePath = `${assignmentId}/${timestamp}_${selectedType}.jpg`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("service-photos")
          .upload(storagePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) {
          setError("Error al subir foto: " + uploadError.message);
          continue;
        }

        // Insert record
        const { error: insertError } = await supabase
          .from("service_photos")
          .insert({
            assignment_id: assignmentId,
            uploaded_by: userId,
            storage_path: storagePath,
            photo_type: selectedType,
          });

        if (insertError) {
          setError("Error al registrar foto: " + insertError.message);
          continue;
        }
      }

      // Refresh
      await fetchPhotos();
    } catch (err: any) {
      setError("Error inesperado al subir: " + err.message);
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const removePhoto = async (photo: Photo) => {
    setDeleting(photo.id);
    setError(null);

    try {
      const supabase = createClient();

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("service-photos")
        .remove([photo.storage_path]);

      if (storageError) {
        setError("Error al eliminar archivo: " + storageError.message);
        return;
      }

      // Delete record
      const { error: deleteError } = await supabase
        .from("service_photos")
        .delete()
        .eq("id", photo.id);

      if (deleteError) {
        setError("Error al eliminar registro: " + deleteError.message);
        return;
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err: any) {
      setError("Error inesperado: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const groupedPhotos = photoTypes.map((type) => ({
    ...type,
    photos: photos.filter((p) => p.photo_type === type.value),
  }));

  if (loading) return <SkeletonPhotos />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fotos</h1>
          <p className="text-sm text-gray-500">
            {photos.length} fotos subidas
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Type selector */}
      <div className="flex gap-2">
        {photoTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedType(type.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedType === type.value
                ? "bg-green-800 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      <label className="block cursor-pointer">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            uploading
              ? "border-green-400 bg-green-50"
              : "border-gray-300 hover:border-green-400"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={32} className="text-green-600 animate-spin" />
              <p className="text-sm font-medium text-green-700">
                Subiendo...
              </p>
            </div>
          ) : (
            <>
              <Camera size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-600">
                Tomar foto o elegir de galeria
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Subiendo como:{" "}
                {photoTypes.find((t) => t.value === selectedType)?.label}
              </p>
            </>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {/* Photo groups */}
      {groupedPhotos.map((group) => (
        <div key={group.value}>
          {group.photos.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${group.color}`}
                >
                  {group.label}
                </span>
                {group.photos.length} fotos
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {group.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || ""}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo)}
                      disabled={deleting === photo.id}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center disabled:opacity-50"
                    >
                      {deleting === photo.id ? (
                        <Loader2
                          size={10}
                          className="text-white animate-spin"
                        />
                      ) : (
                        <X size={12} className="text-white" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
