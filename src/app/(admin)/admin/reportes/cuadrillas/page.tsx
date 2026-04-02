import { Suspense } from "react";
import { getCrewPerformance, getCrewPerformanceDetail } from "@/app/actions/reports";
import { getCrews } from "@/app/actions/crews";
import CuadrillasReportContent from "./CuadrillasReportContent";

interface SearchParams {
  cuadrilla?: string;
}

export default async function CuadrillasReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const selectedCrewId = params.cuadrilla;

  const [crewsResult, performanceResult, detailResult] = await Promise.all([
    getCrews(),
    getCrewPerformance(),
    selectedCrewId ? getCrewPerformanceDetail(selectedCrewId) : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <CuadrillasReportContent
        crews={crewsResult.data ?? []}
        allPerformance={performanceResult.data ?? []}
        selectedCrewId={selectedCrewId}
        crewDetail={detailResult.data as any}
      />
    </Suspense>
  );
}
