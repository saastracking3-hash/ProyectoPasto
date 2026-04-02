"use client";

import { Sun, Cloud, CloudRain, CloudLightning } from "lucide-react";
import type { WeatherCondition, DayForecast } from "@/lib/services/weather";

const conditionConfig: Record<
  WeatherCondition,
  {
    icon: typeof Sun;
    bgColor: string;
    textColor: string;
    label: string;
  }
> = {
  sunny: {
    icon: Sun,
    bgColor: "bg-green-50 border-green-200",
    textColor: "text-green-700",
    label: "Soleado",
  },
  cloudy: {
    icon: Cloud,
    bgColor: "bg-yellow-50 border-yellow-200",
    textColor: "text-yellow-700",
    label: "Nublado",
  },
  rainy: {
    icon: CloudRain,
    bgColor: "bg-orange-50 border-orange-200",
    textColor: "text-orange-700",
    label: "Lluvia",
  },
  stormy: {
    icon: CloudLightning,
    bgColor: "bg-red-50 border-red-200",
    textColor: "text-red-700",
    label: "Tormenta",
  },
};

function getRainColor(probability: number): string {
  if (probability <= 30) return "text-green-600";
  if (probability <= 70) return "text-yellow-600";
  return "text-red-600";
}

interface WeatherBadgeProps {
  forecast: DayForecast | null;
  compact?: boolean;
}

export default function WeatherBadge({
  forecast,
  compact = false,
}: WeatherBadgeProps) {
  if (!forecast) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-400 text-xs">
        <Cloud size={12} />
        <span>--</span>
      </div>
    );
  }

  const config = conditionConfig[forecast.condition];
  const Icon = config.icon;
  const rainColor = getRainColor(forecast.precipitation_probability);

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs ${config.bgColor} ${config.textColor}`}
        title={`${config.label} - ${Math.round(forecast.temp_max)}°C - Lluvia: ${forecast.precipitation_probability}%`}
      >
        <Icon size={12} />
        <span className="font-medium">{Math.round(forecast.temp_max)}°</span>
        <span className={`font-medium ${rainColor}`}>
          {forecast.precipitation_probability}%
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${config.bgColor} ${config.textColor}`}
    >
      <Icon size={14} />
      <div className="flex items-center gap-1.5">
        <span className="font-medium">
          {Math.round(forecast.temp_min)}° / {Math.round(forecast.temp_max)}°
        </span>
        <span className={`font-semibold ${rainColor}`}>
          {forecast.precipitation_probability}% lluvia
        </span>
      </div>
    </div>
  );
}
