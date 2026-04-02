"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Users,
  Wallet,
  ArrowRight,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import LineChart from "@/components/ui/LineChart";
import BarChart from "@/components/ui/BarChart";
import PieChart from "@/components/ui/PieChart";
import ExportButton from "@/components/admin/ExportButton";

const STATUS_COLORS: Record<string, string> = {
  request_created: "#9ca3af",
  pending_review: "#eab308",
  quoted: "#3b82f6",
  pending_approval: "#f97316",
  approved: "#22c55e",
  scheduled: "#6366f1",
  crew_assigned: "#a855f7",
  in_transit: "#06b6d4",
  arrived: "#14b8a6",
  in_progress: "#16a34a",
  paused: "#f59e0b",
  completed_by_crew: "#10b981",
  validated: "#15803d",
  closed: "#6b7280",
  cancelled: "#ef4444",
};

const CHART_COLORS = [
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#c026d3",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
];

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface ReportesContentProps {
  overview: {
    thisMonth: { services: number; revenueCents: number; avgTicketCents: number };
    lastMonth: { services: number; revenueCents: number; avgTicketCents: number };
    changes: { services: number; revenue: number; avgTicket: number };
  } | null;
  revenue: { period: string; totalCents: number }[];
  servicesByType: { type: string; count: number }[];
  servicesByZone: { zone: string; count: number }[];
  servicesByStatus: { status: string; count: number; label: string }[];
  crewPerformance: {
    crewId: string;
    crewName: string;
    completedCount: number;
    avgDurationMin: number | null;
    avgRating: number | null;
    totalAssignments: number;
  }[];
  conversion: { totalRequests: number; closedRequests: number; rate: number } | null;
  periodo: string;
  desde?: string;
  hasta?: string;
}

export default function ReportesContent({
  overview,
  revenue,
  servicesByType,
  servicesByZone,
  servicesByStatus,
  crewPerformance,
  conversion,
  periodo,
  desde,
  hasta,
}: ReportesContentProps) {
  const router = useRouter();
  const [customFrom, setCustomFrom] = useState(desde ?? "");
  const [customTo, setCustomTo] = useState(hasta ?? "");

  const handlePeriodChange = (newPeriodo: string) => {
    router.push(`/admin/reportes?periodo=${newPeriodo}`);
  };

  const handleCustomRange = () => {
    if (customFrom && customTo) {
      router.push(
        `/admin/reportes?periodo=custom&desde=${customFrom}&hasta=${customTo}`
      );
    }
  };

  const revenueChartData = revenue.map((r) => ({
    label: r.period.length > 7 ? r.period.slice(5) : r.period,
    value: r.totalCents / 100,
  }));

  const typeChartData = servicesByType.map((s, i) => ({
    label: s.type,
    value: s.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const zoneChartData = servicesByZone.map((s, i) => ({
    label: s.zone,
    value: s.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const statusChartData = servicesByStatus.map((s) => ({
    label: s.label,
    value: s.count,
    color: STATUS_COLORS[s.status] ?? "#6b7280",
  }));

  const periods = [
    { value: "semana", label: "Semana" },
    { value: "mes", label: "Mes" },
    { value: "trimestre", label: "Trimestre" },
    { value: "anio", label: "Ano" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Analisis general del negocio
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/reportes/cuadrillas"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Users size={16} />
            Cuadrillas
          </Link>
          <Link
            href="/admin/reportes/clientes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <BarChart3 size={16} />
            Clientes
          </Link>
          <Link
            href="/admin/reportes/financiero"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Wallet size={16} />
            Financiero
          </Link>
        </div>
      </div>

      {/* Date range selector */}
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

      {/* KPI cards */}
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
          icon={<CheckCircle size={20} />}
          title="Servicios completados"
          value={overview?.thisMonth.services ?? 0}
          trend={
            overview
              ? { value: overview.changes.services, label: "vs. mes anterior" }
              : undefined
          }
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          title="Ticket promedio"
          value={formatCurrency(overview?.thisMonth.avgTicketCents ?? 0)}
          trend={
            overview
              ? { value: overview.changes.avgTicket, label: "vs. mes anterior" }
              : undefined
          }
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          title="Tasa de conversion"
          value={`${conversion?.rate ?? 0}%`}
          trend={{
            value: conversion?.rate ?? 0,
            label: `${conversion?.closedRequests ?? 0} de ${conversion?.totalRequests ?? 0} solicitudes`,
          }}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue line chart */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por periodo</CardTitle>
          </CardHeader>
          <LineChart data={revenueChartData} height={220} />
        </Card>

        {/* Services by type */}
        <Card>
          <CardHeader>
            <CardTitle>Servicios por tipo</CardTitle>
            <ExportButton
              data={servicesByType.map((s) => ({
                tipo: s.type,
                cantidad: s.count,
              }))}
              headers={[
                { key: "tipo", label: "Tipo" },
                { key: "cantidad", label: "Cantidad" },
              ]}
              filename="servicios-por-tipo"
            />
          </CardHeader>
          <BarChart data={typeChartData} height={220} />
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Services by zone */}
        <Card>
          <CardHeader>
            <CardTitle>Servicios por zona</CardTitle>
          </CardHeader>
          <BarChart data={zoneChartData} height={220} />
        </Card>

        {/* Services by status */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de servicios</CardTitle>
          </CardHeader>
          <div className="flex justify-center">
            <PieChart
              data={statusChartData}
              centerLabel="Total"
              size={200}
            />
          </div>
        </Card>
      </div>

      {/* Crew Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento de cuadrillas</CardTitle>
          <div className="flex items-center gap-2">
            <ExportButton
              data={crewPerformance.map((c) => ({
                cuadrilla: c.crewName,
                completados: c.completedCount,
                total: c.totalAssignments,
                duracion_promedio: c.avgDurationMin ?? "-",
                calificacion: c.avgRating ?? "-",
              }))}
              headers={[
                { key: "cuadrilla", label: "Cuadrilla" },
                { key: "completados", label: "Completados" },
                { key: "total", label: "Total asignaciones" },
                { key: "duracion_promedio", label: "Duracion promedio (min)" },
                { key: "calificacion", label: "Calificacion" },
              ]}
              filename="rendimiento-cuadrillas"
            />
            <Link
              href="/admin/reportes/cuadrillas"
              className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
            >
              Ver detalle
              <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">
                  Cuadrilla
                </th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">
                  Completados
                </th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">
                  Total
                </th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">
                  Duracion prom.
                </th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">
                  Calificacion
                </th>
              </tr>
            </thead>
            <tbody>
              {crewPerformance.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-gray-400"
                  >
                    Sin datos de cuadrillas
                  </td>
                </tr>
              ) : (
                crewPerformance.map((c) => (
                  <tr
                    key={c.crewId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-2 font-medium text-gray-900">
                      {c.crewName}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700">
                      {c.completedCount}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700">
                      {c.totalAssignments}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-700">
                      {c.avgDurationMin ? `${c.avgDurationMin} min` : "-"}
                    </td>
                    <td className="py-3 px-2 text-right">
                      {c.avgRating ? (
                        <span className="inline-flex items-center gap-1">
                          <svg
                            className="w-4 h-4 text-yellow-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {c.avgRating}
                        </span>
                      ) : (
                        "-"
                      )}
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
