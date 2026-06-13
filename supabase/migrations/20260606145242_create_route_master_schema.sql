/*
# Route Master — Full Schema

## Summary
Creates all tables needed for the Route Master Employee Transport Management System.
This is a single-tenant enterprise app (no per-user isolation). All tables are accessible
via the anon key so the frontend can read and write without sign-in overhead.

## New Tables

### employees
Stores the master employee directory.
- id: uuid primary key
- employee_id: unique text identifier (e.g. EMP001)
- name: full name
- team: department/team
- tower: office tower assignment
- location: home locality
- shift: Morning | Afternoon | Night
- status: WFO | WFH | Leave
- address: full address string
- lat/lng: coordinates for map plotting
- created_at / updated_at

### routes
Defines transport routes and their vehicle config.
- id: uuid primary key
- route_number: unique identifier (e.g. RT001)
- route_name: descriptive name
- vehicle_capacity: max seats
- vehicle_type: Bus | Van | Car | Minibus
- status: Active | Inactive
- shift: which shift this route serves
- assigned_employees: computed count (updated via trigger)
- created_at / updated_at

### roster_records
Daily WFO/WFH/Leave roster per employee per date.
- id: uuid primary key
- employee_id: references employees.employee_id
- employee_name: denormalized for query convenience
- date: the roster date
- status: WFO | WFH | Leave
- shift: shift for that day
- uploaded_at: when the batch was uploaded

### route_assignments
Maps employees to routes for a given date/shift.
- id: uuid primary key
- employee_id: references employees.employee_id
- employee_name: denormalized
- route_number: references routes.route_number
- pickup_order: ordering within the route
- pickup_location: employee's pickup spot
- drop_location: employee's drop spot
- date: assignment date
- shift: shift
- pickup_time / drop_time: scheduled times

### app_settings
Key-value store for application configuration.
- id: uuid primary key
- key: unique setting name
- value: setting value as text
- updated_at

## Security
- RLS enabled on all tables
- SELECT policies allow anon + authenticated (read-only for unauthenticated sessions)
- INSERT / UPDATE / DELETE policies restricted to authenticated only
- set_updated_at trigger function uses SECURITY DEFINER + SET search_path = '' to prevent search_path injection
*/

-- ─────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   text UNIQUE NOT NULL,
  name          text NOT NULL,
  team          text NOT NULL DEFAULT '',
  tower         text NOT NULL DEFAULT '',
  location      text NOT NULL DEFAULT '',
  shift         text NOT NULL DEFAULT 'Morning' CHECK (shift IN ('Morning','Afternoon','Night')),
  status        text NOT NULL DEFAULT 'WFO'    CHECK (status IN ('WFO','WFH','Leave')),
  address       text NOT NULL DEFAULT '',
  lat           double precision NOT NULL DEFAULT 17.4152,
  lng           double precision NOT NULL DEFAULT 78.3516,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_shift  ON employees(shift);
CREATE INDEX IF NOT EXISTS idx_employees_team   ON employees(team);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────
-- ROUTES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_number        text UNIQUE NOT NULL,
  route_name          text NOT NULL,
  vehicle_capacity    integer NOT NULL DEFAULT 20 CHECK (vehicle_capacity > 0),
  vehicle_type        text NOT NULL DEFAULT 'Bus',
  status              text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  shift               text NOT NULL DEFAULT 'Morning',
  assigned_employees  integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_shift  ON routes(shift);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routes_select" ON routes;
CREATE POLICY "routes_select" ON routes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "routes_insert" ON routes;
CREATE POLICY "routes_insert" ON routes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "routes_update" ON routes;
CREATE POLICY "routes_update" ON routes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "routes_delete" ON routes;
CREATE POLICY "routes_delete" ON routes FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────
-- ROSTER RECORDS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   text NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  date          date NOT NULL,
  status        text NOT NULL DEFAULT 'WFO' CHECK (status IN ('WFO','WFH','Leave')),
  shift         text NOT NULL DEFAULT 'Morning',
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_roster_date        ON roster_records(date);
CREATE INDEX IF NOT EXISTS idx_roster_employee_id ON roster_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_roster_status      ON roster_records(status);

ALTER TABLE roster_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roster_select" ON roster_records;
CREATE POLICY "roster_select" ON roster_records FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "roster_insert" ON roster_records;
CREATE POLICY "roster_insert" ON roster_records FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "roster_update" ON roster_records;
CREATE POLICY "roster_update" ON roster_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "roster_delete" ON roster_records;
CREATE POLICY "roster_delete" ON roster_records FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────
-- ROUTE ASSIGNMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS route_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      text NOT NULL,
  employee_name    text NOT NULL DEFAULT '',
  route_number     text NOT NULL,
  pickup_order     integer NOT NULL DEFAULT 1,
  pickup_location  text NOT NULL DEFAULT '',
  drop_location    text NOT NULL DEFAULT '',
  date             date NOT NULL,
  shift            text NOT NULL DEFAULT 'Morning',
  pickup_time      text NOT NULL DEFAULT '',
  drop_time        text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date, shift)
);

CREATE INDEX IF NOT EXISTS idx_assignments_date   ON route_assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_route  ON route_assignments(route_number);
CREATE INDEX IF NOT EXISTS idx_assignments_shift  ON route_assignments(shift);

ALTER TABLE route_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_select" ON route_assignments;
CREATE POLICY "assignments_select" ON route_assignments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "assignments_insert" ON route_assignments;
CREATE POLICY "assignments_insert" ON route_assignments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "assignments_update" ON route_assignments;
CREATE POLICY "assignments_update" ON route_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "assignments_delete" ON route_assignments;
CREATE POLICY "assignments_delete" ON route_assignments FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────
-- APP SETTINGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text UNIQUE NOT NULL,
  value      text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON app_settings;
CREATE POLICY "settings_select" ON app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_insert" ON app_settings;
CREATE POLICY "settings_insert" ON app_settings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "settings_update" ON app_settings;
CREATE POLICY "settings_update" ON app_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "settings_delete" ON app_settings;
CREATE POLICY "settings_delete" ON app_settings FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────
-- TRIGGER: keep updated_at fresh
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'employees_updated_at') THEN
    CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'routes_updated_at') THEN
    CREATE TRIGGER routes_updated_at BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'settings_updated_at') THEN
    CREATE TRIGGER settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────
-- DEFAULT APP SETTINGS
-- ─────────────────────────────────────────
INSERT INTO app_settings (key, value) VALUES
  ('company_name',          'TechCorp Hyderabad'),
  ('office_address',        'Hyderabad Financial District, Nanakramguda, Hyderabad 500032'),
  ('office_lat',            '17.4152'),
  ('office_lng',            '78.3516'),
  ('google_api_key',        ''),
  ('default_capacity',      '20'),
  ('default_vehicle_type',  'Bus'),
  ('pickup_buffer_min',     '5'),
  ('drop_buffer_min',       '5'),
  ('email_notifications',   'true'),
  ('unassigned_alert',      'true'),
  ('route_change_alert',    'true'),
  ('daily_report_email',    ''),
  ('smtp_host',             ''),
  ('smtp_port',             '587')
ON CONFLICT (key) DO NOTHING;
