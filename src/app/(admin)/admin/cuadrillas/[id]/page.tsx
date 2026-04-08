"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  MapPin,
  User,
  Star,
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import type { ServiceStatus } from "@/lib/types";

interface CrewDetail {
  id: string;
  name: string;
  zone: string | null;
  is_active: boolean;
}

interface MemberRow {
  id: string;
  name: string;
  role: string;
  joined_at: string;
}

interface AssignmentRow {
  id: string;
  service_request_id: string;
  request_number: number;
  client_name: string;
  service_type: string;
  date: string;
  status: ServiceStatus;
}

interface CrewStats {
  total_services: number;
  this_month: number;
  avg_rating: number;
  completion_rate: number;
}

interface LastJob {
  date: string;
  service_type: string;
  client_name: string;
}

interface CrewPerformanceStats {
  completed_jobs: number;
  this_month_completed: number;
  last_month_completed: number;
  avg_rating: number;
  total_hours: number;
  last_jobs: LastJob[];
}

export default function CuadrillaDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [crew, setCrew] = useState<CrewDetail | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [stats, setStats] = useState<CrewStats>({ total_services: 0, this_month: 0, avg_rating: 0, completion_rate: 0 });
  const [crewStats, setCrewStats] = useState<CrewPerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        // Fetch crew
        const { data: crewData, error: crewErr } = await supabase
          .from("crews")
          .select("id, name, zone, is_active")
          .eq("id", id)
          .single();

        if (crewErr) throw crewErr;
        setCrew(crewData as CrewDetail);

        // Fetch members
        const { data: membersData } = await supabase
          .from("crew_members")
          .select("id, role_in_crew, joined_at, profiles!crew_members_user_id_fkey(full_name)")
          .eq("crew_id", id);

        const mappedMembers: MemberRow[] = (membersData || []).map((m: Record<string, unknown>) => {
          const profile = m.profiles as { full_name: string } | null;
          return {
            id: m.id as string,
            name: profile?.full_name ?? "Sin nombre",
            role: (m.role_in_crew as string) === "leader" ? "Lider" : "Operario",
            joined_at: m.joined_at as string,
          };
        });
        setMembers(mappedMembers);

        // Fetch recent assignments
        const { data: assignData } = await supabase
          .from("assignments")
          .select(
            "id, service_request_id, scheduled_date, service_requests!inner(request_number, status, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name))"
          )
          .eq("crew_id", id)
          .order("scheduled_date", { ascending: false })
          .limit(10);

        const mappedAssign: AssignmentRow[] = (assignData || []).map((a: Record<string, unknown>) => {
          const sr = a.service_requests as Record<string, unknown>;
          const profile = sr.profiles as { full_name: string } | null;
          const st = sr.service_types as { name: string } | null;
          return {
            id: a.id as string,
            service_request_id: a.service_request_id as string,
            request_number: sr.request_number as number,
            client_name: profile?.full_name ?? "Sin nombre",
            service_type: st?.name ?? "-",
            date: a.scheduled_date as string,
            status: sr.status as ServiceStatus,
          };
        });
        setAssignments(mappedAssign);

        // Compute stats
        const { count: totalCount } = await supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("crew_id", id);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const { count: monthCount } = await supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("crew_id", id)
          .gte("scheduled_date", monthStart.toISOString().split("T")[0]);

        // Fetch avg review rating for services assigned to this crew
        const { data: reviewData } = await supabase
          .from("assignments")
          .select("service_request_id")
          .eq("crew_id", id);

        let avgRating = 0;
        if (reviewData && reviewData.length > 0) {
          const srIds = reviewData.map((r: { service_request_id: string }) => r.service_request_id);
          const { data: reviews } = await supabase
            .from("reviews")
            .select("rating")
            .in("service_request_id", srIds);
          if (reviews && reviews.length > 0) {
            avgRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length;
          }
        }

        // Completion rate: completed / total
        const { count: completedCount } = await supabase
          .from("assignments")
          .select("id, service_requests!inner(status)", { count: "exact", head: true })
          .eq("crew_id", id)
          .in("service_requests.status", ["completed_by_crew", "validated", "closed"]);

        const total = totalCount ?? 0;
        const completed = completedCount ?? 0;

        setStats({
          total_services: total,
          this_month: monthCount ?? 0,
          avg_rating: Math.round(avgRating * 10) / 10,
          completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        });

        // ── Performance stats ──────────────────────────────────────────────

        const completedStatuses = ["completed_by_crew", "validated", "closed"];

        // Date ranges
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

        // All assignment IDs for this crew with completed status (via join)
        const { data: completedAssigns } = await supabase
          .from("assignments")
          .select("id, service_request_id, scheduled_date, actual_start_at, actual_end_at, service_requests!inner(status, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name))")
          .eq("crew_id", id)
          .in("service_requests.status", completedStatuses);

        const completedList = completedAssigns ?? [];

        // Completed total
        const perfCompleted = completedList.length;

        // This month / last month (by scheduled_date)
        const perfThisMonth = completedList.filter((a: Record<string, unknown>) => {
          const d = new Date(a.scheduled_date as string);
          return d >= thisMonthStart;
        }).length;

        const perfLastMonth = completedList.filter((a: Record<string, unknown>) => {
          const d = new Date(a.scheduled_date as string);
          return d >= lastMonthStart && d < lastMonthEnd;
        }).length;

        // Total hours: sum (actual_end_at - actual_start_at) where both exist
        let totalMinutes = 0;
        for (const a of completedList as Record<string, unknown>[]) {
          if (a.actual_end_at && a.actual_start_at) {
            const diff = new Date(a.actual_end_at as string).getTime() - new Date(a.actual_start_at as string).getTime();
            if (diff > 0) totalMinutes += diff / 60000;
          }
        }
        const totalHours = Math.round(totalMinutes / 60);

        // Average rating for completed assignments
        const completedSrIds = completedList.map((a: Record<string, unknown>) => a.service_request_id as string);
        let perfAvgRating = 0;
        if (completedSrIds.length > 0) {
          const { data: perfReviews } = await supabase
            .from("reviews")
            .select("rating")
            .in("service_request_id", completedSrIds);
          if (perfReviews && perfReviews.length > 0) {
            perfAvgRating =
              Math.round(
                (perfReviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) /
                  perfReviews.length) *
                  10
              ) / 10;
          }
        }

        // Last 5 completed jobs sorted by date desc
        const sortedCompleted = [...completedList].sort((a, b) => {
          const da = new Date((a as Record<string, unknown>).scheduled_date as string).getTime();
          const db = new Date((b as Record<string, unknown>).scheduled_date as string).getTime();
          return db - da;
        });
        const lastJobs: LastJob[] = sortedCompleted.slice(0, 5).map((a) => {
          const ar = a as Record<string, unknown>;
          const sr = ar.service_requests as Record<string, unknown>;
          const prof = sr.profiles as { full_name?: string } | null;
          const st = sr.service_types as { name?: string } | null;
          return {
            date: ar.scheduled_date as string,
            service_type: st?.name ?? "-",
            client_name: prof?.full_name ?? "Sin nombre",
          };
        });

        setCrewStats({
          completed_jobs: perfCompleted,
          this_month_completed: perfThisMonth,
          last_month_completed: perfLastMonth,
          avg_rating: perfAvgRating,
          total_hours: totalHours,
          last_jobs: lastJobs,
        });
      } catch {
        setError("Error al cargar la cuadrilla");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="h-16 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !crew) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!crew) return null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/cuadrillas"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{crew.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                crew.is_active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {crew.is_active ? "Activa" : "Inactiva"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin size={14} />
            {crew.zone || "Sin zona asignada"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 size={20} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_services}</p>
            <p className="text-xs text-gray-500">Servicios totales</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <Calendar size={20} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.this_month}</p>
            <p className="text-xs text-gray-500">Este mes</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <Star size={20} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.avg_rating || "-"}</p>
            <p className="text-xs text-gray-500">Calificacion promedio</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completion_rate}%</p>
            <p className="text-xs text-gray-500">Tasa de completado</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Users size={18} />
                  Miembros ({members.length})
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-gray-400">Sin miembros</p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                      <User size={18} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      Desde {formatDate(member.joined_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Recent Assignments */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="p-4 border-b border-gray-200">
              <CardTitle>Asignaciones recientes</CardTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Servicio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        Sin asignaciones
                      </td>
                    </tr>
                  ) : (
                    assignments.map((assignment) => (
                      <tr
                        key={assignment.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/servicios/${assignment.service_request_id}`}
                            className="text-green-700 hover:text-green-800 font-medium"
                          >
                            {assignment.request_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{assignment.client_name}</td>
                        <td className="px-4 py-3 text-gray-600">{assignment.service_type}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(assignment.date)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={assignment.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Estadísticas del equipo ─────────────────────────────────────── */}
      {crewStats && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Award size={18} className="text-green-600" />
                Estadísticas del equipo
              </span>
            </CardTitle>
          </CardHeader>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4 mt-2">
            {/* Completed jobs */}
            <div className="flex flex-col items-center p-4 bg-blue-50 rounded-xl">
              <CheckCircle2 size={22} className="text-blue-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900">{crewStats.completed_jobs}</p>
              <p className="text-xs text-gray-500 text-center">trabajos completados</p>
            </div>

            {/* Average rating */}
            <div className="flex flex-col items-center p-4 bg-amber-50 rounded-xl">
              <Star size={22} className="text-amber-500 mb-1" />
              <p className="text-2xl font-bold text-gray-900">
                {crewStats.avg_rating > 0 ? `${crewStats.avg_rating}★` : "—"}
              </p>
              <p className="text-xs text-gray-500 text-center">rating promedio</p>
            </div>

            {/* Total hours */}
            <div className="flex flex-col items-center p-4 bg-purple-50 rounded-xl">
              <Clock size={22} className="text-purple-600 mb-1" />
              <p className="text-2xl font-bold text-gray-900">{crewStats.total_hours}</p>
              <p className="text-xs text-gray-500 text-center">horas trabajadas</p>
            </div>
          </div>

          {/* Month comparison */}
          <div className="mt-4 flex items-center gap-3 flex-wrap text-sm">
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{crewStats.this_month_completed}</span> este mes
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{crewStats.last_month_completed}</span> último mes
            </span>
            {crewStats.last_month_completed > 0 && (
              (() => {
                const diff = crewStats.this_month_completed - crewStats.last_month_completed;
                const pct = Math.abs(Math.round((diff / crewStats.last_month_completed) * 100));
                const up = diff >= 0;
                return (
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      up ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {up ? (
                      <TrendingUp size={15} />
                    ) : (
                      <TrendingDown size={15} />
                    )}
                    {up ? "+" : "-"}{pct}%
                  </span>
                );
              })()
            )}
          </div>

          {/* Last 5 jobs */}
          {crewStats.last_jobs.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Últimos trabajos
              </p>
              <ul className="space-y-1.5">
                {crewStats.last_jobs.map((job, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    <span>
                      <span className="font-medium text-gray-500">
                        {new Date(job.date).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                      </span>
                      {" · "}
                      {job.service_type}
                      {" · "}
                      <span className="text-gray-500">{job.client_name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
