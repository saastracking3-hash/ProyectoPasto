"use client";

import { useEffect, useState } from "react";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import { Leaf, Camera, Calendar } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServicePhoto {
  storage_path: string;
  photo_type: string | null;
  publicUrl: string;
}

interface HistorialEntry {
  id: string;
  request_number: number;
  created_at: string;
  service_type: string;
  scheduled_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  notes: string | null;
  street: string;
  number: string;
  zone: string;
  photos: ServicePhoto[];
}

interface MonthGroup {
  key: string; // "2025-03"
  label: string; // "Marzo 2025"
  entries: HistorialEntry[];
}

interface SummaryStats {
  total: number;
  firstDate: string | null;
  hasStreak: boolean; // last 3 consecutive months
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="ml-6 space-y-3">
            <div className="h-28 bg-gray-200 animate-pulse rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  );
}

// ─── Timeline entry card ───────────────────────────────────────────────────────

function EntryCard({ entry }: { entry: HistorialEntry }) {
  const serviceDate =
    entry.scheduled_date || entry.actual_start_at || entry.created_at;

  const formattedDay = (() => {
    try {
      const d = serviceDate.includes("T")
        ? parseISO(serviceDate)
        : new Date(serviceDate);
      return format(d, "d 'de' MMMM", { locale: es });
    } catch {
      return formatDate(serviceDate);
    }
  })();

  const beforePhoto = entry.photos.find((p) => p.photo_type === "before");
  const afterPhoto = entry.photos.find((p) => p.photo_type === "after");
  const hasPhotos = beforePhoto || afterPhoto;

  return (
    <div className="relative flex gap-4">
      {/* Green dot on timeline */}
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-green-600 ring-2 ring-white ring-offset-1 mt-5 shrink-0 z-10" />
        <div className="w-px flex-1 bg-green-100 mt-1" />
      </div>

      {/* Card */}
      <Card className="flex-1 mb-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-base font-bold text-gray-900">
              {entry.service_type}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-500">
              <Calendar size={13} className="shrink-0" />
              <span>{formattedDay}</span>
            </div>
          </div>
          <span className="text-xs text-gray-400 shrink-0 mt-1">
            #{entry.request_number}
          </span>
        </div>

        {/* Address */}
        <p className="text-xs text-gray-400 mb-3">
          {entry.street} {entry.number}
          {entry.zone ? `, ${entry.zone}` : ""}
        </p>

        {/* Photos */}
        {hasPhotos && (
          <div className="flex gap-3 mb-3">
            {beforePhoto && (
              <PhotoThumb url={beforePhoto.publicUrl} label="Antes" />
            )}
            {afterPhoto && (
              <PhotoThumb url={afterPhoto.publicUrl} label="Después" />
            )}
            {!beforePhoto && !afterPhoto && entry.photos.length > 0 && (
              <PhotoThumb url={entry.photos[0].publicUrl} label="Foto" />
            )}
          </div>
        )}

        {/* No photos placeholder */}
        {!hasPhotos && (
          <div className="flex items-center gap-2 text-gray-300 mb-3">
            <Camera size={14} />
            <span className="text-xs">Sin fotos registradas</span>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <p className="text-sm text-gray-500 italic border-t border-gray-100 pt-3">
            &ldquo;{entry.notes}&rdquo;
          </p>
        )}
      </Card>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: SummaryStats }) {
  if (stats.total === 0) return null;

  const firstLabel = (() => {
    if (!stats.firstDate) return null;
    try {
      const d = stats.firstDate.includes("T")
        ? parseISO(stats.firstDate)
        : new Date(stats.firstDate);
      return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return formatDate(stats.firstDate);
    }
  })();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Total services */}
      <Card className="text-center">
        <p className="text-3xl font-bold text-green-800">{stats.total}</p>
        <p className="text-sm text-gray-500 mt-1">
          {stats.total === 1 ? "servicio completado" : "servicios completados"}
        </p>
      </Card>

      {/* First service */}
      {firstLabel && (
        <Card className="text-center sm:col-span-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">
            Tu primer servicio
          </p>
          <p className="text-sm font-semibold text-gray-800">{firstLabel}</p>
        </Card>
      )}

      {/* Streak badge */}
      {stats.hasStreak && (
        <Card className="text-center bg-green-50 border-green-200">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Leaf size={16} className="text-green-700" />
            <p className="text-sm font-bold text-green-800">
              3 meses cuidando tu jardín
            </p>
          </div>
          <p className="text-xs text-green-600">
            Vas en racha — ¡seguí así!
          </p>
        </Card>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HistorialPage() {
  const [groups, setGroups] = useState<MonthGroup[]>([]);
  const [stats, setStats] = useState<SummaryStats>({
    total: 0,
    firstDate: null,
    hasStreak: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistorial() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Fetch completed service requests with related data
        const { data: requests, error: reqError } = await supabase
          .from("service_requests")
          .select(
            `id, request_number, created_at,
             service_types(name),
             addresses(street, number, zone),
             assignments(scheduled_date, actual_start_at, actual_end_at, notes,
               service_photos(storage_path, photo_type)
             )`
          )
          .eq("client_id", user.id)
          .in("status", ["completed_by_crew", "validated", "closed"])
          .order("created_at", { ascending: false });

        if (reqError) throw reqError;

        const raw = requests || [];

        // Build entries
        const entries: HistorialEntry[] = raw.map((r: any) => {
          const assignment =
            Array.isArray(r.assignments) && r.assignments.length > 0
              ? r.assignments[0]
              : r.assignments ?? null;

          const rawPhotos: Array<{ storage_path: string; photo_type: string | null }> =
            assignment?.service_photos ?? [];

          const photos: ServicePhoto[] = rawPhotos.map((p) => ({
            storage_path: p.storage_path,
            photo_type: p.photo_type,
            publicUrl: supabase.storage
              .from("service-photos")
              .getPublicUrl(p.storage_path).data.publicUrl,
          }));

          return {
            id: r.id,
            request_number: r.request_number,
            created_at: r.created_at,
            service_type: r.service_types?.name ?? "Servicio",
            scheduled_date: assignment?.scheduled_date ?? null,
            actual_start_at: assignment?.actual_start_at ?? null,
            actual_end_at: assignment?.actual_end_at ?? null,
            notes: assignment?.notes ?? null,
            street: r.addresses?.street ?? "",
            number: r.addresses?.number ?? "",
            zone: r.addresses?.zone ?? "",
            photos,
          };
        });

        // Group by month
        const groupMap = new Map<string, HistorialEntry[]>();
        for (const entry of entries) {
          const d = entry.created_at.includes("T")
            ? parseISO(entry.created_at)
            : new Date(entry.created_at);
          const key = format(d, "yyyy-MM");
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(entry);
        }

        const monthGroups: MonthGroup[] = Array.from(groupMap.entries()).map(
          ([key, ents]) => {
            const [year, month] = key.split("-").map(Number);
            const label = format(new Date(year, month - 1, 1), "MMMM yyyy", {
              locale: es,
            });
            // Capitalize first letter
            return {
              key,
              label: label.charAt(0).toUpperCase() + label.slice(1),
              entries: ents,
            };
          }
        );
        // Already ordered desc from Supabase, groupMap preserves insertion order
        setGroups(monthGroups);

        // Stats
        const total = entries.length;
        const firstDate =
          total > 0 ? entries[entries.length - 1].created_at : null;

        // Streak: check if there are entries in each of the last 3 months
        const now = new Date();
        const hasStreak = [1, 2, 3].every((offset) => {
          const targetMonth = format(
            startOfMonth(subMonths(now, offset)),
            "yyyy-MM"
          );
          return groupMap.has(targetMonth);
        });

        setStats({ total, firstDate, hasStreak });
      } catch (err: any) {
        setError(err.message || "Error al cargar el historial");
      } finally {
        setLoading(false);
      }
    }

    fetchHistorial();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Leaf size={24} className="text-green-700" />
          <h1 className="text-2xl font-bold text-gray-900">Mi jardín</h1>
        </div>
        <p className="text-gray-500 text-sm">
          La historia de tu espacio verde
        </p>
      </div>

      {/* Body */}
      {error ? (
        <div className="text-center py-12">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-green-800 text-sm font-medium mt-2 underline"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <>
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-200 animate-pulse rounded-xl"
              />
            ))}
          </div>
          <TimelineSkeleton />
        </>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Leaf size={28} />}
            title="Tu historial de jardín está vacío"
            description="Aún no tienes servicios completados. ¡Tu historial de jardín aparecerá aquí!"
          />
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <StatsBar stats={stats} />

          {/* Timeline */}
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="text-sm font-bold text-green-800 uppercase tracking-wider">
                    {group.label}
                  </h2>
                  <div className="flex-1 h-px bg-green-100" />
                </div>

                {/* Entries */}
                <div className="ml-2">
                  {group.entries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
