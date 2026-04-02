import { Suspense } from "react";
import {
  getMonthlyOverview,
  getRevenueByPeriod,
  getServicesByType,
  getServicesByZone,
  getServicesByStatus,
  getCrewPerformance,
  getConversionRate,
} from "@/app/actions/reports";
import { SERVICE_STATUS_LABELS } from "@/lib/types";
import type { ServiceStatus } from "@/lib/types";
import ReportesContent from "./ReportesContent";

interface SearchParams {
  periodo?: string;
  desde?: string;
  hasta?: string;
}

function getDateRange(periodo?: string, desde?: string, hasta?: string) {
  const now = new Date();

  if (desde && hasta) {
    return { startDate: desde, endDate: hasta, label: "Personalizado" };
  }

  switch (periodo) {
    case "semana": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return {
        startDate: start.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        label: "Esta semana",
      };
    }
    case "trimestre": {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return {
        startDate: quarterStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        label: "Este trimestre",
      };
    }
    case "anio": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: yearStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        label: "Este ano",
      };
    }
    case "mes":
    default: {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: monthStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
        label: "Este mes",
      };
    }
  }
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { startDate, endDate } = getDateRange(
    params.periodo,
    params.desde,
    params.hasta
  );

  const groupBy =
    params.periodo === "anio"
      ? "month"
      : params.periodo === "trimestre"
        ? "week"
        : "day";

  const [
    overview,
    revenue,
    servicesByType,
    servicesByZone,
    servicesByStatus,
    crewPerformance,
    conversion,
  ] = await Promise.all([
    getMonthlyOverview(),
    getRevenueByPeriod(startDate, endDate, groupBy),
    getServicesByType(startDate, endDate),
    getServicesByZone(startDate, endDate),
    getServicesByStatus(),
    getCrewPerformance(),
    getConversionRate(startDate, endDate),
  ]);

  // Map status data with labels
  const statusData = (servicesByStatus.data ?? []).map((s) => ({
    ...s,
    label: SERVICE_STATUS_LABELS[s.status as ServiceStatus] ?? s.status,
  }));

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ReportesContent
        overview={overview.data}
        revenue={revenue.data ?? []}
        servicesByType={servicesByType.data ?? []}
        servicesByZone={servicesByZone.data ?? []}
        servicesByStatus={statusData}
        crewPerformance={crewPerformance.data ?? []}
        conversion={conversion.data}
        periodo={params.periodo ?? "mes"}
        desde={params.desde}
        hasta={params.hasta}
      />
    </Suspense>
  );
}
