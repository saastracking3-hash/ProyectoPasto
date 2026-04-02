export type UserRole =
  | "client"
  | "admin"
  | "supervisor"
  | "crew_leader"
  | "operator";

export type ServiceStatus =
  | "request_created"
  | "pending_review"
  | "quoted"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "crew_assigned"
  | "in_transit"
  | "arrived"
  | "in_progress"
  | "paused"
  | "completed_by_crew"
  | "validated"
  | "closed"
  | "cancelled";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired";

export type UrgencyLevel = "normal" | "priority" | "urgent";

export type PhotoType = "before" | "during" | "after";

export type QuoteItemType = "labor" | "material" | "extra";

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  request_created: "Solicitud creada",
  pending_review: "Pendiente de revision",
  quoted: "Cotizado",
  pending_approval: "Pendiente de aprobacion",
  approved: "Aprobado",
  scheduled: "Agendado",
  crew_assigned: "Cuadrilla asignada",
  in_transit: "En camino",
  arrived: "En el lugar",
  in_progress: "En ejecucion",
  paused: "Pausado",
  completed_by_crew: "Finalizado por cuadrilla",
  validated: "Validado",
  closed: "Cerrado",
  cancelled: "Cancelado",
};

export const SERVICE_STATUS_COLORS: Record<ServiceStatus, string> = {
  request_created: "bg-gray-100 text-gray-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  quoted: "bg-blue-100 text-blue-700",
  pending_approval: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  crew_assigned: "bg-purple-100 text-purple-700",
  in_transit: "bg-cyan-100 text-cyan-700",
  arrived: "bg-teal-100 text-teal-700",
  in_progress: "bg-green-200 text-green-800",
  paused: "bg-amber-100 text-amber-700",
  completed_by_crew: "bg-emerald-100 text-emerald-700",
  validated: "bg-green-300 text-green-900",
  closed: "bg-gray-200 text-gray-800",
  cancelled: "bg-red-100 text-red-700",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: "Normal",
  priority: "Prioritario",
  urgent: "Urgente",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  client: "Cliente",
  admin: "Administrador",
  supervisor: "Supervisor",
  crew_leader: "Jefe de cuadrilla",
  operator: "Operario",
};

export type EquipmentStatus = "available" | "in_use" | "maintenance" | "retired";

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: "Disponible",
  in_use: "En uso",
  maintenance: "Mantenimiento",
  retired: "Retirado",
};

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  available: "bg-green-100 text-green-700",
  in_use: "bg-blue-100 text-blue-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  retired: "bg-gray-100 text-gray-600",
};

export type EquipmentType =
  | "cortadora"
  | "bordeadora"
  | "motosierra"
  | "sopladora"
  | "vehiculo"
  | "trailer"
  | "escalera"
  | "otro";

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  cortadora: "Cortadora",
  bordeadora: "Bordeadora",
  motosierra: "Motosierra",
  sopladora: "Sopladora",
  vehiculo: "Vehiculo",
  trailer: "Trailer",
  escalera: "Escalera",
  otro: "Otro",
};

export type PaymentMethod = "cash" | "transfer" | "qr" | "mercadopago" | "other";
export type PaymentStatus = "pending" | "completed" | "cancelled" | "refunded";
export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  mercadopago: "MercadoPago",
  other: "Otro",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  completed: "Cobrado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-gray-100 text-gray-700",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export const ROLE_HOME: Record<UserRole, string> = {
  client: "/dashboard",
  admin: "/admin/dashboard",
  supervisor: "/admin/dashboard",
  crew_leader: "/crew/hoy",
  operator: "/crew/hoy",
};
