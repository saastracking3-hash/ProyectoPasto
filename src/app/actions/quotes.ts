"use server";

import { createClient } from "@/lib/supabase/server";
import type { Quote, QuoteItemType } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Create Quote                                                       */
/* ------------------------------------------------------------------ */

interface QuoteItemInput {
  description: string;
  quantity: number;
  unit_price_cents: number;
  item_type: QuoteItemType;
  sort_order: number;
}

export async function createQuote(
  serviceRequestId: string,
  items: QuoteItemInput[],
  notes?: string,
  validUntil?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const laborCents = items
      .filter((i) => i.item_type === "labor")
      .reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0);
    const materialsCents = items
      .filter((i) => i.item_type === "material")
      .reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0);
    const totalCents = items.reduce(
      (sum, i) => sum + i.quantity * i.unit_price_cents,
      0
    );

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .insert({
        service_request_id: serviceRequestId,
        created_by: user.id,
        status: "draft",
        labor_cost_cents: laborCents,
        materials_cost_cents: materialsCents,
        total_cents: totalCents,
        notes: notes ?? null,
        valid_until: validUntil ?? null,
      })
      .select()
      .single();

    if (quoteError) return { data: null, error: quoteError.message };

    // Insert items
    const quoteItems = items.map((item) => ({
      quote_id: quote.id,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(quoteItems);

    if (itemsError) return { data: null, error: itemsError.message };

    // Update service request status to "quoted"
    await supabase
      .from("service_requests")
      .update({ status: "quoted", updated_at: new Date().toISOString() })
      .eq("id", serviceRequestId);

    return { data: quote as Quote, error: null };
  } catch (e) {
    return { data: null, error: "Error al crear la cotizacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Quote                                                       */
/* ------------------------------------------------------------------ */

export async function updateQuote(
  quoteId: string,
  items: QuoteItemInput[],
  notes?: string,
  validUntil?: string
) {
  try {
    const supabase = await createClient();

    const laborCents = items
      .filter((i) => i.item_type === "labor")
      .reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0);
    const materialsCents = items
      .filter((i) => i.item_type === "material")
      .reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0);
    const totalCents = items.reduce(
      (sum, i) => sum + i.quantity * i.unit_price_cents,
      0
    );

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .update({
        labor_cost_cents: laborCents,
        materials_cost_cents: materialsCents,
        total_cents: totalCents,
        notes: notes ?? null,
        valid_until: validUntil ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select()
      .single();

    if (quoteError) return { data: null, error: quoteError.message };

    // Delete existing items and re-insert
    await supabase.from("quote_items").delete().eq("quote_id", quoteId);

    const quoteItems = items.map((item) => ({
      quote_id: quoteId,
      ...item,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(quoteItems);

    if (itemsError) return { data: null, error: itemsError.message };

    return { data: quote as Quote, error: null };
  } catch (e) {
    return { data: null, error: "Error al actualizar la cotizacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Send Quote                                                         */
/* ------------------------------------------------------------------ */

export async function sendQuote(quoteId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    // Update quote status
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", quoteId)
      .select("*, service_request_id")
      .single();

    if (quoteError) return { data: null, error: quoteError.message };

    // Update service request to pending_approval
    await supabase
      .from("service_requests")
      .update({
        status: "pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.service_request_id);

    // State log
    await supabase.from("service_state_log").insert({
      service_request_id: quote.service_request_id,
      from_status: "quoted",
      to_status: "pending_approval",
      changed_by: user.id,
      notes: "Cotizacion enviada al cliente",
    });

    return { data: quote, error: null };
  } catch (e) {
    return { data: null, error: "Error al enviar la cotizacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Approve Quote (client)                                             */
/* ------------------------------------------------------------------ */

export async function approveQuote(quoteId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select("*, service_request_id")
      .single();

    if (quoteError) return { data: null, error: quoteError.message };

    // Update service request
    await supabase
      .from("service_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", quote.service_request_id);

    // State log
    await supabase.from("service_state_log").insert({
      service_request_id: quote.service_request_id,
      from_status: "pending_approval",
      to_status: "approved",
      changed_by: user.id,
      notes: "Cotizacion aprobada por el cliente",
    });

    return { data: quote, error: null };
  } catch (e) {
    return { data: null, error: "Error al aprobar la cotizacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Reject Quote (client)                                              */
/* ------------------------------------------------------------------ */

export async function rejectQuote(quoteId: string, reason?: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .select("*, service_request_id")
      .single();

    if (quoteError) return { data: null, error: quoteError.message };

    // State log
    await supabase.from("service_state_log").insert({
      service_request_id: quote.service_request_id,
      from_status: "pending_approval",
      to_status: "pending_approval",
      changed_by: user.id,
      notes: reason
        ? `Cotizacion rechazada: ${reason}`
        : "Cotizacion rechazada por el cliente",
    });

    return { data: quote, error: null };
  } catch (e) {
    return { data: null, error: "Error al rechazar la cotizacion" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Client Quotes                                                  */
/* ------------------------------------------------------------------ */

export async function getClientQuotes(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "*, items:quote_items(*), service_request:service_requests(id, request_number, status, service_type:service_types(name))"
      )
      .eq("service_request.client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener cotizaciones" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Quote Detail                                                   */
/* ------------------------------------------------------------------ */

export async function getQuoteDetail(quoteId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "*, items:quote_items(*), service_request:service_requests(id, request_number, status, service_type:service_types(name), address:addresses(street, number, city, zone))"
      )
      .eq("id", quoteId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Error al obtener detalle de cotizacion" };
  }
}
