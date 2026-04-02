"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Clock } from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { PlanStatus } from "@/app/actions/plans";
import type { ServiceStatus } from "@/lib/types";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
  custom: "Personalizado",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<PlanStatus, string> = {
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
  service_type_name: string;
  address_label: string;
}

interface ServiceRow {
  id: string;
  request_number: number;
  status: ServiceStatus;
  created_at: string;
  preferred_date: string | null;
}

export default function PlanDetailClientPage() {
  const params = useParams();
  const id = params.id as string;

  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("No autenticado");

        const [planRes, servicesRes] = await Promise.all([
          supabase
            .from("maintenance_plans")
            .select("*, service_types(name), addresses(street, number, city, zone)")
            .eq("id", id)
            .eq("client_id", user.id)
            .single(),
          supabase
            .from("service_requests")
            .select("id, request_number, status, created_at, preferred_date")
            .eq("maintenance_plan_id", id)
            .eq("client_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

        if (planRes.error) throw planRes.error;

        const d = planRes.data as Record<string, unknown>;
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
          service_type_name: st.name,
          address_label: `${addr.street} ${addr.number}, ${addr.city} - ${addr.zone}`,
        });

        setServices(
          (servicesRes.data || []).map((s: any) => ({
            id: s.id,
            request_number: s.request_number,
            status: s.status as ServiceStatus,
            created_at: s.created_at,
            preferred_date: s.preferred_date,
          }))
        );
      } catch {
        setError("Error al cargar el plan");
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (error && !plan) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!plan) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/planes" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{plan.service_type_name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[plan.status]}`}>
              {STATUS_LABELS[plan.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{plan.address_label}</p>
        </div>
      </div>

      {/* Next service highlight */}
      {plan.status === "active" && plan.next_service_date && (
        <Card className="bg-green-50 border-green-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Calendar size={24} className="text-green-700" />
            </div>
            <div>
              <p className="text-sm text-green-700">Proximo servicio programado</p>
              <p className="text-xl font-bold text-green-900">{formatDate(plan.next_service_date)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Plan details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles del plan</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Frecuencia</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">
              {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency}
              {plan.frequency === "custom" && plan.custom_interval_days ? ` (cada ${plan.custom_interval_days} dias)` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Precio por servicio</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{formatCurrency(plan.price_cents)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Inicio del plan</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDate(plan.start_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fin del plan</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{plan.end_date ? formatDate(plan.end_date) : "Sin fecha de fin"}</p>
          </div>
        </div>
      </Card>

      {/* Tasks */}
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
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Clock size={18} />
              Historial de servicios ({services.length})
            </span>
          </CardTitle>
        </CardHeader>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400">Aun no se realizaron servicios desde este plan</p>
        ) : (
          <div className="space-y-3">
            {services.map((s) => (
              <Link key={s.id} href={`/servicios/${s.id}`}>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900">
                        #{s.request_number}
                      </span>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {s.preferred_date ? `Programado: ${formatDate(s.preferred_date)}` : formatDate(s.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
