/**
 * Servicio de clima - Open-Meteo API (Buenos Aires)
 * Obtiene pronostico de 5-7 dias, mapea codigos a condiciones,
 * y cachea resultados en weather_cache de Supabase.
 */

const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=America/Argentina/Buenos_Aires";

export type WeatherCondition = "sunny" | "cloudy" | "rainy" | "stormy";

export interface DayForecast {
  date: string; // YYYY-MM-DD
  condition: WeatherCondition;
  temp_max: number;
  temp_min: number;
  precipitation_probability: number;
  wind_speed_max: number;
  weather_code: number;
}

/**
 * Mapea WMO weather codes a condiciones simplificadas.
 * https://open-meteo.com/en/docs#weathervariables
 */
export function mapWeatherCode(code: number): WeatherCondition {
  // 0-1: clear
  if (code <= 1) return "sunny";
  // 2-3: partly cloudy / overcast
  if (code <= 3) return "cloudy";
  // 45-48: fog
  if (code >= 45 && code <= 48) return "cloudy";
  // 51-57: drizzle
  if (code >= 51 && code <= 57) return "rainy";
  // 61-67: rain
  if (code >= 61 && code <= 67) return "rainy";
  // 71-77: snow
  if (code >= 71 && code <= 77) return "rainy";
  // 80-82: rain showers
  if (code >= 80 && code <= 82) return "rainy";
  // 85-86: snow showers
  if (code >= 85 && code <= 86) return "rainy";
  // 95-99: thunderstorm
  if (code >= 95) return "stormy";
  return "cloudy";
}

export const CONDITION_LABELS: Record<WeatherCondition, string> = {
  sunny: "Soleado",
  cloudy: "Nublado",
  rainy: "Lluvia",
  stormy: "Tormenta",
};

/**
 * Fetch del pronostico desde Open-Meteo.
 * Retorna un array de DayForecast (hasta 7 dias).
 */
export async function fetchForecastFromAPI(): Promise<DayForecast[]> {
  const res = await fetch(OPEN_METEO_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = await res.json();

  const daily = json.daily;
  if (!daily || !daily.time) return [];

  const forecasts: DayForecast[] = daily.time.map(
    (date: string, i: number) => ({
      date,
      condition: mapWeatherCode(daily.weather_code[i]),
      temp_max: daily.temperature_2m_max[i],
      temp_min: daily.temperature_2m_min[i],
      precipitation_probability: daily.precipitation_probability_max[i],
      wind_speed_max: daily.wind_speed_10m_max[i],
      weather_code: daily.weather_code[i],
    })
  );

  return forecasts;
}
