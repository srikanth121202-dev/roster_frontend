
CREATE TABLE driver_submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  route_number   text NOT NULL,
  date           date NOT NULL,
  driver_name    text NOT NULL,
  driver_phone   text NOT NULL,
  vehicle_number text NOT NULL,
  vehicle_model  text NOT NULL DEFAULT '',
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, route_number, date)
);

ALTER TABLE driver_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_submissions_select" ON driver_submissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "driver_submissions_insert" ON driver_submissions FOR INSERT
  TO authenticated WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
  );

CREATE POLICY "driver_submissions_update" ON driver_submissions FOR UPDATE
  TO authenticated
  USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));
