"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { DayForecast, WeatherCondition } from "@/lib/services/weather";
import {
  getWeatherForecast,
  getRescheduleAlerts,
  rescheduleService,
} from "@/app/actions/weather";

const conditionIcons: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudLightning,
};

const conditionColors: Record<WeatherCondition, string> = {
  sunny: "bg-green-50 text-green-700 border-green-200",
  cloudy: "bg-yellow-50 text-yellow-700 border-yellow-200",
  rainy: "bg-orange-50 text-orange-700 border-orange-200",
  stormy: "bg-red-50 text-red-700 border-red-200",
};

const conditionLabels: Record<WeatherCondition, string> = {
  sunny: "Soleado",
  cloudy: "Nublado",
  rainy: "Lluvia",
  stormy: "Tormenta",
};

interface AlertItem {
  assignment_id: string;
  service_request_id: string;
  scheduled_date: string;
  client_name: string;
  service_type: string;
  forecast: DayForecast;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === tomorrow.toDateString()) return "Manana";

  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getNextGoodDay(forecasts: DayForecast[], afterDate: string): string | null {
  const sorted = forecasts
    .filter((f) => f.date > afterDate && f.precipitation_probability <= 30)
    .sort((a, b) => a.date.localeCompare(b.date));
  return sorted.length > 0 ? sorted[0].date : null;
}

export default function ClimaPage() {
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Record<string, string>>(
    {}
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [forecastRes, alertsRes] = await Promise.all([
        getWeatherForecast(7),
        getRescheduleAlerts(),
      ]);
      if (forecastRes.data) setForecasts(forecastRes.data);
      if (alertsRes.data) setAlerts(alertsRes.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleReschedule = async (assignmentId: string, newDate: string) => {
    setRescheduling(assignmentId);
    setSuccessMsg(null);
    try {
      const { success, error } = await rescheduleService(assignmentId, newDate);
      if (success) {
        setSuccessMsg("Servicio reprogramado correctamente");
        setAlerts((prev) => prev.filter((a) => a.assignment_id !== assignmentId));
      } else {
        alert(error || "Error al reprogramar");
      }
    } catch {
      alert("Error al reprogramar");
    } finally {
      setRescheduling(null);
    }
  };

  const handleRescheduleAll = async () => {
    if (alerts.length === 0) return;
    if (!confirm("¿Reprogramar todos los servicios afectados al proximo dia bueno?"))
      return;

    setRescheduling("all");
    let count = 0;
    for (const alert of alerts) {
      const nextGood = getNextGoodDay(forecasts, alert.scheduled_date);
      if (nextGood) {
        const { success } = await rescheduleService(alert.assignment_id, nextGood);
        if (success) count++;
      }
    }
    setSuccessMsg(`${count} servicio(s) reprogramado(s)`);
    setRescheduling(null);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Clima y Reprogramacion
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pronostico extendido y gestion de servicios afectados por el clima
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center justify-between">
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700">
            &times;
          </button>
        </div>
      )}

      {/* 7-day forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Pronostico 7 dias - Buenos Aires</CardTitle>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </CardHeader>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-36 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : forecasts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No se pudo cargar el pronostico. Intenta actualizar.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {forecasts.map((f) => {
              const Icon = conditionIcons[f.condition];
              const isRisky = f.precipitation_probability > 70;
              return (
                <div
                  key={f.date}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    conditionColors[f.condition]
                  } ${isRisky ? "ring-2 ring-red-300 shadow-sm" : ""}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {formatDate(f.date)}
                  </span>
                  <Icon size={28} />
                  <span className="text-sm font-bold">
                    {conditionLabels[f.condition]}
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <Thermometer size={12} />
                    <span>
                      {Math.round(f.temp_min)}° / {Math.round(f.temp_max)}°
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Droplets size={12} />
                    <span className={isRisky ? "font-bold text-red-700" : ""}>
                      {f.precipitation_probability}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Wind size={12} />
                    <span>{Math.round(f.wind_speed_max)} km/h</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Servicios afectados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            Servicios en riesgo por lluvia
          </CardTitle>
          {alerts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRescheduleAll}
              disabled={rescheduling === "all"}
              loading={rescheduling === "all"}
            >
              <CalendarDays size={14} />
              Reprogramar todos
            </Button>
          )}
        </CardHeader>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <Sun size={32} className="mx-auto text-green-400 mb-2" />
            <p className="text-sm text-gray-500">
              No hay servicios afectados por el clima
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const Icon = conditionIcons[alert.forecast.condition];
              const nextGood = getNextGoodDay(forecasts, alert.scheduled_date);
              return (
                <div
                  key={alert.assignment_id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-orange-100 rounded-lg shrink-0">
                      <Icon size={20} className="text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {alert.client_name} - {alert.service_type}
                      </p>
                      <p className="text-xs text-gray-500">
                        Agendado:{" "}
                        {new Date(alert.scheduled_date + "T12:00:00").toLocaleDateString(
                          "es-AR"
                        )}{" "}
                        | Lluvia: {alert.forecast.precipitation_probability}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="date"
                      value={
                        rescheduleDate[alert.assignment_id] ||
                        nextGood ||
                        ""
                      }
                      onChange={(e) =>
                        setRescheduleDate((prev) => ({
                          ...prev,
                          [alert.assignment_id]: e.target.value,
                        }))
                      }
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        handleReschedule(
                          alert.assignment_id,
                          rescheduleDate[alert.assignment_id] || nextGood || ""
                        )
                      }
                      disabled={
                        rescheduling === alert.assignment_id ||
                        !(rescheduleDate[alert.assignment_id] || nextGood)
                      }
                      loading={rescheduling === alert.assignment_id}
                    >
                      <CalendarDays size={14} />
                      Reprogramar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
