-- ============================================================
-- Crew Real-time Location Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crew_locations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- One row per assignment (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS crew_locations_assignment_idx
  ON public.crew_locations (assignment_id);

ALTER TABLE public.crew_locations ENABLE ROW LEVEL SECURITY;

-- Crew member manages their own location
CREATE POLICY "crew_manage_own_location" ON public.crew_locations
  FOR ALL USING (user_id = auth.uid());

-- Client can see location of crew assigned to their service
CREATE POLICY "client_read_crew_location" ON public.crew_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.service_requests sr ON sr.id = a.service_request_id
      WHERE a.id = crew_locations.assignment_id
        AND sr.client_id = auth.uid()
    )
  );

-- Admin/supervisor can read all
CREATE POLICY "admin_read_crew_locations" ON public.crew_locations
  FOR SELECT USING (current_user_role() IN ('admin', 'supervisor'));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_locations;
