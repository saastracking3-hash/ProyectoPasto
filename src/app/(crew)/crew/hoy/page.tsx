"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Clock, ChevronRight, CalendarDays, LayoutList, Clock3 } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { ServiceStatus } from "@/lib/types";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import { useToast } from "@/lib/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import RealtimeIndicator from "@/components/ui/RealtimeIndicator";

interface TodayJob {
  id: string;
  requestNumber: number;
  serviceType: string;
  address: string;
  scheduledTime: string;
  scheduledStartTime: string | null; // "HH:MM:SS" raw
  scheduledEndTime: string | null;   // "HH:MM:SS" raw
  status: ServiceStatus;
  clientName: string;
}

// ─── Timeline constants ────────────────────────────────────────────────────────
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 19;
const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 12
const HOUR_HEIGHT_PX = 50; // px per hour
const TOTAL_HEIGHT_PX = TIMELINE_HOURS * HOUR_HEIGHT_PX; // 600px
const TIME_LABEL_WIDTH = 44; // px for the label column

/** Parse "HH:MM:SS" or "HH:MM" into fractional hours (e.g. "09:30" → 9.5) */
function parseTimeToHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m || 0) / 60;
}

/** Convert fractional hours to top offset % inside the timeline */
function hoursToTopPercent(h: number): number {
  return ((h - TIMELINE_START_HOUR) / TIMELINE_HOURS) * 100;
}

function durationPercent(start: number, end: number): number {
  return ((end - start) / TIMELINE_HOURS) * 100;
}

