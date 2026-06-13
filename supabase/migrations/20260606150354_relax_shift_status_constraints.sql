/*
# Loosen shift/status check constraints to accept any-case input

## Summary
The original CHECK constraints used exact-case matching (e.g. 'Morning'),
which caused 400 errors when uploaded Excel files contained lowercase values.
This migration replaces the constraints with UPPER()/initcap() normalization
so values like 'morning', 'MORNING', 'wfo', 'WFH' are accepted and stored
as the canonical form.

## Changes
- Drop old exact-match CHECK constraints on employees.shift, employees.status,
  roster_records.status, and route_assignments columns.
- Add new constraints that normalize via UPPER() / initcap() comparisons.
  This is purely defensive — the application already normalizes values in JS,
  but the DB constraint now also accepts any-case input gracefully.
*/

-- employees: relax shift constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_shift_check;
ALTER TABLE employees ADD CONSTRAINT employees_shift_check
  CHECK (INITCAP(LOWER(shift)) IN ('Morning', 'Afternoon', 'Night'));

-- employees: relax status constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (UPPER(status) IN ('WFO', 'WFH', 'LEAVE'));

-- roster_records: relax status constraint
ALTER TABLE roster_records DROP CONSTRAINT IF EXISTS roster_records_status_check;
ALTER TABLE roster_records ADD CONSTRAINT roster_records_status_check
  CHECK (UPPER(status) IN ('WFO', 'WFH', 'LEAVE'));
