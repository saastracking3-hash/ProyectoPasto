"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchForecastFromAPI,
  type DayForecast,
} from "@/lib/services/weather";

/* ------------------------------------------------------------------ */
/*  Cache helpers                                                      */
/* ------------------------------------------------------------------ */

async function getCachedForecast(): Promise<DayForecast[] | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("weather_cache")
    .select("*")
    .gte("forecast_date", today)
    .order("forecast_date");

  if (error || !data || data.length === 0) return null;

  // Check freshness: if the oldest entry was fetched more than 4 hours ago, refetch
  const fetchedAt = new Date(data[0].fetched_at);
  const hoursAgo = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
  if (hoursAgo > 4) return null;

  return data.map((row: Record<string, unknown>) => ({
    date: row.forecast_date as string,
    condition: row.condition as DayForecast["condition"],
    temp_max: row.temp_max as number,
    temp_min: row.temp_min as number,
    precipitation_probability: row.precipitation_probability as number,
    wind_speed_max: row.wind_speed_max as number,
    weather_code: row.weather_code as number,
  }));
}

async function saveForecastToCache(forecasts: DayForecast[]) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Delete old cache entries
  await supabase
    .from("weather_cache")
    .delete()
    .lt("forecast_date", new Date().toISOString().split("T")[0]);

  // Upsert new forecasts
  const rows = forecasts.map((f) => ({
    forecast_date: f.date,
    condition: f.condition,
    temp_max: f.temp_max,
    temp_min: f.temp_min,
    precipitation_probability: f.precipitation_probability,
    wind_speed_max: f.wind_speed_max,
    weather_code: f.weather_code,
    fetched_at: now,
  }));

  await supabase.from("weather_cache").upsert(rows, {
    onConflict: "forecast_date",
  });
}

/* ------------------------------------------------------------------ */
/*  Public actions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Obtener pronostico de N dias (default 5).
 * Primero intenta cache, si no hay o esta viejo, llama a la API.
 */
export async function getWeatherForecast(
  days: number = 5
): Promise<{ data: DayForecast[] | null; error: string | null }> {
  try {
    // Intentar cache
    let forecasts = await getCachedForecast();

    if (!forecasts || forecasts.length === 0) {
      // Fetch from API
      forecasts = await fetchForecastFromAPI();
      // Save to cache (no await to not block response)
      saveForecastToCache(forecasts).catch(() => {});
    }

    return { data: forecasts.slice(0, days), error: null };
  } catch {
    return { data: null, error: "Error al obtener el pronostico" };
  }
}

/**
 * Pronostico para una fecha especifica.
 */
export async function getWeatherForDate(
  date: string
): Promise<{ data: DayForecast | null; error: string | null }> {
  try {
    const { data: forecasts } = await getWeatherForecast(7);
    const match = forecasts?.find((f) => f.date === date) ?? null;
    return { data: match, error: null };
  } catch {
    return { data: null, error: "Error al obtener clima para la fecha" };
  }
}

/**
 * Retorna true si la probabilidad de lluvia > 70% para esa fecha.
 */
export async function shouldReschedule(
  date: string
): Promise<{ shouldReschedule: boolean; forecast: DayForecast | null }> {
  const { data } = await getWeatherForDate(date);
  return {
    shouldReschedule: data ? data.precipitation_probability > 70 : false,
    forecast: data,
  };
}

/**
 * Servicios agendados en dias con alta probabilidad de lluvia.
 */
export async function getRescheduleAlerts(): Promise<{
  data: Array<{
    assignment_id: string;
    service_request_id: string;
    scheduled_date: string;
    client_name: string;
    service_type: string;
    forecast: DayForecast;
  }> | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data: forecasts } = await getWeatherForecast(7);
    if (!forecasts) return { data: [], error: null };

    // Dias con lluvia > 70%
    const rainyDates = forecasts
      .filter((f) => f.precipitation_probability > 70)
      .map((f) => f.date);

    if (rainyDates.length === 0) return { data: [], error: null };

    const { data: assignments, error } = await supabase
      .from("assignments")
      .select(
        "id, service_request_id, scheduled_date, service_requests!inner(status, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name))"
      )
      .in("scheduled_date", rainyDates)
      .not(
        "service_requests.status",
        "in",
        '("completed_by_crew","validated","closed","cancelled")'
      );

    if (error) throw error;

    const forecastMap = new Map(forecasts.map((f) => [f.date, f]));

    const alerts = (assignments || []).map((row: Record<string, unknown>) => {
      const sr = row.service_requests as Record<string, unknown>;
      const profile = sr.profiles as { full_name: string } | null;
      const st = sr.service_types as { name: string } | null;
      return {
        assignment_id: row.id as string,
        service_request_id: row.service_request_id as string,
        scheduled_date: row.scheduled_date as string,
        client_name: profile?.full_name ?? "Sin nombre",
        service_type: st?.name ?? "-",
        forecast: forecastMap.get(row.scheduled_date as string)!,
      };
    });

    return { data: alerts, error: null };
  } catch {
    return { data: null, error: "Error al obtener alertas de reprogramacion" };
  }
}

/**
 * Reprogramar un servicio a una nueva fecha.
 */
export async function rescheduleService(
  assignmentId: string,
  newDate: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("assignments")
      .update({ scheduled_date: newDate })
      .eq("id", assignmentId);

    if (error) throw error;
    return { success: true, error: null };
  } catch {
    return { success: false, error: "Error al reprogramar el servicio" };
  }
}
