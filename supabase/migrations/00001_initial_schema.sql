-- The Green Side - Initial Database Schema
-- Supabase/PostgreSQL

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('client', 'admin', 'supervisor', 'crew_leader', 'operator');

CREATE TYPE service_status AS ENUM (
  'request_created', 'pending_review', 'quoted', 'pending_approval',
  'approved', 'scheduled', 'crew_assigned', 'in_transit', 'arrived',
  'in_progress', 'paused', 'completed_by_crew', 'validated', 'closed', 'cancelled'
);

CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'approved', 'rejected', 'expired');
CREATE TYPE urgency_level AS ENUM ('normal', 'priority', 'urgent');
CREATE TYPE photo_type AS ENUM ('before', 'during', 'after');
CREATE TYPE quote_item_type AS ENUM ('labor', 'material', 'extra');

-- ============================================
-- PROFILES
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'client'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ADDRESSES
-- ============================================

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  floor_apt TEXT,
  city TEXT NOT NULL DEFAULT 'Buenos Aires',
  zone TEXT NOT NULL, -- CABA, Zona Norte, Zona Oeste
  postal_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_client ON addresses(client_id);

-- ============================================
-- SERVICE TYPES
-- ============================================

CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price_cents INTEGER NOT NULL DEFAULT 0,
  estimated_duration_min INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SERVICE REQUESTS
-- ============================================

CREATE SEQUENCE service_request_number_seq;

CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number INTEGER NOT NULL DEFAULT nextval('service_request_number_seq'),
  client_id UUID NOT NULL REFERENCES profiles(id),
  address_id UUID NOT NULL REFERENCES addresses(id),
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  status service_status NOT NULL DEFAULT 'request_created',
  urgency urgency_level NOT NULL DEFAULT 'normal',
  description TEXT,
  preferred_date DATE,
  preferred_time_slot TEXT,
  estimated_area_sqm NUMERIC(10,2),
  photos TEXT[] DEFAULT '{}',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_requests_client ON service_requests(client_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE UNIQUE INDEX idx_service_requests_number ON service_requests(request_number);

-- ============================================
-- QUOTES
-- ============================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  status quote_status NOT NULL DEFAULT 'draft',
  labor_cost_cents INTEGER NOT NULL DEFAULT 0,
  materials_cost_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER GENERATED ALWAYS AS (labor_cost_cents + materials_cost_cents) STORED,
  notes TEXT,
  valid_until DATE,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_request ON quotes(service_request_id);

CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  item_type quote_item_type NOT NULL DEFAULT 'labor',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

-- ============================================
-- CREWS
-- ============================================

CREATE TABLE crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_id UUID REFERENCES profiles(id),
  zone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  role_in_crew TEXT NOT NULL DEFAULT 'operator',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_id, user_id)
);

-- ============================================
-- ASSIGNMENTS
-- ============================================

CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id),
  crew_id UUID NOT NULL REFERENCES crews(id),
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_request ON assignments(service_request_id);
CREATE INDEX idx_assignments_crew ON assignments(crew_id);
CREATE INDEX idx_assignments_date ON assignments(scheduled_date);

-- ============================================
-- SERVICE STATE LOG
-- ============================================

CREATE TABLE service_state_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  from_status service_status,
  to_status service_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_state_log_request ON service_state_log(service_request_id);

-- ============================================
-- CHECKLISTS
-- ============================================

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  template_id UUID REFERENCES checklist_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- SERVICE PHOTOS
-- ============================================

CREATE TABLE service_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  storage_path TEXT NOT NULL,
  photo_type photo_type NOT NULL DEFAULT 'after',
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_photos_assignment ON service_photos(assignment_id);

-- ============================================
-- REVIEWS
-- ============================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_request_id, client_id)
);

-- ============================================
-- MATERIALS LOG
-- ============================================

CREATE TABLE materials_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT,
  cost_cents INTEGER,
  logged_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SEED: SERVICE TYPES
-- ============================================

INSERT INTO service_types (name, slug, description, base_price_cents, estimated_duration_min, sort_order) VALUES
  ('Corte de cesped', 'corte-cesped', 'Corte profesional de cesped con maquinaria de ultima generacion', 1500000, 60, 1),
  ('Desmalezamiento', 'desmalezamiento', 'Eliminacion de malezas, yuyos y vegetacion no deseada', 2000000, 90, 2),
  ('Poda de arboles', 'poda-arboles', 'Poda de formacion, mantenimiento y sanitaria', 3000000, 120, 3),
  ('Mantenimiento general', 'mantenimiento-general', 'Mantenimiento integral de jardin: corte, bordes, limpieza', 2500000, 90, 4),
  ('Limpieza de terrenos', 'limpieza-terrenos', 'Limpieza profunda de terrenos abandonados o lotes baldios', 4000000, 180, 5),
  ('Limpieza de hojas', 'limpieza-hojas', 'Recoleccion y retiro de hojas caidas', 1000000, 45, 6),
  ('Acondicionamiento de canteros', 'canteros', 'Preparacion y embellecimiento de canteros', 1800000, 60, 7),
  ('Remocion de residuos verdes', 'remocion-residuos', 'Retiro de residuos de poda y jardineria', 1200000, 60, 8);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_service_requests
  BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_quotes
  BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
