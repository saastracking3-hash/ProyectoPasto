"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import type { ServiceStatus } from "@/lib/types";
import { ClipboardList, ArrowRight } from "lucide-react";

type FilterTab = "todos" | "activos" | "completados";

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

const tabs: { key: FilterTab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "completados", label: "Completados" },
];

interface ServiceRow {
  id: string;
  request_number: number;
  status: ServiceStatus;
  created_at: string;
  service_type_name: string;
  address_label: string;
  thumbnailUrl: string | null;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-20 bg-gray-200 animate-pulse rounded-xl"
        />
      ))}
    </div>
  );
}

export default function ServiciosPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("todos");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchServices() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user)
          throw new Error("No se pudo obtener el usuario");

        let query = supabase
          .from("service_requests")
          .select(
            "id, request_number, status, created_at, service_types(name), addresses(street, number, zone)"
          )
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (activeTab === "activos") {
          query = query.in("status", activeStatuses);
        } else if (activeTab === "completados") {
          query = query.in("status", completedStatuses);
        }

        const { data, error: svcError } = await query;
        if (svcError) throw svcError;

        const rows: ServiceRow[] = (data || []).map((s: any) => ({
          id: s.id,
          request_number: s.request_number,
          status: s.status as ServiceStatus,
          created_at: s.created_at,
          service_type_name: s.service_types?.name || "Servicio",
          address_label: s.addresses
            ? `${s.addresses.street} ${s.addresses.number}, ${s.addresses.zone}`
            : "",
          thumbnailUrl: null,
        }));

        // Batch-fetch the most recent "after" photo for every completed service
        const completedIds = rows
          .filter((r) => (completedStatuses as ServiceStatus[]).includes(r.status))
          .map((r) => r.id);

        if (completedIds.length > 0) {
          const { data: photos } = await supabase
            .from("service_photos")
            .select("storage_path, assignments!inner(service_request_id)")
            .in("assignments.service_request_id", completedIds)
            .eq("photo_type", "after")
            .order("created_at", { ascending: false });

          if (photos && photos.length > 0) {
            // Build a map: service_request_id -> first (most recent) storage_path
            const photoMap = new Map<string, string>();
            for (const p of photos) {
              const svcId = (p as any).assignments?.service_request_id as string | undefined;
              if (svcId && !photoMap.has(svcId)) {
                photoMap.set(svcId, p.storage_path);
              }
            }

            // Resolve public URLs
            for (const row of rows) {
              const path = photoMap.get(row.id);
              if (path) {
                row.thumbnailUrl =
                  supabase.storage.from("service-photos").getPublicUrl(path).data.publicUrl;
              }
            }
          }
        }

        setServices(rows);
      } catch (err: any) {
        setError(err.message || "Error al cargar los servicios");
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis servicios</h1>
        <p className="text-gray-500 mt-1">
          Segui el estado de todos tus servicios de jardineria.
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

      {/* Service list */}
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
      ) : services.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={28} />}
            title="No hay servicios"
            description={
              activeTab === "activos"
                ? "No tenes servicios activos en este momento."
                : activeTab === "completados"
                ? "Todavia no tenes servicios completados."
                : "Todavia no solicitaste ningun servicio."
            }
            action={
              <Link
                href="/solicitar"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Solicitar servicio
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Link key={service.id} href={`/servicios/${service.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        #{service.request_number}
                      </span>
                      <StatusBadge status={service.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {service.service_type_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {service.address_label} ·{" "}
                      {formatDate(service.created_at)}
                    </p>
                  </div>

                  {/* Right-side visual indicator */}
                  {(completedStatuses as ServiceStatus[]).includes(service.status) ? (
                    service.thumbnailUrl ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <Image
                          src={service.thumbnailUrl}
                          alt="Foto del trabajo"
                          width={56}
                          height={56}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 shrink-0" />
                    )
                  ) : (activeStatuses as ServiceStatus[]).includes(service.status) ? (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-medium text-green-700 whitespace-nowrap">
                        En curso
                      </span>
                    </div>
                  ) : null}

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
