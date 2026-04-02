"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import type { QuoteStatus, QuoteItemType, Quote, QuoteItem } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";

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
    label: "Pendiente de aprobacion",
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

const itemTypeLabels: Record<QuoteItemType, string> = {
  labor: "Mano de obra",
  material: "Material",
  extra: "Extra",
};

interface QuoteDetail extends Quote {
  items: QuoteItem[];
  service_request_id: string;
  service_request_number: number;
  service_type_name: string;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-gray-200 animate-pulse rounded-lg" />
        <div>
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded" />
          <div className="h-4 w-40 bg-gray-200 animate-pulse rounded mt-2" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

export default function PresupuestoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Fetch quote
        const { data: quoteData, error: qError } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", quoteId)
          .single();
        if (qError) throw new Error("Presupuesto no encontrado");

        // Fetch items
        const { data: items } = await supabase
          .from("quote_items")
          .select("*")
          .eq("quote_id", quoteId)
          .order("sort_order");

        // Fetch service request info
        const { data: svc } = await supabase
          .from("service_requests")
          .select("id, request_number, client_id, service_types(name)")
          .eq("id", quoteData.service_request_id)
          .single();

        // Verify this quote belongs to the current user
        if (svc?.client_id !== user.id) {
          throw new Error("No tenes acceso a este presupuesto");
        }

        setQuote({
          ...quoteData,
          items: items || [],
          service_request_number: svc?.request_number || 0,
          service_type_name: (svc as any)?.service_types?.name || "Servicio",
        } as QuoteDetail);
      } catch (err: any) {
        setError(err.message || "Error al cargar el presupuesto");
      } finally {
        setLoading(false);
      }
    }

    fetchQuote();
  }, [quoteId]);

  const handleApprove = async () => {
    if (!quote) return;
    setApproving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotes")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", quote.id);
      if (error) throw error;

      // Update service request status
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase
        .from("service_requests")
        .update({ status: "approved" })
        .eq("id", quote.service_request_id);

      if (user) {
        await supabase.from("service_state_log").insert({
          service_request_id: quote.service_request_id,
          from_status: "quoted",
          to_status: "approved",
          changed_by: user.id,
          notes: "Presupuesto aprobado por el cliente",
        });
      }

      setQuote((prev) => (prev ? { ...prev, status: "approved" } : null));
    } catch {
      alert("Error al aprobar el presupuesto");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!quote) return;
    setSubmittingReject(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
        })
        .eq("id", quote.id);
      if (error) throw error;

      setQuote((prev) => (prev ? { ...prev, status: "rejected" } : null));
      setRejecting(false);
      setRejectionReason("");
    } catch {
      alert("Error al rechazar el presupuesto");
    } finally {
      setSubmittingReject(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error || !quote) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm">
          {error || "Presupuesto no encontrado"}
        </p>
        <Link
          href="/presupuestos"
          className="text-green-800 text-sm font-medium mt-2 underline"
        >
          Volver a presupuestos
        </Link>
      </div>
    );
  }

  const config = quoteStatusConfig[quote.status];
  const StatusIcon = config.icon;
  const isPending = quote.status === "sent";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/presupuestos"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Presupuesto #{quote.service_request_number}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full ${config.color}`}
            >
              <StatusIcon size={14} />
              {config.label}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            {quote.service_type_name} · Emitido el{" "}
            {formatDate(quote.created_at)}
          </p>
        </div>
      </div>

      {/* Line items table */}
      {quote.items.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Detalle del presupuesto</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                    Descripcion
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                    Tipo
                  </th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                    Cant.
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                    Precio unit.
                  </th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wide pb-3">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {itemTypeLabels[item.item_type]}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-700 text-center">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-sm text-gray-700 text-right">
                      {formatCurrency(item.unit_price_cents)}
                    </td>
                    <td className="py-3 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(item.quantity * item.unit_price_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Totals */}
      <Card>
        <CardTitle className="mb-4">Resumen</CardTitle>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Mano de obra</span>
            <span className="text-gray-900 font-medium">
              {formatCurrency(quote.labor_cost_cents)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Materiales</span>
            <span className="text-gray-900 font-medium">
              {formatCurrency(quote.materials_cost_cents)}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
            <span className="text-base font-semibold text-gray-900">
              Total
            </span>
            <span className="text-lg font-bold text-green-800">
              {formatCurrency(quote.total_cents)}
            </span>
          </div>
        </div>
        {quote.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notas</p>
            <p className="text-sm text-gray-700">{quote.notes}</p>
          </div>
        )}
        {quote.valid_until && (
          <p className="text-xs text-gray-400 mt-3">
            Valido hasta el {formatDate(quote.valid_until)}
          </p>
        )}
      </Card>

      {/* Approve/Reject */}
      {isPending && (
        <Card>
          <CardTitle className="mb-4">Acciones</CardTitle>
          {!rejecting ? (
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                className="flex-1"
                loading={approving}
                disabled={approving}
              >
                <CheckCircle2 size={16} />
                Aprobar presupuesto
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejecting(true)}
                className="flex-1"
                disabled={approving}
              >
                <XCircle size={16} />
                Rechazar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Motivo del rechazo (opcional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Indica por que rechazas el presupuesto..."
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={handleReject}
                  loading={submittingReject}
                  disabled={submittingReject}
                >
                  Confirmar rechazo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejecting(false);
                    setRejectionReason("");
                  }}
                  disabled={submittingReject}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Link back to service */}
      <div className="text-center">
        <Link
          href={`/servicios/${quote.service_request_id}`}
          className="text-sm text-green-800 hover:text-green-700 font-medium inline-flex items-center gap-1"
        >
          <FileText size={14} />
          Ver servicio asociado
        </Link>
      </div>
    </div>
  );
}
