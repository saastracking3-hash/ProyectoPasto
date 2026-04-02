"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface InvoiceFilters {
  status?: InvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

/* ------------------------------------------------------------------ */
/*  Create Invoice                                                     */
/* ------------------------------------------------------------------ */

export async function createInvoice(
  serviceRequestId: string,
  clientId: string,
  subtotalCents: number,
  taxCents: number,
  totalCents: number,
  dueAt?: string,
  status: InvoiceStatus = "draft"
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const insertData: Record<string, unknown> = {
      service_request_id: serviceRequestId,
      client_id: clientId,
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      status,
      due_at: dueAt ?? null,
    };

    if (status === "sent") {
      insertData.issued_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("invoices")
      .insert(insertData)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al crear la factura" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Invoice                                                        */
/* ------------------------------------------------------------------ */

export async function getInvoice(invoiceId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `*,
        client:profiles!invoices_client_id_fkey(full_name, phone),
        service_request:service_requests(
          request_number,
          service_type:service_types(name),
          address:addresses(street, number, city, zone),
          quotes(*, items:quote_items(*))
        )`
      )
      .eq("id", invoiceId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener la factura" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Invoices by Client                                             */
/* ------------------------------------------------------------------ */

export async function getInvoicesByClient(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "*, service_request:service_requests(request_number, service_type:service_types(name))"
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener facturas del cliente" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get All Invoices (Admin)                                           */
/* ------------------------------------------------------------------ */

export async function getAllInvoices(filters?: InvoiceFilters) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("invoices")
      .select(
        "*, client:profiles!invoices_client_id_fkey(full_name), service_request:service_requests(request_number)"
      )
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener facturas" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Invoice Status                                              */
/* ------------------------------------------------------------------ */

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
) {
  try {
    const supabase = await createClient();

    const updateData: Record<string, unknown> = { status };

    if (status === "sent") {
      updateData.issued_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al actualizar la factura" };
  }
}

/* ------------------------------------------------------------------ */
/*  Mark as Paid                                                       */
/* ------------------------------------------------------------------ */

export async function markAsPaid(invoiceId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al marcar como pagada" };
  }
}
