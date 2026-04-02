"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  generateInvoicePDF,
  type InvoiceData,
} from "@/lib/utils/generateInvoicePDF";

interface InvoicePDFButtonProps {
  /** The quote ID to fetch data for and generate the invoice */
  quoteId: string;
  /** Optional invoice number override (defaults to quote-based number) */
  invoiceNumber?: string;
  /** Button size variant */
  size?: "sm" | "md" | "lg";
}

const COMPANY_INFO = {
  name: "The Green Side",
  address: "Buenos Aires, Argentina",
  phone: "+54 11 1234-5678",
  email: "info@thegreenside.com.ar",
  cuit: "30-12345678-9",
};

export default function InvoicePDFButton({
  quoteId,
  invoiceNumber,
  size = "md",
}: InvoicePDFButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);

    try {
      const supabase = createClient();

      // Fetch quote with items
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*, quote_items(*)")
        .eq("id", quoteId)
        .single();

      if (quoteError || !quote) {
        throw new Error("No se pudo obtener el presupuesto");
      }

      // Fetch the service request to get client info
      const { data: serviceRequest, error: srError } = await supabase
        .from("service_requests")
        .select("*, address:addresses(*), client:profiles(*)")
        .eq("id", quote.service_request_id)
        .single();

      if (srError || !serviceRequest) {
        throw new Error("No se pudo obtener la solicitud de servicio");
      }

      const client = serviceRequest.client;
      const address = serviceRequest.address;

      // Build items from quote_items
      const items =
        (quote.quote_items ?? [])
          .sort(
            (a: { sort_order: number }, b: { sort_order: number }) =>
              a.sort_order - b.sort_order
          )
          .map(
            (qi: {
              description: string;
              quantity: number;
              unit_price_cents: number;
            }) => ({
              description: qi.description,
              quantity: qi.quantity,
              unitPrice: qi.unit_price_cents,
              total: qi.quantity * qi.unit_price_cents,
            })
          );

      const subtotal = items.reduce(
        (sum: number, item: { total: number }) => sum + item.total,
        0
      );
      const tax = Math.round(subtotal * 0.21);
      const total = subtotal + tax;

      const clientAddress = address
        ? `${address.street} ${address.number}${address.floor_apt ? `, ${address.floor_apt}` : ""}, ${address.city}`
        : "";

      const invoiceData: InvoiceData = {
        invoiceNumber:
          invoiceNumber ??
          `FAC-${String(serviceRequest.request_number).padStart(6, "0")}`,
        issuedAt: new Date().toISOString(),
        dueAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        company: COMPANY_INFO,
        client: {
          name: client?.full_name ?? "Cliente",
          address: clientAddress,
          phone: client?.phone ?? "",
          email: "", // email comes from auth, not profiles
        },
        items,
        subtotal,
        tax,
        total,
        paymentMethod: "Transferencia bancaria",
        notes: quote.notes ?? undefined,
      };

      const blob = generateInvoicePDF(invoiceData);

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `factura-${invoiceData.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generando factura:", err);
      alert("Error al generar la factura. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="primary"
      size={size}
      loading={loading}
      onClick={handleDownload}
    >
      <Download className="h-4 w-4" />
      Descargar Factura
    </Button>
  );
}
