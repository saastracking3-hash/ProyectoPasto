import type {
  UserRole,
  ServiceStatus,
  QuoteStatus,
  UrgencyLevel,
  PhotoType,
  QuoteItemType,
  EquipmentStatus,
  PaymentMethod,
  PaymentStatus,
  InvoiceStatus,
} from "./enums";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  client_id: string;
  label: string;
  street: string;
  number: string;
  floor_apt: string | null;
  city: string;
  zone: string;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ServiceType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price_cents: number;
  estimated_duration_min: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ServiceRequest {
  id: string;
  request_number: number;
  client_id: string;
  address_id: string;
  service_type_id: string;
  status: ServiceStatus;
  urgency: UrgencyLevel;
  description: string | null;
  preferred_date: string | null;
  preferred_time_slot: string | null;
  estimated_area_sqm: number | null;
  photos: string[];
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  service_request_id: string;
  created_by: string;
  status: QuoteStatus;
  labor_cost_cents: number;
  materials_cost_cents: number;
  total_cents: number;
  notes: string | null;
  valid_until: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  item_type: QuoteItemType;
  sort_order: number;
}

export interface Crew {
  id: string;
  name: string;
  leader_id: string | null;
  zone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CrewMember {
  id: string;
  crew_id: string;
  user_id: string;
  role_in_crew: "leader" | "operator";
  joined_at: string;
}

export interface Assignment {
  id: string;
  service_request_id: string;
  crew_id: string;
  assigned_by: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ServiceStateLog {
  id: string;
  service_request_id: string;
  from_status: ServiceStatus | null;
  to_status: ServiceStatus;
  changed_by: string;
  notes: string | null;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  service_type_id: string;
  name: string;
  created_at: string;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  description: string;
  sort_order: number;
  is_required: boolean;
}

export interface Checklist {
  id: string;
  assignment_id: string;
  template_id: string | null;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
}

export interface ServicePhoto {
  id: string;
  assignment_id: string;
  uploaded_by: string;
  storage_path: string;
  photo_type: PhotoType;
  caption: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  service_request_id: string;
  client_id: string;
  rating: number;
  punctuality_rating: number | null;
  quality_rating: number | null;
  comment: string | null;
  created_at: string;
}

export interface MaterialLog {
  id: string;
  assignment_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  cost_cents: number | null;
  logged_by: string;
  created_at: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: EquipmentStatus;
  assigned_to_crew: string | null;
  purchase_date: string | null;
  last_maintenance: string | null;
  next_maintenance: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EquipmentWithCrew extends Equipment {
  crew?: { id: string; name: string } | null;
}

export interface Payment {
  id: string;
  service_request_id: string;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference: string | null;
  notes: string | null;
  received_by: string | null;
  paid_at: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: number;
  service_request_id: string;
  client_id: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  status: InvoiceStatus;
  pdf_path: string | null;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

// Extended types with relations
export interface ServiceRequestWithRelations extends ServiceRequest {
  address?: Address;
  service_type?: ServiceType;
  client?: Profile;
  quotes?: Quote[];
  assignment?: Assignment;
}

export interface AssignmentWithRelations extends Assignment {
  service_request?: ServiceRequestWithRelations;
  crew?: Crew;
  checklist?: Checklist & { items: ChecklistItem[] };
  photos?: ServicePhoto[];
}
