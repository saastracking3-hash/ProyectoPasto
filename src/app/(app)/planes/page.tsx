"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import { CalendarCheck, ArrowRight } from "lucide-react";
import type { PlanStatus } from "@/app/actions/plans";

type FilterTab = "todos" | "activos" | "pausados";

const tabs: { key: FilterTab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "pausados", label: "Pausados" },
];

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

interface PlanRow {
  id: string;
  frequency: string;
  price_cents: number;
  status: PlanStatus;
  next_service_date: string | null;
  service_type_name: string;
  address_label: string;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function MisPlanesPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("todos");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        let query = supabase
          .from("maintenance_plans")
          .select("id, frequency, price_cents, status, next_service_date, service_types(name), addresses(street, number, zone)")
          .eq("client_id", user.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false });

        if (activeTab === "activos") {
          query = query.eq("status", "active");
        } else if (activeTab === "pausados") {
          query = query.eq("status", "paused");
        }

        const { data, error: planError } = await query;
        if (planError) throw planError;

        setPlans(
          (data || []).map((p: any) => ({
            id: p.id,
            frequency: p.frequency,
            price_cents: p.price_cents,
            status: p.status as PlanStatus,
            next_service_date: p.next_service_date,
            service_type_name: p.service_types?.name || "Servicio",
            address_label: p.addresses
              ? `${p.addresses.street} ${p.addresses.number}, ${p.addresses.zone}`
              : "",
          }))
        );
      } catch (err: any) {
        setError(err.message || "Error al cargar los planes");
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis planes</h1>
        <p className="text-gray-500 mt-1">
          Tus planes de mantenimiento recurrente.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-green-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Plans list */}
      {error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-green-800 text-sm font-medium mt-2 underline"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <ListSkeleton />
      ) : plans.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck size={28} />}
            title="No hay planes"
            description={
              activeTab === "activos"
                ? "No tenes planes activos en este momento."
                : activeTab === "pausados"
                ? "No tenes planes pausados."
                : "Todavia no tenes planes de mantenimiento."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link key={plan.id} href={`/planes/${plan.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {plan.service_type_name}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[plan.status]}`}>
                        {STATUS_LABELS[plan.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency} - {formatCurrency(plan.price_cents)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {plan.address_label}
                      {plan.next_service_date && (
                        <> · Proximo: {formatDate(plan.next_service_date)}</>
                      )}
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-gray-400 shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
