"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Send,
  User,
  FileText,
  Calendar,
  Clock,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { QuoteStatus, QuoteItemType } from "@/lib/types";

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  approved: "Aprobado",
  rejected: "Rechazado",
  expired: "Vencido",
};

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

const ITEM_TYPE_LABELS: Record<QuoteItemType, string> = {
  labor: "Mano de obra",
  material: "Material",
  extra: "Extra",
};

interface QuoteDetail {
  id: string;
  status: QuoteStatus;
  labor_cost_cents: number;
  materials_cost_cents: number;
  total_cents: number;
  notes: string | null;
  valid_until: string | null;
  created_at: string;
  service_request_id: string;
  request_number: number;
  client_name: string;
  client_phone: string | null;
  service_type: string;
  address: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    unit_price_cents: number;
    item_type: QuoteItemType;
  }[];
}

export default function PresupuestoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError("No autenticado"); setLoading(false); return; }

        const [quoteRes, itemsRes] = await Promise.all([
          supabase
            .from("quotes")
            .select(
              "*, service_requests!inner(request_number, client_id, service_type_id, address_id, profiles!service_requests_client_id_fkey(full_name, phone), service_types!inner(name), addresses!inner(street, number, city, zone))"
            )
            .eq("id", id)
            .single(),
          supabase
            .from("quote_items")
            .select("*")
            .eq("quote_id", id)
            .order("sort_order", { ascending: true }),
        ]);

        if (quoteRes.error) throw quoteRes.error;

        const d = quoteRes.data as Record<string, unknown>;
        const sr = d.service_requests as Record<string, unknown>;
        const profile = sr.profiles as { full_name: string; phone: string | null } | null;
        const st = sr.service_types as { name: string } | null;
        const addr = sr.addresses as { street: string; number: string; city: string; zone: string } | null;

        const detail: QuoteDetail = {
          id: d.id as string,
          status: d.status as QuoteStatus,
          labor_cost_cents: d.labor_cost_cents as number,
          materials_cost_cents: d.materials_cost_cents as number,
          total_cents: d.total_cents as number,
          notes: d.notes as string | null,
          valid_until: d.valid_until as string | null,
          created_at: d.created_at as string,
          service_request_id: d.service_request_id as string,
          request_number: sr.request_number as number,
          client_name: profile?.full_name ?? "Sin nombre",
          client_phone: profile?.phone ?? null,
          service_type: st?.name ?? "-",
          address: addr
            ? `${addr.street} ${addr.number}, ${addr.city} - ${addr.zone}`
            : "-",
          items: (itemsRes.data || []).map((item: Record<string, unknown>) => ({
            id: item.id as string,
            description: item.description as string,
            quantity: item.quantity as number,
            unit_price_cents: item.unit_price_cents as number,
            item_type: item.item_type as QuoteItemType,
          })),
        };

        setQuote(detail);
      } catch {
        setError("Error al cargar el presupuesto");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleSend = async () => {
    if (!quote || quote.status !== "draft") return;
    setSending(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const { error: upErr } = await supabase
      .from("quotes")
      .update({ status: "sent" })
      .eq("id", quote.id);

    if (!upErr) {
      await supabase
        .from("service_requests")
        .update({ status: "pending_approval" })
        .eq("id", quote.service_request_id);

      await supabase.from("service_state_log").insert({
        service_request_id: quote.service_request_id,
        from_status: "quoted",
        to_status: "pending_approval",
        changed_by: user.id,
        notes: "Presupuesto enviado al cliente",
      });

      setQuote({ ...quote, status: "sent" });
    } else {
      setError("Error al enviar presupuesto");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 bg-gray-200 animate-pulse rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !quote) {
    return <div className="p-8 text-center text-red-600"><p>{error}</p></div>;
  }

  if (!quote) return null;

  const extrasTotal = quote.total_cents - quote.labor_cost_cents - quote.materials_cost_cents;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/presupuestos"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Presupuesto - Solicitud #{quote.request_number}
              </h1>
              <span
                className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
                  QUOTE_STATUS_COLORS[quote.status]
                }`}
              >
                {QUOTE_STATUS_LABELS[quote.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Creado el {formatDate(quote.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/presupuestos/${quote.id}/editar`}>
            <Button variant="secondary">
              <Edit size={16} />
              Editar
            </Button>
          </Link>
          {quote.status === "draft" && (
            <Button onClick={handleSend} loading={sending}>
              <Send size={16} />
              Enviar al cliente
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <Card padding={false}>
            <div className="p-4 border-b border-gray-200">
              <CardTitle>Items del presupuesto</CardTitle>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Descripcion</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">Cant.</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Precio unit.</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(item.unit_price_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {ITEM_TYPE_LABELS[item.item_type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(item.quantity * item.unit_price_cents)}
                      </td>
                    </tr>
                  ))}
                  {quote.items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                        Sin items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex flex-col items-end gap-1 text-sm">
                <div className="flex justify-between w-48">
                  <span className="text-gray-500">Mano de obra:</span>
                  <span className="text-gray-900">{formatCurrency(quote.labor_cost_cents)}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span className="text-gray-500">Materiales:</span>
                  <span className="text-gray-900">{formatCurrency(quote.materials_cost_cents)}</span>
                </div>
                <div className="flex justify-between w-48">
                  <span className="text-gray-500">Extras:</span>
                  <span className="text-gray-900">{formatCurrency(extrasTotal > 0 ? extrasTotal : 0)}</span>
                </div>
                <div className="flex justify-between w-48 pt-2 border-t border-gray-200 mt-1">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-gray-900 text-base">
                    {formatCurrency(quote.total_cents)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                {quote.notes}
              </p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacion</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Cliente</p>
                  <p className="text-sm font-medium text-gray-900">{quote.client_name}</p>
                  {quote.client_phone && (
                    <p className="text-xs text-gray-500">{quote.client_phone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Servicio</p>
                  <p className="text-sm font-medium text-gray-900">{quote.service_type}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Valido hasta</p>
                  <p className="text-sm font-medium text-gray-900">
                    {quote.valid_until ? formatDate(quote.valid_until) : "-"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Creado</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(quote.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solicitud relacionada</CardTitle>
            </CardHeader>
            <Link
              href={`/admin/solicitudes/${quote.service_request_id}`}
              className="text-sm text-green-700 hover:text-green-800 font-medium"
            >
              Ver solicitud #{quote.request_number}
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
