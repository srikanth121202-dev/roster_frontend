-- Extend roster_records for the full roster management module
ALTER TABLE roster_records
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tower text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cab_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drop_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS manager_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS remarks text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'Draft';

-- Add primary key if none exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'roster_records'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE roster_records ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Backfill existing rows that still have a null id
UPDATE roster_records SET id = gen_random_uuid() WHERE id IS NULL;

-- Create roster audit log table
CREATE TABLE IF NOT EXISTS roster_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  work_date   date NOT NULL,
  field_changed text NOT NULL,
  old_value   text NOT NULL DEFAULT '',
  new_value   text NOT NULL DEFAULT '',
  updated_by  text NOT NULL DEFAULT 'system',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roster_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_all" ON roster_audit_log
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "audit_insert_all" ON roster_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_roster_audit_emp ON roster_audit_log (employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_roster_records_team  ON roster_records (team);
CREATE INDEX IF NOT EXISTS idx_roster_records_tower ON roster_records (tower);
CREATE INDEX IF NOT EXISTS idx_roster_records_approval ON roster_records (approval_status);
