"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ServiceStatus } from "@/lib/types";
import {
  MapPin,
  Clock,
  Users,
  Navigation,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
} from "lucide-react";

interface LiveAssignment {
  assignmentId: string;
  serviceRequestId: string;
  requestNumber: number;
  status: ServiceStatus;
  crewName: string;
  clientName: string;
  street: string;
  number: string;
  city: string;
  lat: number | null;
  lng: number | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  lastLocationAt: string | null;
  crewLat: number | null;
  crewLng: number | null;
}

const STATUS_ORDER: ServiceStatus[] = [
  "in_transit",
  "arrived",
  "in_progress",
  "paused",
  "completed_by_crew",
  "crew_assigned",
  "scheduled",
];

function statusGroup(status: ServiceStatus): string {
  if (status === "in_transit") return "En camino";
  if (status === "arrived") return "En el lugar";
  if (status === "in_progress") return "Trabajando";
  if (status === "paused") return "Pausado";
  if (status === "completed_by_crew") return "Finalizado";
  if (status === "crew_assigned") return "Asignado";
  return "Programado";
}

function statusDot(status: ServiceStatus): string {
  if (status === "in_transit") return "bg-blue-500";
  if (status === "arrived") return "bg-teal-500";
  if (status === "in_progress") return "bg-green-500 animate-pulse";
  if (status === "paused") return "bg-amber-500";
  if (status === "completed_by_crew") return "bg-gray-400";
  return "bg-gray-300";
}

function timeSince(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function DailyActivityPage() {
  const [assignments, setAssignments] = useState<LiveAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("assignments")
      .select(`
        id,
        scheduled_start_time,
        scheduled_end_time,
        service_request:service_requests!inner (
          id,
          request_number,
          status,
          client:profiles!service_requests_client_id_fkey ( full_name ),
          address:addresses!inner ( street, number, city, lat, lng )
        ),
        crew:crews!inner ( name )
      `)
      .eq("scheduled_date", today)
      .order("scheduled_start_time", { ascending: true });

    if (error || !data) return;

    const assignmentIds = data.map((a) => a.id);

    // Fetch latest crew locations
    let locationMap: Record<string, { lat: number; lng: number; updated_at: string }> = {};
    if (assignmentIds.length > 0) {
      const { data: locs } = await supabase
        .from("crew_locations")
        .select("assignment_id, lat, lng, updated_at")
        .in("assignment_id", assignmentIds);

      if (locs) {
        locs.forEach((l) => {
          locationMap[l.assignment_id] = { lat: l.lat, lng: l.lng, updated_at: l.updated_at };
        });
      }
    }

    const mapped: LiveAssignment[] = data.map((a) => {
      const sr = a.service_request as any;
      const addr = sr.address;
      const loc = locationMap[a.id] || null;
      return {
        assignmentId: a.id,
        serviceRequestId: sr.id,
        requestNumber: sr.request_number,
        status: sr.status as ServiceStatus,
        crewName: (a.crew as any)?.name || "Cuadrilla",
        clientName: sr.client?.full_name || "Cliente",
        street: addr.street,
        number: addr.number,
        city: addr.city,
        lat: addr.lat,
        lng: addr.lng,
        scheduledStartTime: a.scheduled_start_time,
        scheduledEndTime: a.scheduled_end_time,
        lastLocationAt: loc?.updated_at || null,
        crewLat: loc?.lat || null,
        crewLng: loc?.lng || null,
      };
    });

    // Sort by status priority
    mapped.sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    setAssignments(mapped);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Realtime subscription for service_requests status changes
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    const channel = supabase
      .channel("daily-activity")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_requests" },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crew_locations" },
        () => { fetchData(); }
      )
      .subscribe();

    // Auto-refresh every 30s
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData]);

  const activeCount = assignments.filter(
    (a) => ["in_transit", "arrived", "in_progress", "paused"].includes(a.status)
  ).length;

  const completedCount = assignments.filter(
    (a) => a.status === "completed_by_crew"
  ).length;

  const openMaps = (a: LiveAssignment) => {
    const dest =
      a.lat && a.lng
        ? `${a.lat},${a.lng}`
        : encodeURIComponent(`${a.street} ${a.number}, ${a.city}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitoreo en vivo ·{" "}
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total hoy</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-800">{activeCount}</p>
          <p className="text-xs text-green-700 mt-0.5">En curso</p>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{completedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Finalizados</p>
        </div>
      </div>

      {/* Live feed */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={32} className="text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay trabajos programados para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const isActive = ["in_transit", "arrived", "in_progress"].includes(a.status);
            const hasLocation = !!a.crewLat && !!a.crewLng;

            return (
              <div
                key={a.assignmentId}
                className={`bg-white rounded-xl border-2 p-4 transition-all ${
                  isActive ? "border-green-200 shadow-sm" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: status dot + crew */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${statusDot(a.status)}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {a.crewName}
                        </span>
                        <span className="text-xs text-gray-400">#{a.requestNumber}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{a.clientName}</p>
                    </div>
                  </div>

                  {/* Right: status badge */}
                  <div className="shrink-0">
                    <StatusBadge status={a.status} size="sm" />
                  </div>
                </div>

                {/* Address + time */}
                <div className="mt-3 flex items-start gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">
                      {a.street} {a.number}, {a.city}
                    </span>
                  </div>
                  {a.scheduledStartTime && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock size={12} />
                      <span>
                        {a.scheduledStartTime.slice(0, 5)}
                        {a.scheduledEndTime ? ` - ${a.scheduledEndTime.slice(0, 5)}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* GPS / no-GPS info */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasLocation ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                        <Radio size={10} className="animate-pulse" />
                        GPS activo · hace {timeSince(a.lastLocationAt!)}
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                        <AlertCircle size={10} />
                        Sin GPS
                      </span>
                    ) : a.status === "completed_by_crew" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                        <CheckCircle2 size={10} />
                        {statusGroup(a.status)}
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => openMaps(a)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Navigation size={12} />
                    Ver en mapa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-4">
        Ultima actualizacion: {lastRefresh.toLocaleTimeString("es-AR")} · se actualiza cada 30s
      </p>
    </div>
  );
}
