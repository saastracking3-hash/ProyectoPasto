"use client";

import { useEffect, useState } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Star,
  Wrench,
  Trophy,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types";

interface ProfileData {
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  crewName: string | null;
  crewZone: string | null;
  roleInCrew: string | null;
}

interface PerformanceData {
  totalCompleted: number;
  avgRating: number | null;
  streak: number;
  checklistRate: number | null;
  bestWeekJobs: number;
  thisMonthJobs: number;
  lastMonthJobs: number;
}

// ---------- Level system ----------
interface Level {
  label: string;
  min: number;
  max: number | null;
  next: string | null;
  crown: boolean;
}

const LEVELS: Level[] = [
  { label: "Aprendiz",         min: 0,   max: 9,   next: "Jardinero",        crown: false },
  { label: "Jardinero",        min: 10,  max: 24,  next: "Jardinero Pro",    crown: false },
  { label: "Jardinero Pro",    min: 25,  max: 49,  next: "Jardinero Expert", crown: false },
  { label: "Jardinero Expert", min: 50,  max: 99,  next: "Maestro Jardinero",crown: false },
  { label: "Maestro Jardinero",min: 100, max: null,next: null,               crown: true  },
];

function getLevel(total: number): Level {
  for (const lvl of LEVELS) {
    if (lvl.max === null || total <= lvl.max) return lvl;
  }
  return LEVELS[LEVELS.length - 1];
}

function getLevelProgress(total: number): { pct: number; remaining: number } {
  const lvl = getLevel(total);
  if (lvl.max === null) return { pct: 100, remaining: 0 };
  const range = lvl.max - lvl.min + 1;
  const done  = total - lvl.min;
  const pct   = Math.round((done / range) * 100);
  return { pct, remaining: lvl.max + 1 - total };
}

// ---------- Skeleton ----------
function SkeletonProfile() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
          <div className="space-y-2">
            <div className="h-5 w-36 bg-gray-200 rounded" />
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
      {/* Skeleton for Mi desempeño */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-36 bg-gray-200 rounded" />
        <div className="h-10 w-48 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full" />
      </div>
    </div>
  );
}

