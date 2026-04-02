"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Clock, User, Wrench, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import WeatherBadge from "@/components/ui/WeatherBadge";
import { createClient } from "@/lib/supabase/client";
import { getWeatherForecast } from "@/app/actions/weather";
import type { DayForecast } from "@/lib/services/weather";
import Link from "next/link";

interface ScheduleEvent {
  id: string;
  service_request_id: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  scheduled_date: string;
  client_name: string;
  service_type: string;
  crew_name: string;
  status: string;
  request_number: number;
}

const eventStatusColors: Record<string, string> = {
  crew_assigned: "border-l-blue-500 bg-blue-50",
  in_transit: "border-l-cyan-500 bg-cyan-50",
  arrived: "border-l-teal-500 bg-teal-50",
  in_progress: "border-l-green-500 bg-green-50",
  paused: "border-l-amber-500 bg-amber-50",
  completed_by_crew: "border-l-gray-400 bg-gray-50",
  validated: "border-l-gray-400 bg-gray-50",
  closed: "border-l-gray-300 bg-gray-50",
};

const weekDays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

function getWeekDates(offset: number): { day: string; date: string; full: string; iso: string }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);

  return weekDays.map((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    return {
      day,
      date: `${dd}/${mm}`,
      full: `${dd}/${mm}/${yyyy}`,
      iso: `${yyyy}-${mm}-${dd}`,
    };
  });
}

export default function AgendaPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);

  const dates = getWeekDates(weekOffset);
  const weekLabel = `${dates[0].full} - ${dates[dates.length - 1].full}`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("No autenticado"); setLoading(false); return; }

      const startDate = dates[0].iso;
      const endDate = dates[dates.length - 1].iso;

      const { data, error: fetchErr } = await supabase
        .from("assignments")
        .select(
          "id, service_request_id, scheduled_date, scheduled_start_time, scheduled_end_time, service_requests!inner(request_number, status, profiles!service_requests_client_id_fkey(full_name), service_types!inner(name)), crews!inner(name)"
        )
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .order("scheduled_start_time", { ascending: true });

      if (fetchErr) throw fetchErr;

      const mapped: ScheduleEvent[] = (data || []).map((row: Record<string, unknown>) => {
        const sr = row.service_requests as Record<string, unknown>;
        const profile = sr.profiles as { full_name: string } | null;
        const st = sr.service_types as { name: string } | null;
        const crew = row.crews as { name: string } | null;
        return {
          id: row.id as string,
          service_request_id: row.service_request_id as string,
          scheduled_date: row.scheduled_date as string,
          scheduled_start_time: row.scheduled_start_time as string | null,
          scheduled_end_time: row.scheduled_end_time as string | null,
          client_name: profile?.full_name ?? "Sin nombre",
          service_type: st?.name ?? "-",
          crew_name: crew?.name ?? "-",
          status: sr.status as string,
          request_number: sr.request_number as number,
        };
      });

      setEvents(mapped);
    } catch {
      setError("Error al cargar la agenda");
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch weather forecasts
  useEffect(() => {
    async function loadWeather() {
      try {
        const { data } = await getWeatherForecast(7);
        if (data) setForecasts(data);
      } catch {
        // silently fail - weather is non-critical
      }
    }
    loadWeather();
  }, []);

  const getForecastForDate = (isoDate: string) =>
    forecasts.find((f) => f.date === isoDate) ?? null;

  const eventsByDate = (isoDate: string) =>
    events.filter((e) => e.scheduled_date === isoDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500 mt-1">
          Calendario de servicios programados
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset(weekOffset - 1)}
        >
          <ChevronLeft size={16} />
          Semana anterior
        </Button>
        <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekOffset(weekOffset + 1)}
        >
          Semana siguiente
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Week View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {dates.map((d) => {
          const dayEvents = eventsByDate(d.iso);
          return (
            <div key={d.iso} className="min-h-[200px]">
              <div className="text-center mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {d.day}
                </p>
                <p className="text-lg font-semibold text-gray-900">{d.date}</p>
                <div className="mt-1">
                  <WeatherBadge forecast={getForecastForDate(d.iso)} compact />
                </div>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-20 bg-gray-200 animate-pulse rounded-lg" />
                  </div>
                ) : dayEvents.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                    Sin servicios
                  </div>
                ) : (
                  dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/admin/servicios/${event.service_request_id}`}
                    >
                      <div
                        className={`border-l-4 rounded-lg p-2.5 hover:shadow-sm transition-shadow cursor-pointer ${
                          eventStatusColors[event.status] || "border-l-gray-300 bg-gray-50"
                        }`}
                      >
                        {(event.scheduled_start_time || event.scheduled_end_time) && (
                          <p className="text-xs font-medium text-gray-900 flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            {event.scheduled_start_time?.slice(0, 5) ?? ""}{" "}
                            {event.scheduled_end_time ? `- ${event.scheduled_end_time.slice(0, 5)}` : ""}
                          </p>
                        )}
                        <p className="text-xs text-gray-700 mt-1 flex items-center gap-1">
                          <User size={12} className="text-gray-400" />
                          {event.client_name}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                          <Wrench size={12} className="text-gray-400" />
                          {event.service_type}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Users size={12} className="text-gray-400" />
                          {event.crew_name}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
