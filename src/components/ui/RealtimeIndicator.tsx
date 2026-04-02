"use client";

import type { RealtimeStatus } from "@/lib/hooks/useRealtimeSubscription";

interface RealtimeIndicatorProps {
  status: RealtimeStatus;
  className?: string;
}

const statusConfig: Record<RealtimeStatus, { color: string; label: string }> = {
  connected: { color: "bg-green-500", label: "Conectado en tiempo real" },
  connecting: { color: "bg-yellow-500 animate-pulse", label: "Conectando..." },
  disconnected: { color: "bg-red-500", label: "Desconectado" },
  error: { color: "bg-red-500", label: "Error de conexion" },
};

export default function RealtimeIndicator({ status, className = "" }: RealtimeIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={config.label}
    >
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-gray-500">{config.label}</span>
    </div>
  );
}