// ---------- Main page ----------
export default function CrewPerfilPage() {
  const [profile, setProfile]       = useState<ProfileData | null>(null);
  const [perf, setPerf]             = useState<PerformanceData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Legacy stats kept for the basic Estadisticas card
  const [jobsThisMonth, setJobsThisMonth] = useState(0);
  const [avgRating, setAvgRating]         = useState<number | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const supabase = createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No se pudo obtener el usuario"); return; }

        // --- Profile ---
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, role")
          .eq("id", user.id)
          .single();

        if (profileError) { setError("Error al cargar perfil: " + profileError.message); return; }

        // --- Crew membership ---
        const { data: crewMember } = await supabase
          .from("crew_members")
          .select(`role_in_crew, crew:crews!inner ( id, name, zone )`)
          .eq("user_id", user.id)
          .maybeSingle();

        const crew = crewMember?.crew as any;

        setProfile({
          fullName:    profileData.full_name,
          email:       user.email || "",
          phone:       profileData.phone,
          role:        profileData.role as UserRole,
          crewName:    crew?.name  || null,
          crewZone:    crew?.zone  || null,
          roleInCrew:  crewMember?.role_in_crew || null,
        });

        if (!crewMember || !crew) { setLoading(false); return; }

        const now          = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

        // --- All completed assignments (for total count, checklist, streak, best week) ---
        const { data: allCompleted } = await supabase
          .from("assignments")
          .select("id, service_request_id, scheduled_date, actual_end_at")
          .eq("crew_id", crew.id)
          .not("actual_end_at", "is", null);

        const totalCompleted = allCompleted?.length ?? 0;

        // --- This month count ---
        const thisMonthCount = allCompleted?.filter((a) => {
          const d = a.scheduled_date;
          return d && d >= thisMonthStart && d <= thisMonthEnd;
        }).length ?? 0;
        setJobsThisMonth(thisMonthCount);

        // --- Last month count ---
        const lastMonthCount = allCompleted?.filter((a) => {
          const d = a.scheduled_date;
          return d && d >= lastMonthStart && d <= lastMonthEnd;
        }).length ?? 0;

        // --- Best week ---
        const weekCounts: Record<string, number> = {};
        for (const a of allCompleted ?? []) {
          if (!a.scheduled_date) continue;
          const d   = new Date(a.scheduled_date);
          const day = d.getDay(); // 0=Sun
          const mon = new Date(d);
          mon.setDate(d.getDate() - ((day + 6) % 7)); // Monday of that week
          const key = mon.toISOString().split("T")[0];
          weekCounts[key] = (weekCounts[key] ?? 0) + 1;
        }
        const bestWeekJobs = Object.values(weekCounts).length > 0
          ? Math.max(...Object.values(weekCounts))
          : 0;

        // --- Streak: consecutive weeks (Mon–Sun) with >= 1 completed job ---
        let streak = 0;
        const today      = new Date();
        const todayDay   = today.getDay();
        // Start from the Monday of the current week
        const curMonday  = new Date(today);
        curMonday.setDate(today.getDate() - ((todayDay + 6) % 7));
        curMonday.setHours(0, 0, 0, 0);

        for (let w = 0; w < 52; w++) {
          const weekStart = new Date(curMonday);
          weekStart.setDate(curMonday.getDate() - w * 7);
          const weekEnd   = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const ws = weekStart.toISOString().split("T")[0];
          const we = weekEnd.toISOString().split("T")[0];

          const hasJob = (allCompleted ?? []).some((a) => {
            const d = a.scheduled_date;
            return d && d >= ws && d <= we;
          });

          // Allow current week to count even if not finished
          if (hasJob || w === 0) {
            if (hasJob) streak++;
            // If current week has no job yet, streak might still continue from last week
            if (!hasJob && w === 0) { /* don't break, check previous week */ continue; }
            if (!hasJob) break;
          } else {
            break;
          }
        }

        // --- Average rating ---
        let computedAvgRating: number | null = null;
        if (allCompleted && allCompleted.length > 0) {
          const srIds = allCompleted.map((a) => a.service_request_id).filter(Boolean);
          if (srIds.length > 0) {
            const { data: reviews } = await supabase
              .from("reviews")
              .select("rating")
              .in("service_request_id", srIds);

            if (reviews && reviews.length > 0) {
              const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
              computedAvgRating = Math.round((sum / reviews.length) * 10) / 10;
            }
          }
        }
        setAvgRating(computedAvgRating);

        // --- Checklist completion rate ---
        let checklistRate: number | null = null;
        if (allCompleted && allCompleted.length > 0) {
          const assignmentIds = allCompleted.map((a) => a.id);
          const { data: checklistItems } = await supabase
            .from("checklist_items")
            .select("id, completed")
            .in("assignment_id", assignmentIds);

          if (checklistItems && checklistItems.length > 0) {
            const completedItems = checklistItems.filter((ci) => ci.completed).length;
            checklistRate = Math.round((completedItems / checklistItems.length) * 100);
          }
        }

        setPerf({
          totalCompleted,
          avgRating:     computedAvgRating,
          streak,
          checklistRate,
          bestWeekJobs,
          thisMonthJobs: thisMonthCount,
          lastMonthJobs: lastMonthCount,
        });
      } catch (err: any) {
        setError("Error inesperado: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  if (loading) return <SkeletonProfile />;

  if (!profile) {
    return (
      <div className="py-16 text-center text-gray-500">
        {error || "No se pudo cargar el perfil"}
      </div>
    );
  }

  const roleInCrewLabel =
    profile.roleInCrew === "leader"
      ? "Jefe de cuadrilla"
      : profile.roleInCrew === "operator"
        ? "Operario"
        : ROLE_LABELS[profile.role];

  // ---------- Derived performance values ----------
  const total     = perf?.totalCompleted ?? 0;
  const level     = getLevel(total);
  const { pct, remaining } = getLevelProgress(total);

  const monthTrend =
    perf && perf.lastMonthJobs > 0
      ? perf.thisMonthJobs > perf.lastMonthJobs
        ? "up"
        : perf.thisMonthJobs < perf.lastMonthJobs
          ? "down"
          : "flat"
      : perf && perf.thisMonthJobs > 0
        ? "up"
        : "flat";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* --- Identity card --- */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <User size={28} className="text-green-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{profile.fullName}</h2>
            <p className="text-sm text-gray-500">{roleInCrewLabel}</p>
            {profile.crewName && (
              <p className="text-sm text-green-600">{profile.crewName}</p>
            )}
          </div>
        </div>
      </Card>

      {/* --- Contact info --- */}
      <Card>
        <CardHeader>
          <CardTitle>Informacion</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-gray-400" />
            <span>{profile.email}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gray-400" />
              <a href={`tel:${profile.phone}`} className="text-green-700">
                {profile.phone}
              </a>
            </div>
          )}
          {profile.crewZone && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-gray-400" />
              <span>{profile.crewZone}</span>
            </div>
          )}
        </div>
      </Card>

      {/* --- Legacy quick stats --- */}
      <Card>
        <CardHeader>
          <CardTitle>Estadisticas</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Wrench size={20} className="mx-auto text-green-700 mb-1" />
            <p className="text-2xl font-bold text-gray-900">{jobsThisMonth}</p>
            <p className="text-xs text-gray-500">Trabajos este mes</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Star size={20} className="mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900">
              {avgRating !== null ? avgRating : "-"}
            </p>
            <p className="text-xs text-gray-500">Calificacion promedio</p>
          </div>
        </div>
      </Card>

      {/* ============================================================
          MI DESEMPEÑO — gamified section
      ============================================================ */}
      {perf && (
        <Card className="border-green-200 bg-gradient-to-br from-white to-green-50">
          <CardHeader>
            <CardTitle>Mi desempeño</CardTitle>
          </CardHeader>

          {/* Level badge */}
          <div className="flex items-center gap-3 mb-5 p-3 bg-green-700 rounded-xl text-white">
            {level.crown ? (
              <span className="text-2xl">👑</span>
            ) : (
              <Trophy size={24} className="text-yellow-300 shrink-0" />
            )}
            <div>
              <p className="text-xs font-medium text-green-200 uppercase tracking-wide">
                Nivel actual
              </p>
              <p className="text-lg font-bold">{level.label}</p>
            </div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {/* Total jobs */}
            <div className="text-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <Wrench size={18} className="mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-extrabold text-gray-900 leading-none">
                {perf.totalCompleted}
              </p>
              <p className="text-xs text-gray-500 mt-1">trabajos</p>
            </div>

            {/* Rating */}
            <div className="text-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <Star size={18} className="mx-auto text-amber-400 mb-1" />
              <p className="text-2xl font-extrabold text-gray-900 leading-none">
                {perf.avgRating !== null ? perf.avgRating : "-"}
                {perf.avgRating !== null && (
                  <span className="text-sm font-normal text-amber-400">★</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">rating</p>
            </div>

            {/* Streak */}
            <div className="text-center p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <Zap size={18} className="mx-auto text-orange-500 mb-1" />
              <p className="text-2xl font-extrabold text-gray-900 leading-none">
                {perf.streak}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {perf.streak === 1 ? "sem. racha" : "sem. racha"}
              </p>
            </div>
          </div>

          {/* Progress bar to next level */}
          {level.next && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progreso hacia: <span className="font-semibold text-green-700">{level.next}</span></span>
                <span>{perf.totalCompleted} / {(level.max ?? 0) + 1} trabajos</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">
                {remaining} {remaining === 1 ? "trabajo" : "trabajos"} para el siguiente nivel
              </p>
            </div>
          )}

          {level.crown && (
            <p className="text-center text-sm text-green-700 font-semibold mb-5">
              Nivel maximo alcanzado
            </p>
          )}

          {/* Extra stats row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Best week */}
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="w-9 h-9 bg-yellow-100 rounded-lg flex items-center justify-center shrink-0">
                <Trophy size={18} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Mejor semana</p>
                <p className="text-lg font-bold text-gray-900">
                  {perf.bestWeekJobs}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    {perf.bestWeekJobs === 1 ? "trabajo" : "trabajos"}
                  </span>
                </p>
              </div>
            </div>

            {/* This month vs last month */}
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                {monthTrend === "up" ? (
                  <TrendingUp size={18} className="text-green-600" />
                ) : monthTrend === "down" ? (
                  <TrendingDown size={18} className="text-red-500" />
                ) : (
                  <Minus size={18} className="text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Este mes</p>
                <p className="text-lg font-bold text-gray-900">
                  {perf.thisMonthJobs}{" "}
                  <span
                    className={`text-xs font-normal ${
                      monthTrend === "up"
                        ? "text-green-600"
                        : monthTrend === "down"
                          ? "text-red-500"
                          : "text-gray-400"
                    }`}
                  >
                    {monthTrend === "up"
                      ? `+${perf.thisMonthJobs - perf.lastMonthJobs} vs mes ant.`
                      : monthTrend === "down"
                        ? `${perf.thisMonthJobs - perf.lastMonthJobs} vs mes ant.`
                        : "igual al mes ant."}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Checklist rate (shown only if data exists) */}
          {perf.checklistRate !== null && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-purple-600 font-bold text-sm">✓</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-xs text-gray-500">Checklists completados</p>
                  <p className="text-sm font-bold text-gray-900">{perf.checklistRate}%</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${perf.checklistRate}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
