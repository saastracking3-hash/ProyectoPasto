"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Star,
  Timer,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import LineChart from "@/components/ui/LineChart";
import ExportButton from "@/components/admin/ExportButton";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type { ServiceStatus } from "@/lib/types";

interface Crew {
  id: string;
  name: string;
}

interface CrewPerf {
  crewId: string;
  crewName: string;
  completedCount: number;
  avgDurationMin: number | null;
  avgRating: number | null;
  totalAssignments: number;
}

interface CrewDetail {
  crew: { id: string; name: string; zone: string | null };
  stats: {
    completedCount: number;
    totalAssignments: number;
    avgDurationMin: number | null;
    avgRating: number | null;
    onTimePercent: number | null;
  };
  monthlyPerformance: { month: string; count: number }[];
  recentAssignments: Array<{
    id: string;
    scheduled_date: string;
    actual_start_at: string | null;
    actual_end_at: string | null;
    service_request: {
      id: string;
      request_number: number;
      status: string;
      service_type: { name: string } | null;
      address: { street: string; city: string; zone: string } | null;
    } | null;
  }>;
}

interface Props {
  crews: Crew[];
  allPerformance: CrewPerf[];
  selectedCrewId?: string;
  crewDetail: CrewDetail | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CuadrillasReportContent({
  crews,
  allPerformance,
  selectedCrewId,
  crewDetail,
}: Props) {
  const router = useRouter();

  const handleCrewChange = (crewId: string) => {
    if (crewId === "todas") {
      router.push("/admin/reportes/cuadrillas");
    } else {
      router.push(`/admin/reportes/cuadrillas?cuadrilla=${crewId}`);
    }
  };

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
              Reporte de Cuadrillas
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Rendimiento y estadisticas por cuadrilla
            </p>
          </div>
        </div>

        <select
          value={selectedCrewId ?? "todas"}
          onChange={(e) => handleCrewChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="todas">Todas las cuadrillas</option>
          {crews.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Overview for all crews */}
      {!crewDetail && (
        <>
          <div className="overflow-x-auto">
            <Card>
              <CardHeader>
                <CardTitle>Comparativa de cuadrillas</CardTitle>
                <ExportButton
                  data={allPerformance.map((c) => ({
                    cuadrilla: c.crewName,
                    completados: c.completedCount,
                    total: c.totalAssignments,
                    duracion_promedio: c.avgDurationMin ?? "-",
                    calificacion: c.avgRating ?? "-",
                  }))}
                  headers={[
                    { key: "cuadrilla", label: "Cuadrilla" },
                    { key: "completados", label: "Completados" },
                    { key: "total", label: "Total" },
                    { key: "duracion_promedio", label: "Dur. prom. (min)" },
                    { key: "calificacion", label: "Calificacion" },
                  ]}
                  filename="comparativa-cuadrillas"
                />
              </CardHeader>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Cuadrilla</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Completados</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Total</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">% Completado</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Dur. prom.</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Calificacion</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500"></th>
                  </tr>
                </thead>
                <tbody>
                  {allPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        Sin datos de cuadrillas
                      </td>
                    </tr>
                  ) : (
                    allPerformance.map((c) => (
                      <tr key={c.crewId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium text-gray-900">{c.crewName}</td>
                        <td className="py-3 px-3 text-right">{c.completedCount}</td>
                        <td className="py-3 px-3 text-right">{c.totalAssignments}</td>
                        <td className="py-3 px-3 text-right">
                          {c.totalAssignments > 0
                            ? `${((c.completedCount / c.totalAssignments) * 100).toFixed(0)}%`
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {c.avgDurationMin ? `${c.avgDurationMin} min` : "-"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {c.avgRating ? (
                            <span className="inline-flex items-center gap-1">
                              <Star size={14} className="text-yellow-500 fill-yellow-500" />
                              {c.avgRating}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleCrewChange(c.crewId)}
                            className="text-green-700 hover:text-green-800 text-sm font-medium"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {/* Detail for selected crew */}
      {crewDetail && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<CheckCircle size={20} />}
              title="Servicios completados"
              value={crewDetail.stats.completedCount}
            />
            <StatCard
              icon={<Clock size={20} />}
              title="Duracion promedio"
              value={
                crewDetail.stats.avgDurationMin
                  ? `${crewDetail.stats.avgDurationMin} min`
                  : "-"
              }
            />
            <StatCard
              icon={<Star size={20} />}
              title="Calificacion promedio"
              value={crewDetail.stats.avgRating ?? "-"}
            />
            <StatCard
              icon={<Timer size={20} />}
              title="Puntualidad"
              value={
                crewDetail.stats.onTimePercent !== null
                  ? `${crewDetail.stats.onTimePercent}%`
                  : "-"
              }
            />
          </div>

          {/* Performance over time */}
          <Card>
            <CardHeader>
              <CardTitle>Servicios completados por mes</CardTitle>
            </CardHeader>
            <LineChart
              data={crewDetail.monthlyPerformance.map((m) => ({
                label: m.month,
                value: m.count,
              }))}
              height={220}
            />
          </Card>

          {/* Recent assignments table */}
          <Card>
            <CardHeader>
              <CardTitle>Servicios recientes</CardTitle>
              <ExportButton
                data={crewDetail.recentAssignments.map((a) => ({
                  fecha: a.scheduled_date,
                  numero: a.service_request?.request_number ?? "-",
                  tipo: a.service_request?.service_type?.name ?? "-",
                  direccion: a.service_request?.address
                    ? `${a.service_request.address.street}, ${a.service_request.address.city}`
                    : "-",
                  estado:
                    SERVICE_STATUS_LABELS[
                      a.service_request?.status as ServiceStatus
                    ] ?? a.service_request?.status ?? "-",
                }))}
                headers={[
                  { key: "fecha", label: "Fecha" },
                  { key: "numero", label: "# Solicitud" },
                  { key: "tipo", label: "Tipo" },
                  { key: "direccion", label: "Direccion" },
                  { key: "estado", label: "Estado" },
                ]}
                filename={`servicios-${crewDetail.crew.name}`}
              />
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Fecha</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500"># Solicitud</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Tipo</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Direccion</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {crewDetail.recentAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">
                        Sin servicios recientes
                      </td>
                    </tr>
                  ) : (
                    crewDetail.recentAssignments.map((a) => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-2 text-gray-700">
                          {formatDate(a.scheduled_date)}
                        </td>
                        <td className="py-3 px-2 font-medium text-gray-900">
                          #{a.service_request?.request_number}
                        </td>
                        <td className="py-3 px-2 text-gray-700">
                          {a.service_request?.service_type?.name ?? "-"}
                        </td>
                        <td className="py-3 px-2 text-gray-700">
                          {a.service_request?.address
                            ? `${a.service_request.address.street}, ${a.service_request.address.city}`
                            : "-"}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-xs font-medium">
                            {SERVICE_STATUS_LABELS[
                              a.service_request?.status as ServiceStatus
                            ] ?? a.service_request?.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
