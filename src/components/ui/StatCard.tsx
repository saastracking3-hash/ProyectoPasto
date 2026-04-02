import type { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
}

export default function StatCard({
  icon,
  title,
  value,
  trend,
  className = "",
}: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-lg bg-green-50 text-green-700">
          {icon}
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            <svg
              className={`w-4 h-4 ${isPositive ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
            <span>
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">
          {typeof value === "number" ? value.toLocaleString("es-MX") : value}
        </p>
      </div>
      {trend?.label && (
        <p className="text-xs text-gray-400 mt-1">{trend.label}</p>
      )}
    </div>
  );
}
