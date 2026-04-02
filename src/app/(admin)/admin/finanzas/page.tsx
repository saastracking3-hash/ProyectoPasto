"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Clock,
  FileText,
  ArrowRight,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Stats {
  totalMes: number;
  cobrado: number;
  pendiente: number;
  facturados: number;
}

interface RecentPayment {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  paid_at: string;
  client_name: string;
  request_number: number;
}

interface MethodBreakdown {
  method: string;
  total: number;
}

interface MonthlyTrend {
  month: string;
  total: number;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  mercadopago: "MercadoPago",
  other: "Otro",
};

const METHOD_ICONS: Record<string, typeof DollarSign> = {
  cash: Banknote,
  transfer: CreditCard,
  qr: QrCode,
  mercadopago: Smartphone,
  other: DollarSign,
};

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-500",
  transfer: "bg-blue-500",
  qr: "bg-purple-500",
  mercadopago: "bg-cyan-500",
  other: "bg-gray-500",
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FinanzasDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalMes: 0,
    cobrado: 0,
    pendiente: 0,
    facturados: 0,
  });
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [methodBreakdown, setMethodBreakdown] = useState<MethodBreakdown[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();

        // Current month range
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        // Fetch payments this month
        const { data: monthPayments } = await supabase
          .from("payments")
          .select("amount_cents, method, status, paid_at")
          .gte("paid_at", monthStart)
          .lte("paid_at", `${monthEnd}T23:59:59`);

        const payments = monthPayments || [];
        const cobrado = payments
          .filter((p) => p.status === "completed")
          .reduce((s, p) => s + p.amount_cents, 0);
        const pendiente = payments
          .filter((p) => p.status === "pending")
          .reduce((s, p) => s + p.amount_cents, 0);

        // Invoices count this month
        const { count: facturados } = await supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .lte("created_at", `${monthEnd}T23:59:59`);

        setStats({
          totalMes: cobrado + pendiente,
          cobrado,
          pendiente,
          facturados: facturados || 0,
        });

        // Method breakdown (all completed this month)
        const methodMap: Record<string, number> = {};
        payments
          .filter((p) => p.status === "completed")
          .forEach((p) => {
            methodMap[p.method] = (methodMap[p.method] || 0) + p.amount_cents;
          });
        setMethodBreakdown(
          Object.entries(methodMap)
            .map(([method, total]) => ({ method, total }))
            .sort((a, b) => b.total - a.total)
        );

        // Recent payments (last 20)
        const { data: recent } = await supabase
          .from("payments")
          .select(
            "id, amount_cents, method, status, paid_at, service_requests!inner(request_number, profiles!service_requests_client_id_fkey(full_name))"
          )
          .order("paid_at", { ascending: false })
          .limit(20);

        setRecentPayments(
          (recent || []).map((r: Record<string, unknown>) => {
            const sr = r.service_requests as {
              request_number: number;
              profiles: { full_name: string } | null;
            } | null;
            return {
              id: r.id as string,
              amount_cents: r.amount_cents as number,
              method: r.method as string,
              status: r.status as string,
              paid_at: r.paid_at as string,
              client_name: sr?.profiles?.full_name ?? "Sin nombre",
              request_number: sr?.request_number ?? 0,
            };
          })
        );

        // Monthly trend (last 6 months)
        const sixMonthsAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 5,
          1
        ).toISOString();
        const { data: allRecent } = await supabase
          .from("payments")
          .select("amount_cents, paid_at")
          .eq("status", "completed")
          .gte("paid_at", sixMonthsAgo)
          .order("paid_at", { ascending: true });

        const monthMap: Record<string, number> = {};
        (allRecent || []).forEach((p: { amount_cents: number; paid_at: string }) => {
          const m = p.paid_at.substring(0, 7);
          monthMap[m] = (monthMap[m] || 0) + p.amount_cents;
        });

        // Fill in missing months
        const trend: MonthlyTrend[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          trend.push({ month: key, total: monthMap[key] || 0 });
        }
        setMonthlyTrend(trend);
      } catch {
        setError("Error al cargar datos financieros");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const maxMonthly = Math.max(...monthlyTrend.map((m) => m.total), 1);
  const totalMethodAmount = methodBreakdown.reduce((s, m) => s + m.total, 0) || 1;

  const MONTH_NAMES = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-1">Panel financiero</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 bg-gray-200 animate-pulse rounded-xl"
            />
          ))}
        </div>
        <div className="h-64 bg-gray-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen financiero del mes actual
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/finanzas/pagos"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <DollarSign size={16} />
            Ver pagos
          </Link>
          <Link
            href="/admin/finanzas/facturas"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText size={16} />
            Ver facturas
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ingresos del mes</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.totalMes)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cobrado</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.cobrado)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pendiente</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(stats.pendiente)}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Facturados</p>
              <p className="text-xl font-bold text-gray-900">
                {stats.facturados}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cobros por metodo</CardTitle>
          </CardHeader>
          {methodBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin datos de cobros este mes
            </p>
          ) : (
            <div className="space-y-3">
              {methodBreakdown.map((item) => {
                const pct = Math.round((item.total / totalMethodAmount) * 100);
                const Icon = METHOD_ICONS[item.method] || DollarSign;
                return (
                  <div key={item.method}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">
                          {METHOD_LABELS[item.method] || item.method}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.total)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${METHOD_COLORS[item.method] || "bg-gray-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Tendencia mensual</CardTitle>
          </CardHeader>
          {monthlyTrend.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin datos
            </p>
          ) : (
            <div className="flex items-end gap-2 h-48">
              {monthlyTrend.map((item) => {
                const pct = Math.max(
                  (item.total / maxMonthly) * 100,
                  item.total > 0 ? 4 : 0
                );
                const monthIdx = parseInt(item.month.split("-")[1], 10) - 1;
                return (
                  <div
                    key={item.month}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <span className="text-xs font-medium text-gray-700 mb-1">
                      {item.total > 0
                        ? formatCurrency(item.total)
                        : ""}
                    </span>
                    <div
                      className="w-full bg-green-500 rounded-t-md min-w-[20px] transition-all"
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-xs text-gray-500 mt-1">
                      {MONTH_NAMES[monthIdx]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Payments Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Pagos recientes
          </h3>
          <Link
            href="/admin/finanzas/pagos"
            className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
          >
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
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
                  Servicio
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
              {recentPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    No hay pagos registrados
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(p.paid_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {p.client_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      #{p.request_number}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(p.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {METHOD_LABELS[p.method] || p.method}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}
                      >
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
