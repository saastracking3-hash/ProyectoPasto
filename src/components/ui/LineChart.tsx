"use client";

interface LineChartData {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  showLabels?: boolean;
  className?: string;
}

export default function LineChart({
  data,
  height = 200,
  color = "#16a34a",
  fillColor,
  showDots = true,
  showLabels = true,
  className = "",
}: LineChartProps) {
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

  const padding = { top: 20, right: 10, bottom: showLabels ? 30 : 10, left: 10 };
  const viewBoxWidth = 600;
  const viewBoxHeight = height;
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y =
      padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight;
    return { x, y, ...d };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Area fill path
  const areaPath = `M ${points[0].x},${padding.top + chartHeight} ${points
    .map((p) => `L ${p.x},${p.y}`)
    .join(" ")} L ${points[points.length - 1].x},${
    padding.top + chartHeight
  } Z`;

  const fill = fillColor ?? `${color}15`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={viewBoxWidth - padding.right}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray={ratio === 0 ? "0" : "4,4"}
            />
          );
        })}

        {/* Area */}
        <path d={areaPath} fill={fill} />

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={color} strokeWidth="2.5" />
              {/* Tooltip value */}
              <title>{`${p.label}: ${p.value.toLocaleString("es-MX")}`}</title>
            </g>
          ))}

        {/* X-axis labels */}
        {showLabels &&
          points.map((p, i) => {
            // Show max ~10 labels to avoid crowding
            const step = Math.max(1, Math.floor(data.length / 10));
            if (i % step !== 0 && i !== data.length - 1) return null;
            return (
              <text
                key={i}
                x={p.x}
                y={viewBoxHeight - 4}
                textAnchor="middle"
                className="text-[11px] fill-gray-500"
              >
                {p.label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
