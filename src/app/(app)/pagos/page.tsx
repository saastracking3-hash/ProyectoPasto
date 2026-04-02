"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  DollarSign,
  Banknote,
  CreditCard,
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PaymentRow {
  id: string;
  amount_cents: number;
  method: string;
  status: string;
  paid_at: string;
  request_number: number;
  service_type_name: string;
}

const METHOD_CONFIG: Record<
  string,
  { label: string; icon: typeof DollarSign }
> = {
  cash: { label: "Efectivo", icon: Banknote },
  transfer: { label: "Transferencia", icon: CreditCard },
  qr: { label: "QR", icon: QrCode },
  mercadopago: { label: "MercadoPago", icon: Smartphone },
  other: { label: "Otro", icon: DollarSign },
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  completed: {
    label: "Cobrado",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  refunded: {
    label: "Reembolsado",
    color: "bg-gray-100 text-gray-700",
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

export default function ClientPagosPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) throw new Error("No se pudo obtener el usuario");

        // Get client service request ids
        const { data: services, error: svcError } = await supabase
          .from("service_requests")
          .select("id, request_number, service_types(name)")
          .eq("client_id", user.id);
        if (svcError) throw svcError;

        if (!services || services.length === 0) {
          setPayments([]);
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

        const { data: paymentsData, error: pError } = await supabase
          .from("payments")
          .select("*")
          .in("service_request_id", serviceIds)
          .order("paid_at", { ascending: false });
        if (pError) throw pError;

        setPayments(
          (paymentsData || []).map((p: any) => {
            const svc = serviceMap.get(p.service_request_id);
            return {
              id: p.id,
              amount_cents: p.amount_cents,
              method: p.method,
              status: p.status,
              paid_at: p.paid_at,
              request_number: svc?.request_number || 0,
              service_type_name: svc?.service_type_name || "Servicio",
            };
          })
        );
      } catch (err: any) {
        setError(err.message || "Error al cargar los pagos");
      } finally {
        setLoading(false);
      }
    }

    fetchPayments();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis pagos</h1>
        <p className="text-gray-500 mt-1">
          Historial de pagos de tus servicios.
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
      ) : payments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DollarSign size={28} />}
            title="Sin pagos"
            description="Todavia no tenes pagos registrados."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const methodConf =
              METHOD_CONFIG[payment.method] || METHOD_CONFIG.other;
            const statusConf =
              STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
            const MethodIcon = methodConf.icon;
            const StatusIcon = statusConf.icon;

            return (
              <Card key={payment.id} className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        #{payment.request_number}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full ${statusConf.color}`}
                      >
                        <StatusIcon size={12} />
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      {payment.service_type_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <MethodIcon size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {methodConf.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(payment.paid_at)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(payment.amount_cents)}
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
