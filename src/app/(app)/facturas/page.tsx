"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceRow {
  id: string;
  invoice_number: number;
  total_cents: number;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  request_number: number;
  service_type_name: string;
}

const STATUS_CONFIG: Record<
  string,
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
    icon: Send,
  },
  paid: {
    label: "Pagada",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelada",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClientFacturasPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        const { data, error: fetchError } = await supabase
          .from("invoices")
          .select(
            "*, service_request:service_requests(request_number, service_type:service_types(name))"
          )
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        setInvoices(
          (data || []).map((inv: any) => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            total_cents: inv.total_cents,
            status: inv.status,
            issued_at: inv.issued_at,
            due_at: inv.due_at,
            paid_at: inv.paid_at,
            created_at: inv.created_at,
            request_number:
              inv.service_request?.request_number ?? 0,
            service_type_name:
              inv.service_request?.service_type?.name ?? "Servicio",
          }))
        );
      } catch (err: any) {
        setError(err.message || "Error al cargar las facturas");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis facturas</h1>
        <p className="text-gray-500 mt-1">
          Facturas emitidas por tus servicios.
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
      ) : invoices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={28} />}
            title="Sin facturas"
            description="Todavia no tenes facturas emitidas."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => {
            const config =
              STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
            const StatusIcon = config.icon;

            return (
              <Card key={inv.id} className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        Factura #{inv.invoice_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${config.color}`}
                      >
                        <StatusIcon size={12} />
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {inv.service_type_name} (#{inv.request_number})
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {inv.issued_at && (
                        <span className="text-xs text-gray-500">
                          Emitida: {formatDate(inv.issued_at)}
                        </span>
                      )}
                      {inv.due_at && (
                        <span className="text-xs text-gray-500">
                          Vence: {formatDate(inv.due_at)}
                        </span>
                      )}
                      {inv.paid_at && (
                        <span className="text-xs text-green-600 font-medium">
                          Pagada: {formatDate(inv.paid_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(inv.total_cents)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
