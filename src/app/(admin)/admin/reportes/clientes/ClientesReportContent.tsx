"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserCheck,
  UserPlus,
  BarChart3,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import PieChart from "@/components/ui/PieChart";
import ExportButton from "@/components/admin/ExportButton";

interface TopClient {
  clientId: string;
  name: string;
  phone: string | null;
  revenue: number;
  services: number;
}

interface Retention {
  totalClients: number;
  returningClients: number;
  newClients: number;
  retentionRate: number;
  avgServicesPerClient: number;
}

interface Props {
  topClients: TopClient[];
  retention: Retention | null;
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function ClientesReportContent({
  topClients,
  retention,
}: Props) {
  const clientTypeData = retention
    ? [
        {
          label: "Recurrentes",
          value: retention.returningClients,
          color: "#16a34a",
        },
        {
          label: "Nuevos",
          value: retention.newClients,
          color: "#3b82f6",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/reportes"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reporte de Clientes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Analisis de clientes y retencion
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={20} />}
          title="Total clientes"
          value={retention?.totalClients ?? 0}
        />
        <StatCard
          icon={<UserCheck size={20} />}
          title="Tasa de retencion"
          value={`${retention?.retentionRate ?? 0}%`}
        />
        <StatCard
          icon={<UserPlus size={20} />}
          title="Clientes nuevos"
          value={retention?.newClients ?? 0}
        />
        <StatCard
          icon={<BarChart3 size={20} />}
          title="Servicios por cliente"
          value={retention?.avgServicesPerClient ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New vs returning chart */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevos vs. Recurrentes</CardTitle>
          </CardHeader>
          <div className="flex justify-center py-4">
            <PieChart
              data={clientTypeData}
              centerLabel="Clientes"
              size={180}
            />
          </div>
        </Card>

        {/* Retention summary */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de retencion</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Clientes totales</span>
              <span className="font-semibold text-gray-900">
                {retention?.totalClients ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Clientes recurrentes</span>
              <span className="font-semibold text-green-700">
                {retention?.returningClients ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Clientes nuevos (1 servicio)</span>
              <span className="font-semibold text-blue-700">
                {retention?.newClients ?? 0}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">Tasa de retencion</span>
              <span className="text-lg font-bold text-green-700">
                {retention?.retentionRate ?? 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Promedio de servicios por cliente
              </span>
              <span className="font-semibold text-gray-900">
                {retention?.avgServicesPerClient ?? 0}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mejores clientes por ingresos</CardTitle>
          <ExportButton
            data={topClients.map((c, i) => ({
              posicion: i + 1,
              nombre: c.name,
              telefono: c.phone ?? "-",
              servicios: c.services,
              ingresos: formatCurrency(c.revenue),
            }))}
            headers={[
              { key: "posicion", label: "#" },
              { key: "nombre", label: "Nombre" },
              { key: "telefono", label: "Telefono" },
              { key: "servicios", label: "Servicios" },
              { key: "ingresos", label: "Ingresos" },
            ]}
            filename="mejores-clientes"
          />
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-medium text-gray-500 w-10">
                  #
                </th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">
                  Cliente
                </th>
                <th className="text-left py-3 px-3 font-medium text-gray-500">
                  Telefono
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Servicios
                </th>
                <th className="text-right py-3 px-3 font-medium text-gray-500">
                  Ingresos
                </th>
              </tr>
            </thead>
            <tbody>
              {topClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    Sin datos de clientes
                  </td>
                </tr>
              ) : (
                topClients.map((c, i) => (
                  <tr
                    key={c.clientId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 px-3 text-gray-400 font-medium">
                      {i + 1}
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-900">
                      {c.name}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {c.phone ?? "-"}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700">
                      {c.services}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-gray-900">
                      {formatCurrency(c.revenue)}
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
