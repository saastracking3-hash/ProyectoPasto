"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import InvoicePreview from "@/components/admin/InvoicePreview";
import { createClient } from "@/lib/supabase/client";
import {
  updateInvoiceStatus,
  markAsPaid,
} from "@/app/actions/invoices";
import type { InvoiceData } from "@/lib/utils/generateInvoicePDF";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceDetail {
  id: string;
  invoice_number: number;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  status: string;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
  client: { full_name: string; phone: string | null } | null;
  service_request: {
    request_number: number;
    service_type: { name: string } | null;
    address: {
      street: string;
      number: string;
      city: string;
      zone: string;
    } | null;
    quotes: {
      total_cents: number;
      notes: string | null;
      items: {
        description: string;
        quantity: number;
        unit_price_cents: number;
        item_type: string;
      }[];
    }[];
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const COMPANY_INFO = {
  name: "The Green Side",
  address: "Buenos Aires, Argentina",
  phone: "+54 11 0000-0000",
  email: "info@thegreenside.com.ar",
  cuit: "30-00000000-0",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FacturaDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("invoices")
          .select(
            `*,
            client:profiles!invoices_client_id_fkey(full_name, phone),
            service_request:service_requests(
              request_number,
              service_type:service_types(name),
              address:addresses(street, number, city, zone),
              quotes(total_cents, notes, items:quote_items(description, quantity, unit_price_cents, item_type))
            )`
          )
          .eq("id", invoiceId)
          .single();

        if (fetchError) throw fetchError;
        setInvoice(data as unknown as InvoiceDetail);
      } catch {
        setError("Error al cargar la factura");
      } finally {
        setLoading(false);
      }
    }

    loadInvoice();
  }, [invoiceId]);

  const handleSend = async () => {
    setActionLoading(true);
    const result = await updateInvoiceStatus(invoiceId, "sent");
    if (result.error) {
      setError(result.error);
    } else {
      setInvoice((prev) =>
        prev ? { ...prev, status: "sent", issued_at: new Date().toISOString() } : prev
      );
    }
    setActionLoading(false);
  };

  const handleMarkPaid = async () => {
    setActionLoading(true);
    const result = await markAsPaid(invoiceId);
    if (result.error) {
      setError(result.error);
    } else {
      setInvoice((prev) =>
        prev ? { ...prev, status: "paid", paid_at: new Date().toISOString() } : prev
      );
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await updateInvoiceStatus(invoiceId, "cancelled");
    if (result.error) {
      setError(result.error);
    } else {
      setInvoice((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 animate-pulse rounded w-48" />
        <div className="h-96 bg-gray-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Factura no encontrada</p>
        <Link
          href="/admin/finanzas/facturas"
          className="text-green-700 text-sm font-medium mt-2 inline-block"
        >
          Volver a facturas
        </Link>
      </div>
    );
  }

  const quote = invoice.service_request?.quotes?.[0];
  const quoteItems = quote?.items || [];
  const address = invoice.service_request?.address;

  const clientAddress = address
    ? `${address.street} ${address.number}, ${address.city} - ${address.zone}`
    : "";

  const invoiceItems = quoteItems.length > 0
    ? quoteItems.map((qi) => ({
        description: qi.description,
        quantity: qi.quantity,
        unitPrice: qi.unit_price_cents,
        total: qi.quantity * qi.unit_price_cents,
      }))
    : [
        {
          description: invoice.service_request?.service_type?.name ?? "Servicio",
          quantity: 1,
          unitPrice: invoice.subtotal_cents,
          total: invoice.subtotal_cents,
        },
      ];

  const invoiceData: InvoiceData = {
    invoiceNumber: `FAC-${String(invoice.invoice_number).padStart(6, "0")}`,
    issuedAt: invoice.issued_at ?? invoice.created_at,
    dueAt:
      invoice.due_at ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    company: COMPANY_INFO,
    client: {
      name: invoice.client?.full_name ?? "Cliente",
      address: clientAddress,
      phone: invoice.client?.phone ?? "",
      email: "",
    },
    items: invoiceItems,
    subtotal: invoice.subtotal_cents,
    tax: invoice.tax_cents,
    total: invoice.total_cents,
    paymentMethod: "Transferencia bancaria",
    notes: quote?.notes ?? undefined,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/finanzas/facturas"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Factura #{invoice.invoice_number}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full mt-1 ${STATUS_COLORS[invoice.status] || "bg-gray-100 text-gray-700"}`}
            >
              {STATUS_LABELS[invoice.status] || invoice.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {invoice.status === "draft" && (
            <Button
              variant="primary"
              onClick={handleSend}
              loading={actionLoading}
              disabled={actionLoading}
            >
              <Send size={16} />
              Enviar
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "draft") && (
            <Button
              variant="secondary"
              onClick={handleMarkPaid}
              loading={actionLoading}
              disabled={actionLoading}
            >
              <CheckCircle size={16} />
              Marcar pagada
            </Button>
          )}
          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
            <Button
              variant="danger"
              onClick={handleCancel}
              loading={actionLoading}
              disabled={actionLoading}
            >
              <XCircle size={16} />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Invoice preview with download & print */}
      <InvoicePreview data={invoiceData} />
    </div>
  );
}
