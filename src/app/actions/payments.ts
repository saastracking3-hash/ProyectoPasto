"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PaymentMethod = "cash" | "transfer" | "qr" | "mercadopago" | "other";
export type PaymentStatus = "pending" | "completed" | "cancelled" | "refunded";

export interface PaymentFilters {
  method?: PaymentMethod;
  status?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
}

/* ------------------------------------------------------------------ */
/*  Create Payment                                                     */
/* ------------------------------------------------------------------ */

export async function createPayment(
  serviceRequestId: string,
  amountCents: number,
  method: PaymentMethod,
  reference?: string,
  notes?: string,
  receivedBy?: string
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "No autenticado" };

    const { data, error } = await supabase
      .from("payments")
      .insert({
        service_request_id: serviceRequestId,
        amount_cents: amountCents,
        method,
        status: "completed" as PaymentStatus,
        reference: reference ?? null,
        notes: notes ?? null,
        received_by: receivedBy ?? user.id,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al registrar el pago" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Payments by Service Request                                    */
/* ------------------------------------------------------------------ */

export async function getPaymentsByService(serviceRequestId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .select("*, received_by_profile:profiles!received_by(full_name)")
      .eq("service_request_id", serviceRequestId)
      .order("paid_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener pagos del servicio" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get Payments by Client                                             */
/* ------------------------------------------------------------------ */

export async function getPaymentsByClient(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .select(
        "*, service_request:service_requests!inner(request_number, client_id, service_type:service_types(name))"
      )
      .eq("service_request.client_id", clientId)
      .order("paid_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener pagos del cliente" };
  }
}

/* ------------------------------------------------------------------ */
/*  Get All Payments (Admin)                                           */
/* ------------------------------------------------------------------ */

export async function getAllPayments(filters?: PaymentFilters) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("payments")
      .select(
        "*, service_request:service_requests(request_number, client:profiles!service_requests_client_id_fkey(full_name)), received_by_profile:profiles!payments_received_by_fkey(full_name)"
      )
      .order("paid_at", { ascending: false });

    if (filters?.method) {
      query = query.eq("method", filters.method);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.dateFrom) {
      query = query.gte("paid_at", filters.dateFrom);
    }
    if (filters?.dateTo) {
      query = query.lte("paid_at", `${filters.dateTo}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al obtener pagos" };
  }
}

/* ------------------------------------------------------------------ */
/*  Payment Stats                                                      */
/* ------------------------------------------------------------------ */

export async function getPaymentStats(dateFrom?: string, dateTo?: string) {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("payments")
      .select("amount_cents, method, status, paid_at")
      .eq("status", "completed");

    if (dateFrom) {
      query = query.gte("paid_at", dateFrom);
    }
    if (dateTo) {
      query = query.lte("paid_at", `${dateTo}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };

    const payments = data || [];
    const totalCollected = payments.reduce((sum, p) => sum + p.amount_cents, 0);

    const byMethod: Record<string, number> = {};
    payments.forEach((p) => {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount_cents;
    });

    // Group by month
    const byMonth: Record<string, number> = {};
    payments.forEach((p) => {
      const month = p.paid_at.substring(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + p.amount_cents;
    });

    return {
      data: {
        totalCollected,
        count: payments.length,
        byMethod,
        byMonth,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Error al obtener estadisticas" };
  }
}

/* ------------------------------------------------------------------ */
/*  Update Payment Status                                              */
/* ------------------------------------------------------------------ */

export async function updatePaymentStatus(
  paymentId: string,
  status: PaymentStatus
) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .update({ status })
      .eq("id", paymentId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch {
    return { data: null, error: "Error al actualizar el pago" };
  }
}

/* ------------------------------------------------------------------ */
/*  Delete Payment                                                     */
/* ------------------------------------------------------------------ */

export async function deletePayment(paymentId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al eliminar el pago" };
  }
}
