"use client";

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  className?: string;
}

export default function BarChart({
  data,
  height = 200,
  showLabels = true,
  showValues = true,
  className = "",
}: BarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 text-sm ${className}`}
        style={{ height }}
      >
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="flex items-end gap-2 sm:gap-3"
        style={{ height }}
      >
        {data.map((item, i) => {
          const barHeight = (item.value / maxValue) * 100;
          const color = item.color ?? "bg-green-600";
          const isColorClass = color.startsWith("bg-");

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              {showValues && (
                <span className="text-xs font-medium text-gray-700 mb-1 truncate max-w-full">
                  {item.value.toLocaleString("es-MX")}
                </span>
              )}
              <div
                className={`w-full rounded-t-md transition-all duration-500 min-h-[4px] ${
                  isColorClass ? color : ""
                }`}
                style={{
                  height: `${Math.max(barHeight, 2)}%`,
                  ...(isColorClass ? {} : { backgroundColor: color }),
                }}
                title={`${item.label}: ${item.value.toLocaleString("es-MX")}`}
              />
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex gap-2 sm:gap-3 mt-2">
          {data.map((item, i) => (
            <div
              key={i}
              className="flex-1 text-center min-w-0"
            >
              <span className="text-xs text-gray-500 truncate block">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
