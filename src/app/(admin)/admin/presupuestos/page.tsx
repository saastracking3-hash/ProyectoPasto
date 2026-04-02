"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter } from "lucide-react";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { QuoteStatus } from "@/lib/types";

interface PresupuestoRow {
  id: string;
  request_number: number;
  client_name: string;
  total_cents: number;
  status: QuoteStatus;
  created_at: string;
  service_request_id: string;
}

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  expired: "Vencido",
};

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

const statusFilterOptions: { value: string; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviado" },
  { value: "approved", label: "Aprobado" },
  { value: "rejected", label: "Rechazado" },
  { value: "expired", label: "Vencido" },
];

export default function PresupuestosPage() {
  const [rows, setRows] = useState<PresupuestoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        let query = supabase
          .from("quotes")
          .select(
            "id, status, total_cents, created_at, service_request_id, service_requests!inner(request_number, profiles!service_requests_client_id_fkey(full_name))"
          )
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const mapped: PresupuestoRow[] = (data || []).map(
          (row: Record<string, unknown>) => {
            const sr = row.service_requests as {
              request_number: number;
              profiles: { full_name: string } | null;
            } | null;
            return {
              id: row.id as string,
              service_request_id: row.service_request_id as string,
              request_number: sr?.request_number ?? 0,
              client_name: sr?.profiles?.full_name ?? "Sin nombre",
              total_cents: row.total_cents as number,
              status: row.status as QuoteStatus,
              created_at: row.created_at as string,
            };
          }
        );

        setRows(mapped);
      } catch {
        setError("Error al cargar presupuestos");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestion de presupuestos y cotizaciones
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <Card padding={false}>
        {/* Filter */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            {statusFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">#Solicitud</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-200 animate-pulse rounded w-20" />
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
                          href={`/admin/presupuestos/${row.id}`}
                          className="text-green-700 hover:text-green-800 font-medium"
                        >
                          {row.request_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{row.client_name}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(row.total_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            QUOTE_STATUS_COLORS[row.status]
                          }`}
                        >
                          {QUOTE_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No se encontraron presupuestos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
