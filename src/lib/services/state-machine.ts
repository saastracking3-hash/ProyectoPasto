import type { ServiceStatus, UserRole } from "@/lib/types";

interface Transition {
  from: ServiceStatus;
  to: ServiceStatus;
  allowedRoles: UserRole[];
}

const transitions: Transition[] = [
  {
    from: "request_created",
    to: "pending_review",
    allowedRoles: ["admin", "supervisor"],
  },
  {
    from: "pending_review",
    to: "quoted",
    allowedRoles: ["admin", "supervisor"],
  },
  { from: "quoted", to: "pending_approval", allowedRoles: ["admin"] },
  { from: "pending_approval", to: "approved", allowedRoles: ["client"] },
  {
    from: "pending_approval",
    to: "cancelled",
    allowedRoles: ["client", "admin"],
  },
  {
    from: "approved",
    to: "scheduled",
    allowedRoles: ["admin", "supervisor"],
  },
  {
    from: "scheduled",
    to: "crew_assigned",
    allowedRoles: ["admin", "supervisor"],
  },
  {
    from: "crew_assigned",
    to: "in_transit",
    allowedRoles: ["crew_leader"],
  },
  { from: "in_transit", to: "arrived", allowedRoles: ["crew_leader"] },
  {
    from: "arrived",
    to: "in_progress",
    allowedRoles: ["crew_leader"],
  },
  {
    from: "in_progress",
    to: "paused",
    allowedRoles: ["crew_leader", "supervisor"],
  },
  {
    from: "paused",
    to: "in_progress",
    allowedRoles: ["crew_leader"],
  },
  {
    from: "in_progress",
    to: "completed_by_crew",
    allowedRoles: ["crew_leader"],
  },
  {
    from: "completed_by_crew",
    to: "validated",
    allowedRoles: ["admin", "supervisor"],
  },
  {
    from: "validated",
    to: "closed",
    allowedRoles: ["admin", "supervisor"],
  },
];

export function canTransition(
  from: ServiceStatus,
  to: ServiceStatus,
  role: UserRole
): boolean {
  return transitions.some(
    (t) =>
      t.from === from && t.to === to && t.allowedRoles.includes(role)
  );
}

export function getNextStatuses(
  current: ServiceStatus,
  role: UserRole
): ServiceStatus[] {
  return transitions
    .filter((t) => t.from === current && t.allowedRoles.includes(role))
    .map((t) => t.to);
}

export function getCrewActions(
  current: ServiceStatus
): { status: ServiceStatus; label: string; color: string }[] {
  const actions: Record<
    string,
    { status: ServiceStatus; label: string; color: string }[]
  > = {
    crew_assigned: [
      { status: "in_transit", label: "Salir hacia el lugar", color: "bg-blue-600" },
    ],
    in_transit: [
      { status: "arrived", label: "Ya llegue", color: "bg-teal-600" },
    ],
    arrived: [
      { status: "in_progress", label: "Empezar trabajo", color: "bg-green-600" },
    ],
    in_progress: [
      { status: "paused", label: "Pausar", color: "bg-amber-600" },
      { status: "completed_by_crew", label: "Trabajo terminado", color: "bg-green-700" },
    ],
    paused: [
      { status: "in_progress", label: "Reanudar", color: "bg-green-600" },
    ],
  };
  return actions[current] || [];
}
