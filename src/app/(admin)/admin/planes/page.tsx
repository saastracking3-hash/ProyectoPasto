"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Filter, Plus, Pause, XCircle, Play, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import type { PlanStatus } from "@/app/actions/plans";

interface PlanRow {
  id: string;
  client_name: string;
  address_label: string;
  service_type_name: string;
  frequency: string;
  price_cents: number;
  status: PlanStatus;
  next_service_date: string | null;
  created_at: string;
}

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

const statusFilterOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "Pausados" },
  { value: "cancelled", label: "Cancelados" },
];

const PAGE_SIZE = 20;

export default function PlanesAdminPage() {
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No autenticado");
        setLoading(false);
        return;
      }

      let query = supabase
        .from("maintenance_plans")
        .select(
          "id, frequency, price_cents, status, next_service_date, created_at, profiles!maintenance_plans_client_id_fkey(full_name), service_types!inner(name), addresses!inner(street, number, city, zone)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.ilike("profiles.full_name", `%${search.trim()}%`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const mapped: PlanRow[] = (data || []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { full_name: string } | null;
        const st = row.service_types as { name: string } | null;
        const addr = row.addresses as { street: string; number: string; city: string; zone: string } | null;
        return {
          id: row.id as string,
          client_name: profile?.full_name ?? "Sin nombre",
          address_label: addr ? `${addr.street} ${addr.number}, ${addr.zone}` : "-",
          service_type_name: st?.name ?? "-",
          frequency: row.frequency as string,
          price_cents: row.price_cents as number,
          status: row.status as PlanStatus,
          next_service_date: row.next_service_date as string | null,
          created_at: row.created_at as string,
        };
      });

      setRows(mapped);
      setTotalCount(count ?? 0);
    } catch {
      setError("Error al cargar planes");
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

  const handleQuickAction = async (planId: string, action: "pause" | "cancel" | "resume" | "generate") => {
    setActionLoading(planId);
    const supabase = createClient();
    try {
      if (action === "pause") {
        await supabase
          .from("maintenance_plans")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", planId);
      } else if (action === "cancel") {
        await supabase
          .from("maintenance_plans")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", planId);
      } else if (action === "resume") {
        await supabase
          .from("maintenance_plans")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", planId);
      } else if (action === "generate") {
        // Import and call generateNextService via fetch to server action
        const { generateNextService } = await import("@/app/actions/plans");
        const result = await generateNextService(planId);
        if (result.error) {
          setError(result.error);
          setActionLoading(null);
          return;
        }
      }
      await fetchData();
    } catch {
      setError("Error al ejecutar la accion");
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planes de mantenimiento</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion de planes recurrentes</p>
        </div>
        <Link href="/admin/planes/nuevo">
          <Button>
            <Plus size={16} />
            Crear plan
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <Card padding={false}>
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente..."
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
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Direccion</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Servicio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Frecuencia</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Precio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Proximo servicio</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 animate-pulse rounded w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/planes/${row.id}`} className="text-green-700 hover:text-green-800 font-medium">
                          {row.client_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{row.address_label}</td>
                      <td className="px-4 py-3 text-gray-600">{row.service_type_name}</td>
                      <td className="px-4 py-3 text-gray-600">{FREQUENCY_LABELS[row.frequency] ?? row.frequency}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{formatCurrency(row.price_cents)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {row.next_service_date ? formatDate(row.next_service_date) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {row.status === "active" && (
                            <>
                              <button
                                title="Pausar"
                                onClick={() => handleQuickAction(row.id, "pause")}
                                disabled={actionLoading === row.id}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Pause size={14} />
                              </button>
                              <button
                                title="Cancelar"
                                onClick={() => handleQuickAction(row.id, "cancel")}
                                disabled={actionLoading === row.id}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <XCircle size={14} />
                              </button>
                              <button
                                title="Generar proximo servicio"
                                onClick={() => handleQuickAction(row.id, "generate")}
                                disabled={actionLoading === row.id}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </>
                          )}
                          {row.status === "paused" && (
                            <>
                              <button
                                title="Reactivar"
                                onClick={() => handleQuickAction(row.id, "resume")}
                                disabled={actionLoading === row.id}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Play size={14} />
                              </button>
                              <button
                                title="Cancelar"
                                onClick={() => handleQuickAction(row.id, "cancel")}
                                disabled={actionLoading === row.id}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron planes
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
