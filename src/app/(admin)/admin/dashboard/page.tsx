"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Inbox,
  FileText,
  Truck,
  Users,
  ArrowRight,
  Clock,
  Plus,
} from "lucide-react";
import WeatherWidget from "@/components/admin/WeatherWidget";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/utils/format";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type { ServiceStatus } from "@/lib/types";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import RealtimeIndicator from "@/components/ui/RealtimeIndicator";

interface KpiData {
  newRequestsToday: number;
  pendingQuotes: number;
  activeServices: number;
  crewsWorkingToday: number;
}

interface ActivityEntry {
  id: string;
  to_status: ServiceStatus;
  notes: string | null;
  created_at: string;
  changed_by_name: string;
  request_number: number;
  service_request_id: string;
}

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("No autenticado"); setLoading(false); return; }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [reqRes, quoteRes, activeRes, crewRes, activityRes] = await Promise.all([
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .gte("created_at", todayISO),
          supabase
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .in("status", ["draft"]),
          supabase
            .from("service_requests")
            .select("id", { count: "exact", head: true })
            .in("status", [
              "crew_assigned",
              "in_transit",
              "arrived",
              "in_progress",
              "paused",
            ]),
          supabase
            .from("assignments")
            .select("crew_id")
            .eq("scheduled_date", todayStart.toISOString().split("T")[0]),
          supabase
            .from("service_state_log")
            .select(
              "id, to_status, notes, created_at, changed_by, service_request_id, profiles!service_state_log_changed_by_fkey(full_name), service_requests!inner(request_number)"
            )
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const uniqueCrews = new Set(
          (crewRes.data || []).map((a: { crew_id: string }) => a.crew_id)
        );

        setKpis({
          newRequestsToday: reqRes.count ?? 0,
          pendingQuotes: quoteRes.count ?? 0,
          activeServices: activeRes.count ?? 0,
          crewsWorkingToday: uniqueCrews.size,
        });

        const mapped: ActivityEntry[] = (activityRes.data || []).map(
          (row: Record<string, unknown>) => {
            const profile = row.profiles as { full_name: string } | null;
            const sr = row.service_requests as { request_number: number } | null;
            return {
              id: row.id as string,
              to_status: row.to_status as ServiceStatus,
              notes: row.notes as string | null,
              created_at: row.created_at as string,
              changed_by_name: profile?.full_name ?? "Sistema",
              request_number: sr?.request_number ?? 0,
              service_request_id: row.service_request_id as string,
            };
          }
        );
      setActivity(mapped);
    } catch {
      setError("Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime subscription for service_state_log changes
  const { status: realtimeStatus } = useRealtimeSubscription({
    filters: { table: "service_state_log", event: "INSERT" },
    onPayload: useCallback(() => {
      loadData(false);
    }, [loadData]),
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Solicitudes nuevas hoy",
      value: kpis?.newRequestsToday ?? 0,
      icon: Inbox,
      color: "text-blue-600 bg-blue-50",
      href: "/admin/solicitudes",
    },
    {
      label: "Presupuestos pendientes",
      value: kpis?.pendingQuotes ?? 0,
      icon: FileText,
      color: "text-orange-600 bg-orange-50",
      href: "/admin/presupuestos",
    },
    {
      label: "Servicios activos",
      value: kpis?.activeServices ?? 0,
      icon: Truck,
      color: "text-green-600 bg-green-50",
      href: "/admin/servicios",
    },
    {
      label: "Cuadrillas trabajando",
      value: kpis?.crewsWorkingToday ?? 0,
      icon: Users,
      color: "text-purple-600 bg-purple-50",
      href: "/admin/cuadrillas",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen general de la operacion
          </p>
        </div>
        <RealtimeIndicator status={realtimeStatus} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                {loading ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-6 w-10 bg-gray-200 animate-pulse rounded" />
                      <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${kpi.color}`}
                    >
                      <Icon size={24} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {kpi.value}
                      </p>
                      <p className="text-sm text-gray-500">{kpi.label}</p>
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
              <Link
                href="/admin/solicitudes"
                className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
              >
                Ver todo <ArrowRight size={14} />
              </Link>
            </CardHeader>
            <div className="space-y-4">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                      <div className="h-3 bg-gray-200 animate-pulse rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : activity.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  Sin actividad reciente
                </p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-600">
                      <Inbox size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">
                        <Link
                          href={`/admin/solicitudes/${item.service_request_id}`}
                          className="text-green-700 hover:text-green-800 font-medium"
                        >
                          #{item.request_number}
                        </Link>
                        {" "}&rarr; {SERVICE_STATUS_LABELS[item.to_status]} por{" "}
                        {item.changed_by_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock size={12} />
                        {formatRelativeDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Acciones rapidas</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <Link href="/admin/solicitudes" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Inbox size={18} />
                  Ver solicitudes pendientes
                </Button>
              </Link>
              <Link href="/admin/presupuestos" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Plus size={18} />
                  Crear presupuesto
                </Button>
              </Link>
              <Link href="/admin/agenda" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Clock size={18} />
                  Ver agenda del dia
                </Button>
              </Link>
              <Link href="/admin/cuadrillas" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users size={18} />
                  Gestionar cuadrillas
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Weather widget */}
      <WeatherWidget />
    </div>
  );
}
