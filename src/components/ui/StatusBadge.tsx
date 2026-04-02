import {
  type ServiceStatus,
  SERVICE_STATUS_LABELS,
  SERVICE_STATUS_COLORS,
} from "@/lib/types";

interface StatusBadgeProps {
  status: ServiceStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${
        SERVICE_STATUS_COLORS[status]
      } ${size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
    >
      {SERVICE_STATUS_LABELS[status]}
    </span>
  );
}
