"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import type { QuoteStatus } from "@/lib/types";
import {
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface QuoteRow {
  id: string;
  service_request_number: number;
  service_type_name: string;
  total_cents: number;
  status: QuoteStatus;
  created_at: string;
}

const quoteStatusConfig: Record<
  QuoteStatus,
  { label: string; color: string; icon: typeof Clock }
> = {
  draft: {
    label: "Borrador",
    color: "bg-gray-100 text-gray-700",
    icon: Clock,
  },
  sent: {
    label: "Pendiente",
    color: "bg-orange-100 text-orange-700",
    icon: Clock,
  },
  approved: {
    label: "Aprobado",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rechazado",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  expired: {
    label: "Vencido",
    color: "bg-gray-100 text-gray-500",
    icon: Clock,
  },
};

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function PresupuestosPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuotes() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Get all client service request ids
        const { data: services, error: svcError } = await supabase
          .from("service_requests")
          .select("id, request_number, service_types(name)")
          .eq("client_id", user.id);
        if (svcError) throw svcError;

        if (!services || services.length === 0) {
          setQuotes([]);
          return;
        }

        const serviceMap = new Map(
          services.map((s: any) => [
            s.id,
            {
              request_number: s.request_number,
              service_type_name: s.service_types?.name || "Servicio",
            },
          ])
        );

        const serviceIds = services.map((s: any) => s.id);

        const { data: quotesData, error: qError } = await supabase
          .from("quotes")
          .select("*")
          .in("service_request_id", serviceIds)
          .order("created_at", { ascending: false });
        if (qError) throw qError;

        setQuotes(
          (quotesData || []).map((q: any) => {
            const svc = serviceMap.get(q.service_request_id);
            return {
              id: q.id,
              service_request_number: svc?.request_number || 0,
              service_type_name: svc?.service_type_name || "Servicio",
              total_cents: q.total_cents,
              status: q.status as QuoteStatus,
              created_at: q.created_at,
            };
          })
        );
      } catch (err: any) {
        setError(err.message || "Error al cargar los presupuestos");
      } finally {
        setLoading(false);
      }
    }

    fetchQuotes();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
        <p className="text-gray-500 mt-1">
          Revisa y aproba los presupuestos de tus servicios.
        </p>
      </div>

      {error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-green-800 text-sm font-medium mt-2 underline"
          >
            Reintentar
          </button>
        </div>
      ) : loading ? (
        <ListSkeleton />
      ) : quotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={28} />}
            title="Sin presupuestos"
            description="Todavia no tenes presupuestos. Solicita un servicio para recibir uno."
            action={
              <Link
                href="/solicitar"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-800 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                Solicitar servicio
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const config = quoteStatusConfig[quote.status];
            const StatusIcon = config.icon;
            return (
              <Link key={quote.id} href={`/presupuestos/${quote.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-gray-900">
                          #{quote.service_request_number}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${config.color}`}
                        >
                          <StatusIcon size={12} />
                          {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {quote.service_type_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(quote.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(quote.total_cents)}
                      </span>
                      <ArrowRight
                        size={18}
                        className="text-gray-400 shrink-0"
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
