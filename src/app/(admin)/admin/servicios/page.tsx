"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ServiceStatus, UrgencyLevel } from "@/lib/types";
import { URGENCY_LABELS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/format";

interface ServiceRow {
  id: string;
  request_number: number;
  client_name: string;
  service_type: string;
  zone: string;
  urgency: UrgencyLevel;
  status: ServiceStatus;
  crew_name: string | null;
  scheduled_date: string | null;
  created_at: string;
}

const urgencyColors: Record<UrgencyLevel, string> = {
  normal: "text-gray-600",
  priority: "text-orange-600 font-medium",
  urgent: "text-red-600 font-semibold",
};

const statusFilterOptions: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "pending_review", label: "Pendiente de revision" },
  { value: "quoted", label: "Cotizado" },
  { value: "approved", label: "Aprobado" },
  { value: "scheduled", label: "Agendado" },
  { value: "crew_assigned", label: "Cuadrilla asignada" },
  { value: "in_progress", label: "En ejecucion" },
  { value: "completed_by_crew", label: "Finalizado por cuadrilla" },
  { value: "validated", label: "Validado" },
  { value: "closed", label: "Cerrado" },
  { value: "cancelled", label: "Cancelado" },
];

const PAGE_SIZE = 20;

export default function ServiciosPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("No autenticado"); setLoading(false); return; }

      let query = supabase
        .from("service_requests")
        .select(
          "id, request_number, status, urgency, created_at, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name), addresses!inner(zone), assignments(scheduled_date, crews(name))",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        const term = search.trim();
        const isNum = /^\d+$/.test(term);
        if (isNum) {
          query = query.eq("request_number", parseInt(term));
        } else {
          query = query.ilike("profiles.full_name", `%${term}%`);
        }
      }

      const { data, error: fetchError, count } = await query;
      if (fetchError) throw fetchError;

      const mapped: ServiceRow[] = (data || []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { full_name: string } | null;
        const st = row.service_types as { name: string } | null;
        const addr = row.addresses as { zone: string } | null;
        const assigns = row.assignments as { scheduled_date: string; crews: { name: string } | null }[] | null;
        const latestAssign = assigns && assigns.length > 0 ? assigns[0] : null;

        return {
          id: row.id as string,
          request_number: row.request_number as number,
          client_name: profile?.full_name ?? "Sin nombre",
          service_type: st?.name ?? "-",
          zone: addr?.zone ?? "-",
          urgency: row.urgency as UrgencyLevel,
          status: row.status as ServiceStatus,
          crew_name: latestAssign?.crews?.name ?? null,
          scheduled_date: latestAssign?.scheduled_date ?? null,
          created_at: row.created_at as string,
        };
      });

      setRows(mapped);
      setTotalCount(count ?? 0);
    } catch {
      setError("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vista completa de todos los servicios
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <Card padding={false}>
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Buscar por cliente o numero..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            >
              {statusFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Zona</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Urgencia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cuadrilla</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha prog.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Creado</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/servicios/${row.id}`}
                          className="text-green-700 hover:text-green-800 font-medium"
                        >
                          {row.request_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{row.client_name}</td>
                      <td className="px-4 py-3 text-gray-600">{row.service_type}</td>
                      <td className="px-4 py-3 text-gray-600">{row.zone}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${urgencyColors[row.urgency]}`}>
                          {URGENCY_LABELS[row.urgency]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.crew_name || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.scheduled_date ? formatDate(row.scheduled_date) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron servicios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
