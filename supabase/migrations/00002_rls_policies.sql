-- RLS Policies for all roles

-- Admin/Supervisor can read everything
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_read_all_requests" ON service_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_update_requests" ON service_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_quotes" ON quotes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_quote_items" ON quote_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_crews" ON crews FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_crew_members" ON crew_members FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_assignments" ON assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_state_log" ON service_state_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_checklists" ON checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_checklist_items" ON checklist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_photos" ON service_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_reviews" ON reviews FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_materials" ON materials_log FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_templates" ON checklist_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_template_items" ON checklist_template_items FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_all_addresses" ON addresses FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);
CREATE POLICY "admin_update_service_types" ON service_types FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'supervisor'))
);

-- Crew can read their assignments and related data
CREATE POLICY "crew_read_assignments" ON assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = assignments.crew_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_read_requests" ON service_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.service_request_id = service_requests.id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_update_requests" ON service_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.service_request_id = service_requests.id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_checklists" ON checklists FOR ALL USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.id = checklists.assignment_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_checklist_items" ON checklist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM checklists c JOIN assignments a ON a.id = c.assignment_id JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE c.id = checklist_items.checklist_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_photos" ON service_photos FOR ALL USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.id = service_photos.assignment_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_materials" ON materials_log FOR ALL USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.id = materials_log.assignment_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_insert_state_log" ON service_state_log FOR INSERT WITH CHECK (auth.uid() = changed_by);
CREATE POLICY "crew_read_state_log" ON service_state_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM assignments a JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE a.service_request_id = service_state_log.service_request_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_read_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "crew_update_assignments" ON assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = assignments.crew_id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_read_crews" ON crews FOR SELECT USING (
  EXISTS (SELECT 1 FROM crew_members cm WHERE cm.crew_id = crews.id AND cm.user_id = auth.uid())
);
CREATE POLICY "crew_read_crew_members" ON crew_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM crew_members cm2 WHERE cm2.crew_id = crew_members.crew_id AND cm2.user_id = auth.uid())
);
CREATE POLICY "crew_read_addresses" ON addresses FOR SELECT USING (
  EXISTS (SELECT 1 FROM service_requests sr JOIN assignments a ON a.service_request_id = sr.id JOIN crew_members cm ON cm.crew_id = a.crew_id WHERE sr.address_id = addresses.id AND cm.user_id = auth.uid())
);

-- Client additional policies
CREATE POLICY "client_insert_state_log" ON service_state_log FOR INSERT WITH CHECK (auth.uid() = changed_by);
CREATE POLICY "client_read_state_log" ON service_state_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM service_requests sr WHERE sr.id = service_state_log.service_request_id AND sr.client_id = auth.uid())
);
CREATE POLICY "client_update_quotes" ON quotes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM service_requests sr WHERE sr.id = quotes.service_request_id AND sr.client_id = auth.uid())
);
CREATE POLICY "client_read_quote_items" ON quote_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM quotes q JOIN service_requests sr ON sr.id = q.service_request_id WHERE q.id = quote_items.quote_id AND sr.client_id = auth.uid())
);
CREATE POLICY "client_read_assignments" ON assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM service_requests sr WHERE sr.id = assignments.service_request_id AND sr.client_id = auth.uid())
);
CREATE POLICY "client_read_photos" ON service_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM assignments a JOIN service_requests sr ON sr.id = a.service_request_id WHERE a.id = service_photos.assignment_id AND sr.client_id = auth.uid())
);
CREATE POLICY "client_update_requests" ON service_requests FOR UPDATE USING (auth.uid() = client_id);
