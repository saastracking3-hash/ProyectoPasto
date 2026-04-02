"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  Clock,
  Pause,
  Play,
  XCircle,
  RefreshCw,
  Edit,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { pausePlan, cancelPlan, resumePlan, generateNextService } from "@/app/actions/plans";
import type { PlanStatus } from "@/app/actions/plans";
import type { ServiceStatus } from "@/lib/types";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  custom: "Personalizado",
};

const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
};

const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

interface PlanDetail {
  id: string;
  status: PlanStatus;
  frequency: string;
  custom_interval_days: number | null;
  price_cents: number;
  tasks_included: string[];
  start_date: string;
  end_date: string | null;
  next_service_date: string | null;
  last_service_date: string | null;
  notes: string | null;
  created_at: string;
  client: { id: string; full_name: string; phone: string | null };
  address: {
    street: string;
    number: string;
    city: string;
    zone: string;
  };
  service_type: { name: string };
}

interface ServiceRow {
  id: string;
  request_number: number;
  status: ServiceStatus;
  created_at: string;
  preferred_date: string | null;
  service_type: { name: string } | null;
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      try {
        const [planRes, servicesRes] = await Promise.all([
          supabase
            .from("maintenance_plans")
            .select(
              "*, profiles!maintenance_plans_client_id_fkey(id, full_name, phone), service_types!inner(name), addresses!inner(street, number, city, zone)"
            )
            .eq("id", id)
            .single(),
          supabase
            .from("service_requests")
            .select("id, request_number, status, created_at, preferred_date, service_types(name)")
            .eq("maintenance_plan_id", id)
            .order("created_at", { ascending: false }),
        ]);

        if (planRes.error) throw planRes.error;

        const d = planRes.data as Record<string, unknown>;
        const profile = d.profiles as { id: string; full_name: string; phone: string | null };
        const st = d.service_types as { name: string };
        const addr = d.addresses as { street: string; number: string; city: string; zone: string };

        setPlan({
          id: d.id as string,
          status: d.status as PlanStatus,
          frequency: d.frequency as string,
          custom_interval_days: d.custom_interval_days as number | null,
          price_cents: d.price_cents as number,
          tasks_included: (d.tasks_included as string[]) || [],
          start_date: d.start_date as string,
          end_date: d.end_date as string | null,
          next_service_date: d.next_service_date as string | null,
          last_service_date: d.last_service_date as string | null,
          notes: d.notes as string | null,
          created_at: d.created_at as string,
          client: profile,
          address: addr,
          service_type: st,
        });

        const mappedServices: ServiceRow[] = (servicesRes.data || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          request_number: s.request_number as number,
          status: s.status as ServiceStatus,
          created_at: s.created_at as string,
          preferred_date: s.preferred_date as string | null,
          service_type: s.service_types as { name: string } | null,
        }));
        setServices(mappedServices);
      } catch {
        setError("Error al cargar el plan");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleAction = async (action: "pause" | "resume" | "cancel" | "generate") => {
    setActionLoading(true);
    setError(null);
    let result;
    switch (action) {
      case "pause":
        result = await pausePlan(id);
        break;
      case "resume":
        result = await resumePlan(id);
        break;
      case "cancel":
        result = await cancelPlan(id);
        break;
      case "generate":
        result = await generateNextService(id);
        break;
    }
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
      window.location.reload();
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !plan) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!plan) return null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/planes" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Plan: {plan.service_type.name}
              </h1>
              <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${PLAN_STATUS_COLORS[plan.status]}`}>
                {PLAN_STATUS_LABELS[plan.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {plan.client.full_name} - {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {plan.status === "active" && (
            <>
              <Button variant="secondary" onClick={() => handleAction("generate")} loading={actionLoading}>
                <RefreshCw size={16} />
                Generar servicio
              </Button>
              <Button variant="secondary" onClick={() => handleAction("pause")} loading={actionLoading}>
                <Pause size={16} />
                Pausar
              </Button>
              <Button variant="danger" onClick={() => handleAction("cancel")} loading={actionLoading}>
                <XCircle size={16} />
                Cancelar
              </Button>
            </>
          )}
          {plan.status === "paused" && (
            <>
              <Button onClick={() => handleAction("resume")} loading={actionLoading}>
                <Play size={16} />
                Reactivar
              </Button>
              <Button variant="danger" onClick={() => handleAction("cancel")} loading={actionLoading}>
                <XCircle size={16} />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informacion del plan</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Tipo de servicio</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{plan.service_type.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Frecuencia</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}
                  {plan.frequency === "custom" && plan.custom_interval_days ? ` (${plan.custom_interval_days} dias)` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Precio por servicio</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatCurrency(plan.price_cents)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Inicio</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(plan.start_date)}</p>
              </div>
            </div>
            {plan.end_date && (
              <div className="mt-4">
                <p className="text-xs text-gray-500">Fin del plan</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(plan.end_date)}</p>
              </div>
            )}
            {plan.notes && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">Notas</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{plan.notes}</p>
              </div>
            )}
          </Card>

          {/* Client Info */}
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <User size={20} className="text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{plan.client.full_name}</p>
                  <p className="text-xs text-gray-500">{plan.client.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                  <MapPin size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {plan.address.street} {plan.address.number}, {plan.address.city}
                  </p>
                  <p className="text-xs text-gray-500">{plan.address.zone}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Tasks Included */}
          {plan.tasks_included.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tareas incluidas</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {plan.tasks_included.map((task) => (
                  <div key={task} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-2 h-2 bg-green-600 rounded-full shrink-0" />
                    {task}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Service History */}
          <Card padding={false}>
            <div className="p-6 pb-0">
              <CardHeader>
                <CardTitle>Servicios generados ({services.length})</CardTitle>
              </CardHeader>
            </div>
            {services.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-gray-400">Aun no se generaron servicios desde este plan</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha programada</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/solicitudes/${s.id}`} className="text-green-700 hover:text-green-800 font-medium">
                            {s.request_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.preferred_date ? formatDate(s.preferred_date) : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right column - Quick Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Calendar size={18} />
                  Proximo servicio
                </span>
              </CardTitle>
            </CardHeader>
            {plan.status === "active" && plan.next_service_date ? (
              <div className="text-center">
                <p className="text-3xl font-bold text-green-700">{formatDate(plan.next_service_date)}</p>
                <p className="text-sm text-gray-500 mt-1">{FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center">
                {plan.status === "paused" ? "Plan pausado" : plan.status === "cancelled" ? "Plan cancelado" : "Sin fecha programada"}
              </p>
            )}
          </Card>

          {plan.last_service_date && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Clock size={18} />
                    Ultimo servicio
                  </span>
                </CardTitle>
              </CardHeader>
              <p className="text-center text-lg font-semibold text-gray-700">{formatDate(plan.last_service_date)}</p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total de servicios</span>
                <span className="font-medium text-gray-900">{services.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Precio por servicio</span>
                <span className="font-medium text-gray-900">{formatCurrency(plan.price_cents)}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-500">Total facturado</span>
                <span className="font-bold text-gray-900">{formatCurrency(plan.price_cents * services.length)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
