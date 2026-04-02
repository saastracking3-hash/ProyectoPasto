"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import type { DayForecast, WeatherCondition } from "@/lib/services/weather";
import { getWeatherForecast, getRescheduleAlerts } from "@/app/actions/weather";

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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === tomorrow.toDateString()) return "Manana";

  return date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function WeatherWidget() {
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [forecastResult, alertsResult] = await Promise.all([
          getWeatherForecast(5),
          getRescheduleAlerts(),
        ]);
        if (forecastResult.data) setForecasts(forecastResult.data);
        if (alertsResult.data) setAlertCount(alertsResult.data.length);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clima - Buenos Aires</CardTitle>
        <Link
          href="/admin/clima"
          className="text-sm text-green-700 hover:text-green-800 flex items-center gap-1"
        >
          Ver detalle
          <ExternalLink size={14} />
        </Link>
      </CardHeader>

      {loading ? (
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-24 bg-gray-100 animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : forecasts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          No se pudo cargar el pronostico
        </p>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-2">
            {forecasts.map((f) => {
              const Icon = conditionIcons[f.condition];
              const isRisky = f.precipitation_probability > 70;
              return (
                <div
                  key={f.date}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-center ${
                    conditionColors[f.condition]
                  } ${isRisky ? "ring-2 ring-red-300" : ""}`}
                >
                  <span className="text-xs font-medium">
                    {formatDate(f.date)}
                  </span>
                  <Icon size={20} />
                  <span className="text-xs font-semibold">
                    {Math.round(f.temp_max)}°
                  </span>
                  <span className="text-[10px]">
                    {f.precipitation_probability}% lluvia
                  </span>
                </div>
              );
            })}
          </div>

          {alertCount > 0 && (
            <Link
              href="/admin/clima"
              className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-100 transition-colors"
            >
              <AlertTriangle size={16} />
              <span>
                <strong>{alertCount}</strong> servicio(s) en dias con lluvia
              </span>
              <span className="ml-auto text-xs">Ver servicios afectados</span>
            </Link>
          )}
        </>
      )}
    </Card>
  );
}
