"use client";

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
  showLegend?: boolean;
  centerLabel?: string;
  className?: string;
}

export default function PieChart({
  data,
  size = 180,
  showLegend = true,
  centerLabel,
  className = "",
}: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 text-sm ${className}`}
        style={{ height: size }}
      >
        Sin datos para mostrar
      </div>
    );
  }

  // Build conic-gradient segments
  let accumulated = 0;
  const segments = data.map((item) => {
    const start = accumulated;
    const percentage = (item.value / total) * 100;
    accumulated += percentage;
    return { ...item, start, end: accumulated, percentage };
  });

  const gradientStops = segments
    .map((s) => `${s.color} ${s.start}% ${s.end}%`)
    .join(", ");

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div
        className="rounded-full relative"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradientStops})`,
        }}
      >
        {/* Center hole for donut */}
        <div
          className="absolute bg-white rounded-full flex flex-col items-center justify-center"
          style={{
            width: size * 0.6,
            height: size * 0.6,
            top: size * 0.2,
            left: size * 0.2,
          }}
        >
          <span className="text-lg font-bold text-gray-900">
            {total.toLocaleString("es-MX")}
          </span>
          {centerLabel && (
            <span className="text-xs text-gray-500">{centerLabel}</span>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {segments.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600">
                {item.label}{" "}
                <span className="font-medium text-gray-800">
                  ({item.value})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
