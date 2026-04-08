"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trophy, Star, Crown, Award, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = "week" | "month" | "all";

interface CrewBasic {
  id: string;
  name: string;
}

interface RawAssignment {
  id: string;
  service_request_id: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  scheduled_date: string;
  scheduled_start_time: string | null;
  service_request: { status: string } | null;
}

interface RawReview {
  rating: number;
}

interface CrewMetrics {
  id: string;
  name: string;
  totalCompleted: number;
  jobsThisMonth: number;
  avgRating: number | null;
  onTimeRate: number | null; // 0–100
  avgDurationMin: number | null;
  rank: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = ["completed_by_crew", "validated", "closed"];

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function firstDayOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

/**
 * Given an assignment, decide whether it was on-time.
 * "On-time" = actual_start_at <= scheduled datetime + 30 min tolerance.
 */
function isOnTime(a: RawAssignment): boolean | null {
  if (!a.actual_start_at || !a.scheduled_start_time) return null;

  const [hh, mm] = a.scheduled_start_time.split(":").map(Number);
  const scheduled = new Date(`${a.scheduled_date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
  scheduled.setMinutes(scheduled.getMinutes() + 30); // +30 min tolerance

  const actual = new Date(a.actual_start_at);
  return actual <= scheduled;
}

function computeDurationMin(a: RawAssignment): number | null {
  if (!a.actual_start_at || !a.actual_end_at) return null;
  const diff = new Date(a.actual_end_at).getTime() - new Date(a.actual_start_at).getTime();
  return Math.round(diff / 60000);
}

function avgOrNull(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  const filled = value ? Math.round(value) : 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={16}
          className={i <= filled ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
        />
      ))}
      {value !== null && (
        <span className="ml-1.5 text-sm text-gray-500 tabular-nums">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function OnTimeBar({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <p className="text-xs text-gray-400 italic">Sin datos</p>;
  }
  const pct = Math.round(rate);
  const color =
    pct >= 85 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Puntualidad</span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
        <Crown size={12} className="text-yellow-600" />
        #1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700">
        <Award size={12} className="text-gray-500" />
        #2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
        <Award size={12} className="text-orange-500" />
        #3
      </span>
    );
  return (
    <span className="text-xs text-gray-400 font-medium">#{rank}</span>
  );
}

function CrewCard({
  crew,
  isTopRated,
}: {
  crew: CrewMetrics;
  isTopRated: boolean;
}) {
  return (
    <div
      className={`relative bg-white rounded-xl border-2 p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${
        isTopRated ? "border-yellow-300 shadow-yellow-100 shadow-md" : "border-gray-100"
      }`}
    >
      {/* Top-rated ribbon */}
      {isTopRated && (
        <div className="absolute -top-3 left-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900 shadow-sm">
            <TrendingUp size={11} />
            Mejor calificado
          </span>
        </div>
      )}

      {/* Header: name + rank */}
      <div className="flex items-start justify-between gap-2 pt-1">
        <h3 className="text-base font-bold text-gray-900 leading-tight">{crew.name}</h3>
        <RankBadge rank={crew.rank} />
      </div>

      {/* Star rating */}
      <div>
        {crew.avgRating !== null ? (
          <StarRating value={crew.avgRating} />
        ) : (
          <p className="text-xs text-gray-400 italic">Sin calificaciones</p>
        )}
      </div>

      {/* Job counters */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{crew.totalCompleted}</p>
          <p className="text-xs text-gray-500 leading-tight">trabajos completados</p>
        </div>
        <div className="w-px h-10 bg-gray-100" />
        <div className="text-center">
          <p className="text-xl font-semibold text-green-700 tabular-nums">{crew.jobsThisMonth}</p>
          <p className="text-xs text-gray-500 leading-tight">este mes</p>
        </div>
        {crew.avgDurationMin !== null && (
          <>
            <div className="w-px h-10 bg-gray-100" />
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-700 tabular-nums">
                {crew.avgDurationMin}
                <span className="text-sm font-normal">m</span>
              </p>
              <p className="text-xs text-gray-500 leading-tight">durac. prom.</p>
            </div>
          </>
        )}
      </div>

      {/* On-time bar */}
      <OnTimeBar rate={crew.onTimeRate} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrewPerformancePage() {
  const [range, setRange] = useState<DateRange>("month");
  const [crews, setCrews] = useState<CrewMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      // 1. Fetch all active crews
      const { data: crewsData, error: crewErr } = await supabase
        .from("crews")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (crewErr) throw crewErr;
      const crewList: CrewBasic[] = crewsData || [];

      // 2. For each crew, fetch assignments + reviews in parallel
      const thisMonth = firstDayOfMonth();
      const thisWeek = firstDayOfWeek();

      const metricsArr: CrewMetrics[] = await Promise.all(
        crewList.map(async (crew) => {
          // Assignments query
          const { data: assignments } = await supabase
            .from("assignments")
            .select(
              "id, service_request_id, actual_start_at, actual_end_at, scheduled_date, scheduled_start_time, service_request:service_requests!inner(status)"
            )
            .eq("crew_id", crew.id) as { data: RawAssignment[] | null };

          const allAssignments: RawAssignment[] = assignments || [];

          // Filter completed
          const completed = allAssignments.filter((a) =>
            a.service_request && COMPLETED_STATUSES.includes(a.service_request.status)
          );

          // Jobs this period
          const periodStart =
            range === "week" ? thisWeek : range === "month" ? thisMonth : null;

          const periodCompleted = periodStart
            ? completed.filter((a) => a.scheduled_date >= periodStart)
            : completed;

          const totalCompleted = completed.length;
          const jobsThisMonth = periodCompleted.length;

          // On-time rate (across all completed with enough data)
          const onTimeChecks = completed
            .map(isOnTime)
            .filter((v): v is boolean => v !== null);
          const onTimeRate =
            onTimeChecks.length > 0
              ? (onTimeChecks.filter(Boolean).length / onTimeChecks.length) * 100
              : null;

          // Average duration
          const durations = completed
            .map(computeDurationMin)
            .filter((v): v is number => v !== null && v > 0);
          const avgDurationMin = avgOrNull(durations);

          // Collect service_request_ids for completed assignments
          const completedSrIds = completed
            .map((a) => a.service_request_id)
            .filter(Boolean);

          // Fetch reviews linked to this crew's completed assignments
          const { data: reviews } =
            completedSrIds.length > 0
              ? await (supabase
                  .from("reviews")
                  .select("rating")
                  .in("service_request_id", completedSrIds) as Promise<{ data: RawReview[] | null; error: unknown }>)
              : { data: [] as RawReview[], error: null };

          const ratings = (reviews || []).map((r) => r.rating);
          const avgRating = avgOrNull(ratings);

          return {
            id: crew.id,
            name: crew.name,
            totalCompleted,
            jobsThisMonth,
            avgRating,
            onTimeRate: onTimeRate !== null ? Math.round(onTimeRate) : null,
            avgDurationMin: avgDurationMin !== null ? Math.round(avgDurationMin) : null,
            rank: 0, // assigned after sort
          };
        })
      );

      // Sort by total completed desc, break ties by avgRating desc
      metricsArr.sort((a, b) => {
        if (b.totalCompleted !== a.totalCompleted)
          return b.totalCompleted - a.totalCompleted;
        return (b.avgRating ?? 0) - (a.avgRating ?? 0);
      });

      // Assign ranks
      metricsArr.forEach((c, i) => { c.rank = i + 1; });

      setCrews(metricsArr);
    } catch (e) {
      console.error(e);
      setError("Error al cargar datos de rendimiento");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Top rated crew (by avgRating, ignoring nulls)
  const topRatedId =
    crews.reduce<CrewMetrics | null>((best, c) => {
      if (c.avgRating === null) return best;
      if (best === null || c.avgRating > (best.avgRating ?? 0)) return c;
      return best;
    }, null)?.id ?? null;

  const RANGES: { key: DateRange; label: string }[] = [
    { key: "week", label: "Esta semana" },
    { key: "month", label: "Este mes" },
    { key: "all", label: "Total" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-100 rounded-xl">
            <Trophy size={22} className="text-yellow-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rendimiento de Cuadrillas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Comparativa de desempeno por equipo
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Date range toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRange(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              range === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-gray-100 animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && crews.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Trophy size={36} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No hay cuadrillas activas</p>
          <p className="text-gray-400 text-sm mt-1">
            Activa cuadrillas en la seccion de Cuadrillas para ver el rendimiento.
          </p>
        </div>
      )}

      {/* Crew cards grid */}
      {!loading && crews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {crews.map((crew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              isTopRated={crew.id === topRatedId && crew.avgRating !== null}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {!loading && crews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryTile
            label="Cuadrillas activas"
            value={crews.length}
            unit=""
          />
          <SummaryTile
            label="Trabajos completados"
            value={crews.reduce((s, c) => s + c.totalCompleted, 0)}
            unit=""
          />
          <SummaryTile
            label="Calificacion promedio"
            value={
              (() => {
                const rated = crews.filter((c) => c.avgRating !== null);
                if (rated.length === 0) return null;
                return rated.reduce((s, c) => s + c.avgRating!, 0) / rated.length;
              })()
            }
            unit=" / 5"
            decimals={1}
          />
          <SummaryTile
            label="Puntualidad promedio"
            value={
              (() => {
                const withData = crews.filter((c) => c.onTimeRate !== null);
                if (withData.length === 0) return null;
                return withData.reduce((s, c) => s + c.onTimeRate!, 0) / withData.length;
              })()
            }
            unit="%"
            decimals={0}
          />
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  unit: string;
  decimals?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-2xl font-bold text-gray-900 tabular-nums">
        {value !== null ? value.toFixed(decimals) : "—"}
        {value !== null && unit}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
