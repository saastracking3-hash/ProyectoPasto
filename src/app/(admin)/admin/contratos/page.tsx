"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Filter, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import type { ContractStatus } from "@/app/actions/contracts";

interface ContractRow {
  id: string;
  name: string;
  client_name: string;
  start_date: string;
  end_date: string;
  monthly_amount_cents: number;
  status: ContractStatus;
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  expired: "Vencido",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-gray-200 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusFilterOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activos" },
  { value: "paused", label: "Pausados" },
  { value: "expired", label: "Vencidos" },
  { value: "cancelled", label: "Cancelados" },
];

const PAGE_SIZE = 20;

export default function ContratosAdminPage() {
  const [rows, setRows] = useState<ContractRow[]>([]);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No autenticado");
        setLoading(false);
        return;
      }

      let query = supabase
        .from("contracts")
        .select(
          "id, name, start_date, end_date, monthly_amount_cents, status, profiles!contracts_client_id_fkey(full_name)",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (search.trim()) {
        query = query.or(`name.ilike.%${search.trim()}%,profiles.full_name.ilike.%${search.trim()}%`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const mapped: ContractRow[] = (data || []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as { full_name: string } | null;
        return {
          id: row.id as string,
          name: row.name as string,
          client_name: profile?.full_name ?? "Sin nombre",
          start_date: row.start_date as string,
          end_date: row.end_date as string,
          monthly_amount_cents: row.monthly_amount_cents as number,
          status: row.status as ContractStatus,
        };
      });

      setRows(mapped);
      setTotalCount(count ?? 0);
    } catch {
      setError("Error al cargar contratos");
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos corporativos</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion de contratos de servicio</p>
        </div>
        <Link href="/admin/contratos/nuevo">
          <Button>
            <Plus size={16} />
            Crear contrato
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
              placeholder="Buscar por nombre o cliente..."
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contrato</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Periodo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Monto mensual</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 animate-pulse rounded w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900">{row.client_name}</td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/contratos/${row.id}`} className="text-green-700 hover:text-green-800 font-medium">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(row.start_date)} - {formatDate(row.end_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{formatCurrency(row.monthly_amount_cents)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron contratos
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
