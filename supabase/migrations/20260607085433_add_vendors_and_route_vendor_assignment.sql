
-- ─────────────────────────────────────────
-- VENDORS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name   text NOT NULL,
  contact_name   text NOT NULL DEFAULT '',
  email          text NOT NULL,
  phone          text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON vendors FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "vendors_insert" ON vendors FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "vendors_update" ON vendors FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vendors_delete" ON vendors FOR DELETE
  TO authenticated USING (true);

-- ─────────────────────────────────────────
-- ADD VENDOR COLUMNS TO ROUTES
-- ─────────────────────────────────────────
ALTER TABLE routes ADD COLUMN IF NOT EXISTS vendor_id   uuid REFERENCES vendors(id) ON DELETE SET NULL;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS vendor_name text NOT NULL DEFAULT '';
