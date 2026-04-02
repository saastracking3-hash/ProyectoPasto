"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Clock, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { ServiceStatus } from "@/lib/types";
import { useRealtimeSubscription } from "@/lib/hooks/useRealtimeSubscription";
import { useToast } from "@/lib/hooks/useToast";
import ToastContainer from "@/components/ui/Toast";
import RealtimeIndicator from "@/components/ui/RealtimeIndicator";

interface TodayJob {
  id: string;
  requestNumber: number;
  serviceType: string;
  address: string;
  scheduledTime: string;
  status: ServiceStatus;
  clientName: string;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-gray-200 rounded" />
          <div className="h-5 w-28 bg-gray-200 rounded-full" />
        </div>
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-56 bg-gray-200 rounded" />
        <div className="h-4 w-28 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export default function CrewHoyPage() {
  const [jobs, setJobs] = useState<TodayJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noCrew, setNoCrew] = useState(false);
  const crewIdRef = useRef<string | null>(null);

  const { toasts, addToast, removeToast } = useToast();

  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const fetchTodayJobs = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No se pudo obtener el usuario");
        return;
      }

      // Find user's crew
      const { data: crewMember } = await supabase
        .from("crew_members")
        .select("crew_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!crewMember) {
        setNoCrew(true);
        return;
      }

      crewIdRef.current = crewMember.crew_id;

      // Get today's date in YYYY-MM-DD
      const todayDate = new Date().toISOString().split("T")[0];

      // Fetch today's assignments with joins
      const { data: assignments, error: fetchError } = await supabase
        .from("assignments")
        .select(
          `
          id,
          scheduled_start_time,
          scheduled_end_time,
          service_request:service_requests!inner (
            request_number,
            status,
            description,
            client:profiles!service_requests_client_id_fkey ( full_name ),
            service_type:service_types!inner ( name ),
            address:addresses!inner ( street, number, city )
          )
        `
        )
        .eq("crew_id", crewMember.crew_id)
        .eq("scheduled_date", todayDate)
        .order("scheduled_start_time", { ascending: true });

      if (fetchError) {
        setError("Error al cargar los trabajos: " + fetchError.message);
        return;
      }

      const mapped: TodayJob[] = (assignments || []).map((a: any) => {
        const sr = a.service_request;
        const addr = sr.address;
        const timeSlot =
          a.scheduled_start_time && a.scheduled_end_time
            ? `${a.scheduled_start_time.slice(0, 5)} - ${a.scheduled_end_time.slice(0, 5)}`
            : a.scheduled_start_time
              ? a.scheduled_start_time.slice(0, 5)
              : "Sin horario";

        return {
          id: a.id,
          requestNumber: sr.request_number,
          serviceType: sr.service_type.name,
          address: `${addr.street} ${addr.number}, ${addr.city}`,
          scheduledTime: timeSlot,
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
  }, []);

  // Realtime subscription for assignments table
  const { status: realtimeStatus } = useRealtimeSubscription({
    filters: { table: "assignments", event: "INSERT" },
    onPayload: useCallback(() => {
      addToast("Nuevo trabajo asignado", "info");
      fetchTodayJobs(false);
    }, [addToast, fetchTodayJobs]),
  });

  useEffect(() => {
    fetchTodayJobs();
  }, [fetchTodayJobs]);

  const completedStatuses: ServiceStatus[] = [
    "completed_by_crew",
    "validated",
    "closed",
  ];
  const completedCount = jobs.filter((j) =>
    completedStatuses.includes(j.status)
  ).length;
  const pendingCount = jobs.length - completedCount;

  if (noCrew) {
    return (
      <EmptyState
        icon={<CalendarDays size={28} />}
        title="Sin cuadrilla asignada"
        description="No estas asignado a ninguna cuadrilla. Contacta al administrador."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trabajos de hoy</h1>
          <p className="text-sm text-gray-500 capitalize mt-1">{today}</p>
        </div>
        <RealtimeIndicator status={realtimeStatus} />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {loading ? "-" : jobs.length}
          </p>
          <p className="text-xs text-blue-600">Asignados</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">
            {loading ? "-" : completedCount}
          </p>
          <p className="text-xs text-green-600">Completados</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">
            {loading ? "-" : pendingCount}
          </p>
          <p className="text-xs text-amber-600">Pendientes</p>
        </div>
      </div>

      {/* Jobs list */}
      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="Sin trabajos hoy"
            description="No tenes trabajos asignados para hoy."
          />
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href={`/crew/trabajos/${job.id}`}>
              <Card className="hover:border-green-300 transition-colors mb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        #{job.requestNumber}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {job.serviceType}
                    </h3>
                    <p className="text-sm text-gray-500">{job.clientName}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {job.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock size={14} />
                      {job.scheduledTime}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-300 mt-1" />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
