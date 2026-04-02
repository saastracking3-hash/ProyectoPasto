"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Plus, DollarSign } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface PaymentRow {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  reference: string | null;
  paid_at: string;
  client_name: string;
  request_number: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  mercadopago: "MercadoPago",
  other: "Otro",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  completed: "Cobrado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

const methodOptions = [
  { value: "all", label: "Todos los metodos" },
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "qr", label: "QR" },
  { value: "mercadopago", label: "MercadoPago" },
  { value: "other", label: "Otro" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PagosPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function loadPayments() {
      try {
        setLoading(true);
        const supabase = createClient();

        let query = supabase
          .from("payments")
          .select(
            "id, amount_cents, method, status, reference, paid_at, service_requests!inner(request_number, profiles!service_requests_client_id_fkey(full_name))"
          )
          .order("paid_at", { ascending: false });

        if (methodFilter !== "all") {
          query = query.eq("method", methodFilter);
        }
        if (dateFrom) {
          query = query.gte("paid_at", dateFrom);
        }
        if (dateTo) {
          query = query.lte("paid_at", `${dateTo}T23:59:59`);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        setRows(
          (data || []).map((r: Record<string, unknown>) => {
            const sr = r.service_requests as {
              request_number: number;
              profiles: { full_name: string } | null;
            } | null;
            return {
              id: r.id as string,
              amount_cents: r.amount_cents as number,
              method: r.method as string,
              status: r.status as string,
              reference: r.reference as string | null,
              paid_at: r.paid_at as string,
              client_name: sr?.profiles?.full_name ?? "Sin nombre",
              request_number: sr?.request_number ?? 0,
            };
          })
        );
      } catch {
        setError("Error al cargar pagos");
      } finally {
        setLoading(false);
      }
    }

    loadPayments();
  }, [methodFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Registro de todos los pagos recibidos
          </p>
        </div>
        <Link href="/admin/finanzas/pagos/nuevo">
          <Button>
            <Plus size={16} />
            Registrar pago
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card padding={false}>
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            {methodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            placeholder="Desde"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            placeholder="Hasta"
          />
          {(methodFilter !== "all" || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setMethodFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-sm text-green-700 hover:text-green-800 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Fecha
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Servicio #
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Monto
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Metodo
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 6 }).map((_, j) => (
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
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(row.paid_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {row.client_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        #{row.request_number}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(row.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {METHOD_LABELS[row.method] || row.method}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status] || "bg-gray-100 text-gray-700"}`}
                        >
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No se encontraron pagos
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
