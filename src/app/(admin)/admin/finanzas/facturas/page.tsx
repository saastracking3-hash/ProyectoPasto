"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Plus, FileText } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface InvoiceRow {
  id: string;
  invoice_number: number;
  client_name: string;
  total_cents: number;
  status: string;
  issued_at: string | null;
  created_at: string;
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusFilterOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "draft", label: "Borrador" },
  { value: "sent", label: "Enviada" },
  { value: "paid", label: "Pagada" },
  { value: "cancelled", label: "Cancelada" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FacturasPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadInvoices() {
      try {
        setLoading(true);
        const supabase = createClient();

        let query = supabase
          .from("invoices")
          .select(
            "id, invoice_number, total_cents, status, issued_at, created_at, profiles!invoices_client_id_fkey(full_name)"
          )
          .order("created_at", { ascending: false });

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        setRows(
          (data || []).map((r: Record<string, unknown>) => {
            const profile = r.profiles as { full_name: string } | null;
            return {
              id: r.id as string,
              invoice_number: r.invoice_number as number,
              client_name: profile?.full_name ?? "Sin nombre",
              total_cents: r.total_cents as number,
              status: r.status as string,
              issued_at: r.issued_at as string | null,
              created_at: r.created_at as string,
            };
          })
        );
      } catch {
        setError("Error al cargar facturas");
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestion de facturas emitidas
          </p>
        </div>
        <Link href="/admin/finanzas/facturas/nueva">
          <Button>
            <Plus size={16} />
            Crear factura
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  # Factura
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Cliente
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Monto
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Estado
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Fecha emision
                </th>
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
                          href={`/admin/finanzas/facturas/${row.id}`}
                          className="text-green-700 hover:text-green-800 font-medium"
                        >
                          #{row.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {row.client_name}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(row.total_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${INVOICE_STATUS_COLORS[row.status] || "bg-gray-100 text-gray-700"}`}
                        >
                          {INVOICE_STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {row.issued_at
                          ? formatDate(row.issued_at)
                          : formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No se encontraron facturas
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
