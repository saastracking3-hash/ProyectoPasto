-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, action
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'qr', 'mercadopago', 'other');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id),
  amount_cents INTEGER NOT NULL,
  method payment_method NOT NULL DEFAULT 'transfer',
  status payment_status NOT NULL DEFAULT 'completed',
  reference TEXT,
  notes TEXT,
  received_by UUID REFERENCES profiles(id),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_service ON payments(service_request_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_payments" ON payments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "client_read_own_payments" ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM service_requests sr WHERE sr.id = payments.service_request_id AND sr.client_id = auth.uid())
);

-- ============================================
-- INVOICES
-- ============================================
CREATE SEQUENCE invoice_number_seq START 1;

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number INTEGER NOT NULL DEFAULT nextval('invoice_number_seq'),
  service_request_id UUID NOT NULL REFERENCES service_requests(id),
  client_id UUID NOT NULL REFERENCES profiles(id),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, cancelled
  pdf_path TEXT,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_invoices" ON invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "client_read_own_invoices" ON invoices FOR SELECT USING (auth.uid() = client_id);

-- ============================================
-- RECURRING PLANS
-- ============================================
CREATE TYPE plan_frequency AS ENUM ('weekly', 'biweekly', 'monthly', 'custom');
CREATE TYPE plan_status AS ENUM ('active', 'paused', 'cancelled', 'expired');

CREATE TABLE maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  address_id UUID NOT NULL REFERENCES addresses(id),
  name TEXT NOT NULL,
  frequency plan_frequency NOT NULL DEFAULT 'monthly',
  custom_interval_days INTEGER,
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  price_cents INTEGER NOT NULL,
  status plan_status NOT NULL DEFAULT 'active',
  tasks_included TEXT[],
  next_service_date DATE,
  start_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE maintenance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_plans" ON maintenance_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "client_own_plans" ON maintenance_plans FOR ALL USING (auth.uid() = client_id);

-- ============================================
-- CONTRACTS (CORPORATE)
-- ============================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_amount_cents INTEGER,
  sla_response_hours INTEGER DEFAULT 24,
  max_monthly_spend_cents INTEGER,
  locations UUID[] DEFAULT '{}', -- array of address_ids
  authorized_contacts JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_contracts" ON contracts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "client_own_contracts" ON contracts FOR SELECT USING (auth.uid() = client_id);

-- ============================================
-- EQUIPMENT / INVENTORY
-- ============================================
CREATE TYPE equipment_status AS ENUM ('available', 'in_use', 'maintenance', 'retired');

CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- cortadora, bordeadora, motosierra, sopladora, vehiculo, trailer, escalera
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  status equipment_status NOT NULL DEFAULT 'available',
  assigned_to_crew UUID REFERENCES crews(id),
  purchase_date DATE,
  last_maintenance DATE,
  next_maintenance DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_equipment" ON equipment FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "crew_read_equipment" ON equipment FOR SELECT USING (
  EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = equipment.assigned_to_crew AND cm.user_id = auth.uid())
);

-- ============================================
-- WEATHER CACHE
-- ============================================
CREATE TABLE weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone TEXT NOT NULL,
  forecast_date DATE NOT NULL,
  condition TEXT NOT NULL,
  temp_min NUMERIC(4,1),
  temp_max NUMERIC(4,1),
  rain_probability INTEGER,
  wind_speed NUMERIC(5,1),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone, forecast_date)
);

-- No RLS needed, public read
ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_public_read" ON weather_cache FOR SELECT USING (true);
CREATE POLICY "admin_manage_weather" ON weather_cache FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);

-- ============================================
-- QUOTE RULES (Smart quoting)
-- ============================================
CREATE TABLE quote_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES service_types(id),
  zone TEXT,
  min_area_sqm NUMERIC(10,2),
  max_area_sqm NUMERIC(10,2),
  price_per_sqm_cents INTEGER,
  base_price_cents INTEGER NOT NULL,
  multiplier NUMERIC(4,2) DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quote_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_rules" ON quote_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "rules_public_read" ON quote_rules FOR SELECT USING (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER set_updated_at_plans
  BEFORE UPDATE ON maintenance_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_contracts
  BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
