"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Wallet,
  CreditCard,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import LineChart from "@/components/ui/LineChart";
import BarChart from "@/components/ui/BarChart";
import PieChart from "@/components/ui/PieChart";
import ExportButton from "@/components/admin/ExportButton";

const CHART_COLORS = [
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#c026d3",
  "#ea580c",
];

const PAYMENT_COLORS: Record<string, string> = {
  Transferencia: "#2563eb",
  Efectivo: "#16a34a",
  Tarjeta: "#d97706",
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface Props {
  revenue: { period: string; totalCents: number }[];
  revenueByType: { type: string; totalCents: number }[];
  paymentMethods: { method: string; totalCents: number }[];
  outstandingCents: number;
  overview: {
    thisMonth: { services: number; revenueCents: number; avgTicketCents: number };
    lastMonth: { services: number; revenueCents: number; avgTicketCents: number };
    changes: { services: number; revenue: number; avgTicket: number };
  } | null;
  periodo: string;
  desde?: string;
  hasta?: string;
}

export default function FinancieroReportContent({
  revenue,
  revenueByType,
  paymentMethods,
  outstandingCents,
  overview,
  periodo,
  desde,
  hasta,
}: Props) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(desde ?? "");
  const [customTo, setCustomTo] = useState(hasta ?? "");

  const handlePeriodChange = (newPeriodo: string) => {
    router.push(`/admin/reportes/financiero?periodo=${newPeriodo}`);
  };

  const handleCustomRange = () => {
    if (customFrom && customTo) {
      router.push(
        `/admin/reportes/financiero?periodo=custom&desde=${customFrom}&hasta=${customTo}`
      );
    }
  };

  const revenueChartData = revenue.map((r) => ({
    label: r.period.length > 7 ? r.period.slice(5) : r.period,
    value: r.totalCents / 100,
  }));

  const typeChartData = revenueByType.map((r, i) => ({
    label: r.type,
    value: r.totalCents / 100,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const paymentChartData = paymentMethods.map((p) => ({
    label: p.method,
    value: p.totalCents / 100,
    color: PAYMENT_COLORS[p.method] ?? "#6b7280",
  }));

  const totalRevenue = revenue.reduce((sum, r) => sum + r.totalCents, 0);

  const periods = [
    { value: "mes", label: "Mes" },
    { value: "trimestre", label: "Trimestre" },
    { value: "anio", label: "Ano" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/reportes"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Reporte Financiero
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Ingresos, pagos y balances
            </p>
          </div>
        </div>
      </div>

      {/* Date range */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Periodo:</span>
          <div className="flex flex-wrap gap-2">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  periodo === p.value
                    ? "bg-green-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleCustomRange}
              className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700"
            >
              Aplicar
            </button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign size={20} />}
          title="Ingresos del mes"
          value={formatCurrency(overview?.thisMonth.revenueCents ?? 0)}
          trend={
            overview
              ? { value: overview.changes.revenue, label: "vs. mes anterior" }
              : undefined
          }
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          title="Ingresos del periodo"
          value={formatCurrency(totalRevenue)}
        />
        <StatCard
          icon={<CreditCard size={20} />}
          title="Ticket promedio"
          value={formatCurrency(overview?.thisMonth.avgTicketCents ?? 0)}
          trend={
            overview
              ? { value: overview.changes.avgTicket, label: "vs. mes anterior" }
              : undefined
          }
        />
        <StatCard
          icon={<Wallet size={20} />}
          title="Saldo pendiente"
          value={formatCurrency(outstandingCents)}
        />
      </div>

      {/* Revenue line chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por periodo</CardTitle>
          <ExportButton
            data={revenue.map((r) => ({
              periodo: r.period,
              ingresos: formatCurrency(r.totalCents),
            }))}
            headers={[
              { key: "periodo", label: "Periodo" },
              { key: "ingresos", label: "Ingresos" },
            ]}
            filename="ingresos-por-periodo"
          />
        </CardHeader>
        <LineChart data={revenueChartData} height={250} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by service type */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por tipo de servicio</CardTitle>
          </CardHeader>
          <BarChart data={typeChartData} height={220} />
        </Card>

        {/* Payment method distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Metodos de pago</CardTitle>
          </CardHeader>
          <div className="flex justify-center py-4">
            <PieChart
              data={paymentChartData}
              centerLabel="Total"
              size={180}
            />
          </div>
        </Card>
      </div>

      {/* Monthly comparison table */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativa mensual</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-medium text-gray-500">
                  Metrica
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Mes anterior
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Mes actual
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Cambio
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium text-gray-900">
                  Ingresos
                </td>
                <td className="py-3 px-3 text-right text-gray-700">
                  {formatCurrency(overview?.lastMonth.revenueCents ?? 0)}
                </td>
                <td className="py-3 px-3 text-right font-medium text-gray-900">
                  {formatCurrency(overview?.thisMonth.revenueCents ?? 0)}
                </td>
                <td className="py-3 px-3 text-right">
                  <span
                    className={`font-medium ${
                      (overview?.changes.revenue ?? 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(overview?.changes.revenue ?? 0) >= 0 ? "+" : ""}
                    {overview?.changes.revenue ?? 0}%
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium text-gray-900">
                  Servicios
                </td>
                <td className="py-3 px-3 text-right text-gray-700">
                  {overview?.lastMonth.services ?? 0}
                </td>
                <td className="py-3 px-3 text-right font-medium text-gray-900">
                  {overview?.thisMonth.services ?? 0}
                </td>
                <td className="py-3 px-3 text-right">
                  <span
                    className={`font-medium ${
                      (overview?.changes.services ?? 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(overview?.changes.services ?? 0) >= 0 ? "+" : ""}
                    {overview?.changes.services ?? 0}%
                  </span>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium text-gray-900">
                  Ticket promedio
                </td>
                <td className="py-3 px-3 text-right text-gray-700">
                  {formatCurrency(overview?.lastMonth.avgTicketCents ?? 0)}
                </td>
                <td className="py-3 px-3 text-right font-medium text-gray-900">
                  {formatCurrency(overview?.thisMonth.avgTicketCents ?? 0)}
                </td>
                <td className="py-3 px-3 text-right">
                  <span
                    className={`font-medium ${
                      (overview?.changes.avgTicket ?? 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(overview?.changes.avgTicket ?? 0) >= 0 ? "+" : ""}
                    {overview?.changes.avgTicket ?? 0}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
