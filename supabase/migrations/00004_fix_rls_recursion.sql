-- Fix infinite recursion in RLS policies
-- Root cause 1: policies on OTHER tables did EXISTS(SELECT FROM profiles)
--   which triggered profiles' own admin policy → recursion
-- Root cause 2: crew_read_crew_members queried crew_members within itself
-- Root cause 3: crew_read_requests queried assignments which queried service_requests
--
-- Solution: SECURITY DEFINER functions bypass RLS for role/membership checks

-- ── is_in_crew ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_in_crew(check_crew_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM crew_members
    WHERE crew_id = check_crew_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_in_crew(UUID) TO authenticated;

DROP POLICY IF EXISTS "crew_read_crew_members" ON crew_members;
CREATE POLICY "crew_read_crew_members" ON crew_members FOR SELECT USING (
  is_in_crew(crew_id)
);

-- ── is_crew_for_request ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_crew_for_request(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    JOIN crew_members cm ON cm.crew_id = a.crew_id
    WHERE a.service_request_id = p_request_id AND cm.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_crew_for_request(UUID) TO authenticated;

DROP POLICY IF EXISTS "crew_read_requests" ON service_requests;
CREATE POLICY "crew_read_requests" ON service_requests FOR SELECT USING (
  is_crew_for_request(id)
);

DROP POLICY IF EXISTS "crew_update_requests" ON service_requests;
CREATE POLICY "crew_update_requests" ON service_requests FOR UPDATE USING (
  is_crew_for_request(id)
);

-- ── current_user_role ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── service_requests ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_requests" ON service_requests;
CREATE POLICY "admin_read_all_requests" ON service_requests FOR SELECT USING (
  current_user_role() IN ('admin', 'supervisor')
);

DROP POLICY IF EXISTS "admin_update_requests" ON service_requests;
CREATE POLICY "admin_update_requests" ON service_requests FOR UPDATE USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── quotes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_quotes" ON quotes;
CREATE POLICY "admin_all_quotes" ON quotes FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── quote_items ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_quote_items" ON quote_items;
CREATE POLICY "admin_all_quote_items" ON quote_items FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── crews ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_crews" ON crews;
CREATE POLICY "admin_all_crews" ON crews FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── crew_members ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_crew_members" ON crew_members;
CREATE POLICY "admin_all_crew_members" ON crew_members FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── assignments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_assignments" ON assignments;
CREATE POLICY "admin_all_assignments" ON assignments FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── service_state_log ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_state_log" ON service_state_log;
CREATE POLICY "admin_all_state_log" ON service_state_log FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── checklists ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_checklists" ON checklists;
CREATE POLICY "admin_all_checklists" ON checklists FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── checklist_items ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_checklist_items" ON checklist_items;
CREATE POLICY "admin_all_checklist_items" ON checklist_items FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── service_photos ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_photos" ON service_photos;
CREATE POLICY "admin_all_photos" ON service_photos FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── reviews ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_reviews" ON reviews;
CREATE POLICY "admin_all_reviews" ON reviews FOR SELECT USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── materials_log ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_materials" ON materials_log;
CREATE POLICY "admin_all_materials" ON materials_log FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── checklist_templates ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_templates" ON checklist_templates;
CREATE POLICY "admin_all_templates" ON checklist_templates FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── checklist_template_items ────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_template_items" ON checklist_template_items;
CREATE POLICY "admin_all_template_items" ON checklist_template_items FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── addresses ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_addresses" ON addresses;
CREATE POLICY "admin_all_addresses" ON addresses FOR SELECT USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── service_types ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_update_service_types" ON service_types;
CREATE POLICY "admin_update_service_types" ON service_types FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── payments (migration 00003) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_payments" ON payments;
CREATE POLICY "admin_all_payments" ON payments FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── invoices (migration 00003) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_invoices" ON invoices;
CREATE POLICY "admin_all_invoices" ON invoices FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── maintenance_plans (migration 00003) ──────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_plans" ON maintenance_plans;
CREATE POLICY "admin_all_plans" ON maintenance_plans FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── contracts (migration 00003) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_contracts" ON contracts;
CREATE POLICY "admin_all_contracts" ON contracts FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── equipment (migration 00003) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_equipment" ON equipment;
CREATE POLICY "admin_all_equipment" ON equipment FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── weather_cache (migration 00003) ──────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_weather" ON weather_cache;
CREATE POLICY "admin_manage_weather" ON weather_cache FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);

-- ── quote_rules (migration 00003) ────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_rules" ON quote_rules;
CREATE POLICY "admin_all_rules" ON quote_rules FOR ALL USING (
  current_user_role() IN ('admin', 'supervisor')
);
