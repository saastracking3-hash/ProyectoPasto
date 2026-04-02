"use client";

import { useEffect, useState } from "react";
import { MapPin, Clock, ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";
import type { ServiceStatus } from "@/lib/types";

interface JobItem {
  id: string;
  requestNumber: number;
  serviceType: string;
  address: string;
  scheduledDate: string;
  status: ServiceStatus;
  clientName: string;
}

type Filter = "all" | "active" | "completed";

const COMPLETED_STATUSES: ServiceStatus[] = [
  "completed_by_crew",
  "validated",
  "closed",
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-gray-200 rounded" />
          <div className="h-5 w-24 bg-gray-200 rounded-full" />
        </div>
        <div className="h-4 w-36 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-200 rounded" />
        <div className="h-3 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export default function CrewTrabajosPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [noCrew, setNoCrew] = useState(false);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("No se pudo obtener el usuario");
          return;
        }

        const { data: crewMember } = await supabase
          .from("crew_members")
          .select("crew_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!crewMember) {
          setNoCrew(true);
          return;
        }

        const { data: assignments, error: fetchError } = await supabase
          .from("assignments")
          .select(
            `
            id,
            scheduled_date,
            service_request:service_requests!inner (
              request_number,
              status,
              client:profiles!service_requests_client_id_fkey ( full_name ),
              service_type:service_types!inner ( name ),
              address:addresses!inner ( street, number, city )
            )
          `
          )
          .eq("crew_id", crewMember.crew_id)
          .order("scheduled_date", { ascending: false });

        if (fetchError) {
          setError("Error al cargar trabajos: " + fetchError.message);
          return;
        }

        const mapped: JobItem[] = (assignments || []).map((a: any) => {
          const sr = a.service_request;
          const addr = sr.address;
          return {
            id: a.id,
            requestNumber: sr.request_number,
            serviceType: sr.service_type.name,
            address: `${addr.street} ${addr.number}, ${addr.city}`,
            scheduledDate: a.scheduled_date,
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
    }

    fetchJobs();
  }, []);

  const filtered = jobs.filter((j) => {
    if (filter === "active") return !COMPLETED_STATUSES.includes(j.status);
    if (filter === "completed") return COMPLETED_STATUSES.includes(j.status);
    return true;
  });

  if (noCrew) {
    return (
      <EmptyState
        icon={<ClipboardList size={28} />}
        title="Sin cuadrilla asignada"
        description="No estas asignado a ninguna cuadrilla. Contacta al administrador."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Mis trabajos</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(
          [
            ["all", "Todos"],
            ["active", "Activos"],
            ["completed", "Completados"],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? "bg-green-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} />}
            title="Sin trabajos"
            description={
              filter === "all"
                ? "No tenes trabajos asignados."
                : filter === "active"
                  ? "No tenes trabajos activos."
                  : "No tenes trabajos completados."
            }
          />
        ) : (
          filtered.map((job) => (
            <Link key={job.id} href={`/crew/trabajos/${job.id}`}>
              <Card className="hover:border-green-300 transition-colors mb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        #{job.requestNumber}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {job.serviceType}
                    </h3>
                    <p className="text-xs text-gray-500">{job.clientName}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} />
                      {job.address}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
                      {formatDate(job.scheduledDate)}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-300" />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
