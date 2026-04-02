"use server";

import { createClient } from "@/lib/supabase/server";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QuoteRule {
  id: string;
  service_type_id: string;
  zone: string | null;
  area_min_sqm: number;
  area_max_sqm: number;
  base_price_cents: number;
  price_per_sqm_cents: number;
  multiplier: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  service_type_name?: string;
}

export interface QuoteRuleInput {
  service_type_id: string;
  zone?: string | null;
  area_min_sqm: number;
  area_max_sqm: number;
  base_price_cents: number;
  price_per_sqm_cents: number;
  multiplier: number;
  is_active?: boolean;
}

export interface AutoQuoteResult {
  total_cents: number;
  base_price_cents: number;
  area_cost_cents: number;
  multiplier: number;
  rule_id: string;
}

/* ------------------------------------------------------------------ */
/*  CRUD                                                               */
/* ------------------------------------------------------------------ */

export async function getQuoteRules(
  serviceTypeId?: string,
  zone?: string
): Promise<{ data: QuoteRule[] | null; error: string | null }> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("quote_rules")
      .select("*, service_types(name)")
      .eq("is_active", true)
      .order("service_type_id")
      .order("area_min_sqm");

    if (serviceTypeId) query = query.eq("service_type_id", serviceTypeId);
    if (zone) query = query.or(`zone.eq.${zone},zone.is.null`);

    const { data, error } = await query;
    if (error) throw error;

    const rules: QuoteRule[] = (data || []).map((row: Record<string, unknown>) => {
      const st = row.service_types as { name: string } | null;
      return {
        id: row.id as string,
        service_type_id: row.service_type_id as string,
        zone: row.zone as string | null,
        area_min_sqm: row.area_min_sqm as number,
        area_max_sqm: row.area_max_sqm as number,
        base_price_cents: row.base_price_cents as number,
        price_per_sqm_cents: row.price_per_sqm_cents as number,
        multiplier: row.multiplier as number,
        is_active: row.is_active as boolean,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        service_type_name: st?.name ?? undefined,
      };
    });

    return { data: rules, error: null };
  } catch {
    return { data: null, error: "Error al obtener reglas de cotizacion" };
  }
}

export async function getAllQuoteRules(): Promise<{
  data: QuoteRule[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quote_rules")
      .select("*, service_types(name)")
      .order("service_type_id")
      .order("area_min_sqm");

    if (error) throw error;

    const rules: QuoteRule[] = (data || []).map((row: Record<string, unknown>) => {
      const st = row.service_types as { name: string } | null;
      return {
        id: row.id as string,
        service_type_id: row.service_type_id as string,
        zone: row.zone as string | null,
        area_min_sqm: row.area_min_sqm as number,
        area_max_sqm: row.area_max_sqm as number,
        base_price_cents: row.base_price_cents as number,
        price_per_sqm_cents: row.price_per_sqm_cents as number,
        multiplier: row.multiplier as number,
        is_active: row.is_active as boolean,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        service_type_name: st?.name ?? undefined,
      };
    });

    return { data: rules, error: null };
  } catch {
    return { data: null, error: "Error al obtener reglas" };
  }
}

export async function createQuoteRule(
  input: QuoteRuleInput
): Promise<{ data: QuoteRule | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quote_rules")
      .insert({
        service_type_id: input.service_type_id,
        zone: input.zone || null,
        area_min_sqm: input.area_min_sqm,
        area_max_sqm: input.area_max_sqm,
        base_price_cents: input.base_price_cents,
        price_per_sqm_cents: input.price_per_sqm_cents,
        multiplier: input.multiplier,
        is_active: input.is_active ?? true,
      })
      .select("*")
      .single();

    if (error) throw error;
    return { data: data as QuoteRule, error: null };
  } catch {
    return { data: null, error: "Error al crear regla de cotizacion" };
  }
}

export async function updateQuoteRule(
  id: string,
  input: Partial<QuoteRuleInput>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("quote_rules")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al actualizar regla" };
  }
}

export async function deleteQuoteRule(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("quote_rules")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al eliminar regla" };
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-quote calculation                                             */
/* ------------------------------------------------------------------ */

/**
 * Calcula precio automatico basado en reglas.
 * 1. Busca regla que coincida con service_type + zone + rango de area
 * 2. Calcula: base_price + (area * price_per_sqm) * multiplier
 * 3. Si no hay regla, retorna null (cotizacion manual)
 */
export async function calculateAutoQuote(
  serviceTypeId: string,
  zone: string,
  areaSqm: number
): Promise<{ data: AutoQuoteResult | null; error: string | null }> {
  try {
    const supabase = await createClient();

    // Find matching rule: exact zone match or null zone (applies to all)
    const { data: rules, error } = await supabase
      .from("quote_rules")
      .select("*")
      .eq("service_type_id", serviceTypeId)
      .eq("is_active", true)
      .lte("area_min_sqm", areaSqm)
      .gte("area_max_sqm", areaSqm)
      .or(`zone.eq.${zone},zone.is.null`)
      .order("zone", { ascending: false, nullsFirst: false }) // Prefer specific zone
      .limit(1);

    if (error) throw error;

    if (!rules || rules.length === 0) {
      return { data: null, error: null }; // No matching rule
    }

    const rule = rules[0];
    const basePriceCents = rule.base_price_cents as number;
    const pricePerSqmCents = rule.price_per_sqm_cents as number;
    const multiplier = rule.multiplier as number;

    const areaCostCents = Math.round(areaSqm * pricePerSqmCents);
    const totalCents = Math.round((basePriceCents + areaCostCents) * multiplier);

    return {
      data: {
        total_cents: totalCents,
        base_price_cents: basePriceCents,
        area_cost_cents: areaCostCents,
        multiplier,
        rule_id: rule.id as string,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Error al calcular cotizacion" };
  }
}
