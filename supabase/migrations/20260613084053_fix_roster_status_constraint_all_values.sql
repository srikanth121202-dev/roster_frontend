-- Expand roster_records status check to include all supported statuses
ALTER TABLE roster_records DROP CONSTRAINT IF EXISTS roster_records_status_check;
ALTER TABLE roster_records ADD CONSTRAINT roster_records_status_check
  CHECK (UPPER(status) IN (
    'WFO', 'WFH', 'LEAVE', 'HOLIDAY', 'WEEKOFF', 'COMPOFF', 'TRAINING', 'BUSINESSTRAVEL'
  ));

-- Also expand employees status check for consistency
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (UPPER(status) IN (
    'WFO', 'WFH', 'LEAVE', 'HOLIDAY', 'WEEKOFF', 'COMPOFF', 'TRAINING', 'BUSINESSTRAVEL',
    'ACTIVE', 'INACTIVE'
  ));