/** Tailwind bg class by status */
function statusColor(status: ServiceStatus): string {
  switch (status) {
    case "crew_assigned":
    case "scheduled":
      return "bg-green-600";
    case "in_transit":
      return "bg-blue-500";
    case "arrived":
      return "bg-teal-500";
    case "in_progress":
      return "bg-green-700";
    case "paused":
      return "bg-amber-500";
    case "completed_by_crew":
    case "validated":
    case "closed":
      return "bg-gray-400";
    default:
      return "bg-green-600";
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-gray-200 rounded" />
          <div className="h-5 w-28 bg-gray-200 rounded-full" />
        </div>
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-28 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ─── Timeline component ────────────────────────────────────────────────────────
function DayTimeline({ jobs }: { jobs: TodayJob[] }) {
  const now = new Date();
  const nowHours = now.getHours() + now.getMinutes() / 60;
  const showNowLine =
    nowHours >= TIMELINE_START_HOUR && nowHours <= TIMELINE_END_HOUR;
  const nowTopPercent = hoursToTopPercent(nowHours);

  // Only jobs with both start and end times
  const timedJobs = jobs.filter(
    (j) => j.scheduledStartTime && j.scheduledEndTime
  );

  const hourLabels = Array.from(
    { length: TIMELINE_HOURS + 1 },
    (_, i) => TIMELINE_START_HOUR + i
  );

  return (
    <div className="overflow-x-auto">
      <div
        className="flex"
        style={{ minWidth: 320 }}
      >
        {/* Hour labels column */}
        <div
          className="flex-shrink-0 relative"
          style={{ width: TIME_LABEL_WIDTH, height: TOTAL_HEIGHT_PX }}
        >
          {hourLabels.map((h, i) => (
            <div
              key={h}
              className="absolute flex items-center justify-end pr-2"
              style={{
                top: i * HOUR_HEIGHT_PX - 9, // center label on the line
                right: 0,
                width: TIME_LABEL_WIDTH,
              }}
            >
              <span className="text-xs text-gray-400 font-mono leading-none select-none">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Main timeline area */}
        <div
          className="relative flex-1 border-l border-gray-200"
          style={{ height: TOTAL_HEIGHT_PX }}
        >
          {/* Hour grid lines */}
          {hourLabels.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: i * HOUR_HEIGHT_PX }}
            />
          ))}

          {/* NOW line */}
          {showNowLine && (
            <div
              className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: `${nowTopPercent}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
              <div className="flex-1 border-t-2 border-red-500" />
              <span className="text-[10px] font-semibold text-red-500 ml-1 pr-1 bg-white">
                AHORA
              </span>
            </div>
          )}

          {/* No timed jobs message */}
          {timedJobs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400">
                Ningún trabajo tiene horario asignado
              </p>
            </div>
          )}

          {/* Job blocks */}
          {timedJobs.map((job) => {
            const startH = parseTimeToHours(job.scheduledStartTime!);
            const endH = parseTimeToHours(job.scheduledEndTime!);
            const clampedStart = Math.max(startH, TIMELINE_START_HOUR);
            const clampedEnd = Math.min(endH, TIMELINE_END_HOUR);
            if (clampedEnd <= clampedStart) return null;

            const topPct = hoursToTopPercent(clampedStart);
            const heightPct = durationPercent(clampedStart, clampedEnd);
            const minHeightPx = 28; // always readable

            return (
              <Link
                key={job.id}
                href={`/crew/trabajos/${job.id}`}
                className="absolute left-2 right-2 z-10 group"
                style={{
                  top: `${topPct}%`,
                  height: `max(${heightPct}%, ${minHeightPx}px)`,
                }}
              >
                <div
                  className={`h-full rounded-lg px-2 py-1 overflow-hidden shadow-sm
                    flex flex-col justify-start gap-0.5 opacity-90
                    hover:opacity-100 transition-opacity cursor-pointer
                    ${statusColor(job.status)}`}
                >
                  <p className="text-white text-[11px] font-semibold leading-tight truncate">
                    {job.serviceType}
                  </p>
                  <p className="text-white/80 text-[10px] leading-tight truncate">
                    {job.address}
                  </p>
                  <p className="text-white/60 text-[9px] leading-tight">
                    {job.scheduledStartTime!.slice(0, 5)} –{" "}
                    {job.scheduledEndTime!.slice(0, 5)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function CrewHoyPage() {
  const [jobs, setJobs] = useState<TodayJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noCrew, setNoCrew] = useState(false);
  const [view, setView] = useState<"lista" | "timeline">("lista");
  const crewIdRef = useRef<string | null>(null);

  const { toasts, addToast, removeToast } = useToast();

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const fetchTodayJobs = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No se pudo obtener el usuario");
        return;
      }

      // Find user's crew
      const { data: crewMember } = await supabase
        .from("crew_members")
        .select("crew_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!crewMember) {
        setNoCrew(true);
        return;
      }

      crewIdRef.current = crewMember.crew_id;

      // Get today's date in YYYY-MM-DD
      const todayDate = new Date().toISOString().split("T")[0];

      // Fetch today's assignments with joins
      const { data: assignments, error: fetchError } = await supabase
        .from("assignments")
        .select(
          `
          id,
          scheduled_start_time,
          scheduled_end_time,
          service_request:service_requests!inner (
            request_number,
            status,
            description,
            client:profiles!service_requests_client_id_fkey ( full_name ),
            service_type:service_types!inner ( name ),
            address:addresses!inner ( street, number, city )
          )
        `
        )
        .eq("crew_id", crewMember.crew_id)
        .eq("scheduled_date", todayDate)
        .order("scheduled_start_time", { ascending: true });

      if (fetchError) {
        setError("Error al cargar los trabajos: " + fetchError.message);
        return;
      }

      const mapped: TodayJob[] = (assignments || []).map((a: any) => {
        const sr = a.service_request;
        const addr = sr.address;
        const timeSlot =
          a.scheduled_start_time && a.scheduled_end_time
            ? `${a.scheduled_start_time.slice(0, 5)} - ${a.scheduled_end_time.slice(0, 5)}`
            : a.scheduled_start_time
              ? a.scheduled_start_time.slice(0, 5)
              : "Sin horario";

        return {
          id: a.id,
          requestNumber: sr.request_number,
          serviceType: sr.service_type.name,
          address: `${addr.street} ${addr.number}, ${addr.city}`,
          scheduledTime: timeSlot,
          scheduledStartTime: a.scheduled_start_time ?? null,
          scheduledEndTime: a.scheduled_end_time ?? null,
          status: sr.status as ServiceStatus,
          clientName: sr.client?.full_name || "Cliente",
        };
      });

      setJobs(mapped);
    } catch (err: any) {
      setError("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime subscription for assignments table
  const { status: realtimeStatus } = useRealtimeSubscription({
    filters: { table: "assignments", event: "INSERT" },
    onPayload: useCallback(() => {
      addToast("Nuevo trabajo asignado", "info");
      fetchTodayJobs(false);
    }, [addToast, fetchTodayJobs]),
  });

  useEffect(() => {
    fetchTodayJobs();
  }, [fetchTodayJobs]);

  const completedStatuses: ServiceStatus[] = [
    "completed_by_crew",
    "validated",
    "closed",
  ];
  const completedCount = jobs.filter((j) =>
    completedStatuses.includes(j.status)
  ).length;
  const pendingCount = jobs.length - completedCount;

  if (noCrew) {
    return (
      <EmptyState
        icon={<CalendarDays size={28} />}
        title="Sin cuadrilla asignada"
        description="No estas asignado a ninguna cuadrilla. Contacta al administrador."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trabajos de hoy</h1>
          <p className="text-sm text-gray-500 capitalize mt-1">{today}</p>
        </div>
        <RealtimeIndicator status={realtimeStatus} />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {loading ? "-" : jobs.length}
          </p>
          <p className="text-xs text-blue-600">Asignados</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">
            {loading ? "-" : completedCount}
          </p>
          <p className="text-xs text-green-600">Completados</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">
            {loading ? "-" : pendingCount}
          </p>
          <p className="text-xs text-amber-600">Pendientes</p>
        </div>
      </div>

      {/* ── Tu día de hoy section ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Section header with toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">Tu día de hoy</h2>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("lista")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "lista"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <LayoutList size={13} />
              Vista lista
            </button>
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "timeline"
                  ? "bg-white shadow-sm text-gray-800"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Clock3 size={13} />
              Vista timeline
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="Sin trabajos hoy"
            description="No tenes trabajos asignados para hoy."
          />
        ) : view === "lista" ? (
          /* ── List view ── */
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/crew/trabajos/${job.id}`}>
                <Card className="hover:border-green-300 transition-colors mb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">
                          #{job.requestNumber}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <h3 className="font-semibold text-gray-900">
                        {job.serviceType}
                      </h3>
                      <p className="text-sm text-gray-500">{job.clientName}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {job.address}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock size={14} />
                        {job.scheduledTime}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300 mt-1" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* ── Timeline view ── */
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <DayTimeline jobs={jobs} />
            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
              {[
                { label: "Asignado", cls: "bg-green-600" },
                { label: "En tránsito", cls: "bg-blue-500" },
                { label: "Llegó", cls: "bg-teal-500" },
                { label: "En progreso", cls: "bg-green-700" },
                { label: "Pausado", cls: "bg-amber-500" },
                { label: "Completado", cls: "bg-gray-400" },
              ].map(({ label, cls }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${cls}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
