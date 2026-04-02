"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import type { ServiceStatus } from "@/lib/types";
import {
  PlusCircle,
  ClipboardList,
  FileText,
  CheckCircle2,
  ArrowRight,
  Leaf,
} from "lucide-react";

interface DashboardData {
  firstName: string;
  activeCount: number;
  pendingQuotesCount: number;
  completedCount: number;
  recentServices: {
    id: string;
    request_number: number;
    service_type_name: string;
    status: ServiceStatus;
    created_at: string;
    address_street: string;
    address_number: string;
    address_zone: string;
  }[];
}

const activeStatuses: ServiceStatus[] = [
  "request_created",
  "pending_review",
  "quoted",
  "pending_approval",
  "approved",
  "scheduled",
  "crew_assigned",
  "in_transit",
  "arrived",
  "in_progress",
  "paused",
];

const completedStatuses: ServiceStatus[] = [
  "completed_by_crew",
  "validated",
  "closed",
];

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
        <div className="h-5 w-80 bg-gray-200 animate-pulse rounded mt-2" />
      </div>
      <div className="h-24 bg-gray-200 animate-pulse rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 animate-pulse rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();

        // Fetch all client services
        const { data: services, error: svcError } = await supabase
          .from("service_requests")
          .select("id, request_number, status, created_at, service_type_id, address_id, service_types(name), addresses(street, number, zone)")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (svcError) throw svcError;

        const allServices = services || [];

        const activeCount = allServices.filter((s: any) =>
          activeStatuses.includes(s.status)
        ).length;

        const completedCount = allServices.filter((s: any) =>
          completedStatuses.includes(s.status)
        ).length;

        // Count pending quotes
        const serviceIds = allServices.map((s: any) => s.id);
        let pendingQuotesCount = 0;
        if (serviceIds.length > 0) {
          const { count } = await supabase
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .in("service_request_id", serviceIds)
            .eq("status", "sent");
          pendingQuotesCount = count || 0;
        }

        const recentServices = allServices.slice(0, 5).map((s: any) => ({
          id: s.id,
          request_number: s.request_number,
          service_type_name: s.service_types?.name || "Servicio",
          status: s.status as ServiceStatus,
          created_at: s.created_at,
          address_street: s.addresses?.street || "",
          address_number: s.addresses?.number || "",
          address_zone: s.addresses?.zone || "",
        }));

        const firstName = (profile?.full_name || "").split(" ")[0] || "Usuario";

        setData({
          firstName,
          activeCount,
          pendingQuotesCount,
          completedCount,
          recentServices,
        });
      } catch (err: any) {
        setError(err.message || "Error al cargar el dashboard");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-green-800 text-sm font-medium mt-2 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!data) return null;

  const summaryCards = [
    {
      label: "Servicios activos",
      value: data.activeCount,
      icon: ClipboardList,
      color: "text-green-800 bg-green-50",
      href: "/servicios",
    },
    {
      label: "Presupuestos pendientes",
      value: data.pendingQuotesCount,
      icon: FileText,
      color: "text-orange-700 bg-orange-50",
      href: "/presupuestos",
    },
    {
      label: "Servicios completados",
      value: data.completedCount,
      icon: CheckCircle2,
      color: "text-blue-700 bg-blue-50",
      href: "/servicios",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido de nuevo, {data.firstName}
        </h1>
        <p className="text-gray-500 mt-1">
          Gestion&aacute; tus servicios de jardineria desde ac&aacute;.
        </p>
      </div>

      {/* Quick action */}
      <Card className="bg-green-800 text-white border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center">
              <Leaf size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                ¿Necesitás un servicio?
              </h2>
              <p className="text-green-200 text-sm">
                Solicitá un presupuesto sin compromiso
              </p>
            </div>
          </div>
          <Link href="/solicitar">
            <Button
              variant="secondary"
              className="bg-white text-green-800 hover:bg-green-50"
            >
              <PlusCircle size={18} />
              Solicitar
            </Button>
          </Link>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} href={card.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {card.value}
                    </p>
                    <p className="text-sm text-gray-500">{card.label}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent services */}
      <Card>
        <CardHeader>
          <CardTitle>Servicios recientes</CardTitle>
          <Link
            href="/servicios"
            className="text-sm text-green-800 hover:text-green-700 font-medium flex items-center gap-1"
          >
            Ver todos
            <ArrowRight size={14} />
          </Link>
        </CardHeader>
        {data.recentServices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Todavía no tenés servicios.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentServices.map((service) => (
              <Link
                key={service.id}
                href={`/servicios/${service.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      #{service.request_number}
                    </span>
                    <span className="text-sm text-gray-500">
                      {service.service_type_name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {service.address_street} {service.address_number},{" "}
                    {service.address_zone} · {formatDate(service.created_at)}
                  </p>
                </div>
                <StatusBadge status={service.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
