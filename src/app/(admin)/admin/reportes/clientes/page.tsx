import { Suspense } from "react";
import { getTopClients, getClientRetention } from "@/app/actions/reports";
import ClientesReportContent from "./ClientesReportContent";

export default async function ClientesReportPage() {
  const [topClients, retention] = await Promise.all([
    getTopClients(20),
    getClientRetention(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ClientesReportContent
        topClients={topClients.data ?? []}
        retention={retention.data}
      />
    </Suspense>
  );
}
