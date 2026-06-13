-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening
-- 1. Fix mutable search_path on set_updated_at trigger function
-- 2. Restrict all write policies (INSERT/UPDATE/DELETE) to authenticated only
--    Anonymous users retain SELECT access; writes require a valid session
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Re-create trigger function with an immutable search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ─── employees ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
CREATE POLICY "employees_insert" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "employees_update" ON public.employees;
CREATE POLICY "employees_update" ON public.employees
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "employees_delete" ON public.employees;
CREATE POLICY "employees_delete" ON public.employees
  FOR DELETE TO authenticated USING (true);

-- ─── routes ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "routes_insert" ON public.routes;
CREATE POLICY "routes_insert" ON public.routes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "routes_update" ON public.routes;
CREATE POLICY "routes_update" ON public.routes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "routes_delete" ON public.routes;
CREATE POLICY "routes_delete" ON public.routes
  FOR DELETE TO authenticated USING (true);

-- ─── roster_records ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "roster_insert" ON public.roster_records;
CREATE POLICY "roster_insert" ON public.roster_records
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "roster_update" ON public.roster_records;
CREATE POLICY "roster_update" ON public.roster_records
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "roster_delete" ON public.roster_records;
CREATE POLICY "roster_delete" ON public.roster_records
  FOR DELETE TO authenticated USING (true);

-- ─── route_assignments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignments_insert" ON public.route_assignments;
CREATE POLICY "assignments_insert" ON public.route_assignments
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "assignments_update" ON public.route_assignments;
CREATE POLICY "assignments_update" ON public.route_assignments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "assignments_delete" ON public.route_assignments;
CREATE POLICY "assignments_delete" ON public.route_assignments
  FOR DELETE TO authenticated USING (true);

-- ─── app_settings ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_insert" ON public.app_settings;
CREATE POLICY "settings_insert" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "settings_update" ON public.app_settings;
CREATE POLICY "settings_update" ON public.app_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "settings_delete" ON public.app_settings;
CREATE POLICY "settings_delete" ON public.app_settings
  FOR DELETE TO authenticated USING (true);

-- ─── roster_audit_log ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_insert_all" ON public.roster_audit_log;
CREATE POLICY "audit_insert_all" ON public.roster_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
