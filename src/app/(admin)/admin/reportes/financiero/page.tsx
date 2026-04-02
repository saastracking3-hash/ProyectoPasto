import { Suspense } from "react";
import {
  getRevenueByPeriod,
  getRevenueByServiceType,
  getPaymentMethodDistribution,
  getOutstandingBalance,
  getMonthlyOverview,
} from "@/app/actions/reports";
import FinancieroReportContent from "./FinancieroReportContent";

interface SearchParams {
  periodo?: string;
  desde?: string;
  hasta?: string;
}

function getDateRange(periodo?: string, desde?: string, hasta?: string) {
  const now = new Date();

  if (desde && hasta) {
    return { startDate: desde, endDate: hasta };
  }

  switch (periodo) {
    case "trimestre": {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return {
        startDate: quarterStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
      };
    }
    case "anio": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: yearStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
      };
    }
    case "mes":
    default: {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: monthStart.toISOString().split("T")[0],
        endDate: now.toISOString().split("T")[0],
      };
    }
  }
}

export default async function FinancieroReportPage({
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

  const [revenue, revenueByType, paymentMethods, outstanding, overview] =
    await Promise.all([
      getRevenueByPeriod(startDate, endDate, groupBy),
      getRevenueByServiceType(startDate, endDate),
      getPaymentMethodDistribution(startDate, endDate),
      getOutstandingBalance(),
      getMonthlyOverview(),
    ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <FinancieroReportContent
        revenue={revenue.data ?? []}
        revenueByType={revenueByType.data ?? []}
        paymentMethods={paymentMethods.data ?? []}
        outstandingCents={outstanding.data?.totalCents ?? 0}
        overview={overview.data}
        periodo={params.periodo ?? "mes"}
        desde={params.desde}
        hasta={params.hasta}
      />
    </Suspense>
  );
}
