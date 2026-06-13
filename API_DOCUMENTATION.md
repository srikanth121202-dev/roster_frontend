# API Documentation

**Transport Management System**
Backend: Supabase (PostgreSQL + RLS)
All data access is handled through typed service modules in `src/services/index.ts`.
There are no custom HTTP endpoints — the Supabase client communicates directly with the database via its REST interface.

---

## Table of Contents

1. [Data Models](#data-models)
2. [employeeService](#employeeservice)
3. [routeService](#routeservice)
4. [rosterService](#rosterservice)
5. [assignmentService](#assignmentservice)
6. [sheetService](#sheetservice)
7. [dashboardService](#dashboardservice)
8. [vendorService](#vendorservice)
9. [driverService](#driverservice)
10. [settingsService](#settingsservice)
11. [Database Tables](#database-tables)
12. [Enums & Constants](#enums--constants)

---

## Data Models

### `Employee`

```ts
interface Employee {
  id: string;                            // UUID — internal DB row ID
  employee_id: string;                   // Business identifier (unique)
  name: string;
  team: string;                          // Team / department
  tower: string;                         // Office tower / building
  location: string;                      // Home locality
  address: string;                       // Full home address
  shift: 'Morning' | 'Afternoon' | 'Night';
  status: 'WFO' | 'WFH' | 'Leave';
  phone: string;
  gender: string;
  lat: number;                           // Home latitude (for map routing)
  lng: number;                           // Home longitude (for map routing)
  route_number?: string;                 // Currently assigned route
  pickup_order?: number;                 // Pickup sequence on that route
}
```

---

### `Route`

```ts
interface Route {
  id: string;
  route_number: string;                  // e.g. "MOR-001"
  route_name: string;
  vehicle_type: string;                  // e.g. "Bus", "Mini Van"
  vehicle_capacity: number;             // Max passenger seats
  assigned_employees: number;           // Current count (maintained by assignmentService.generate)
  status: 'Active' | 'Inactive';
  shift: string;
  vendor_id?: string | null;
  vendor_name?: string;
}
```

---

### `Vendor`

```ts
interface Vendor {
  id: string;
  user_id: string;                       // Supabase auth UID
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
}
```

---

### `DriverSubmission`

```ts
interface DriverSubmission {
  id: string;
  vendor_id: string;
  route_number: string;
  date: string;                          // ISO date "YYYY-MM-DD"
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;               // Registration plate
  vehicle_model: string;
  submitted_at: string;                  // ISO timestamp
}
```

---

### `RosterRecord`

```ts
interface RosterRecord {
  id?: string;
  employee_id: string;
  employee_name: string;
  date: string;                          // ISO date "YYYY-MM-DD"
  status: RosterStatus;
  shift: string;
  team: string;
  tower: string;
  cab_used: boolean;
  pickup_required: boolean;
  drop_required: boolean;
  transport_required: boolean;
  gender: string;
  manager_name: string;
  remarks: string;
  approval_status: 'Draft' | 'Submitted' | 'Approved' | 'Finalized';
}
```

**`RosterStatus`** values:
`WFO` | `WFH` | `Leave` | `Holiday` | `WeekOff` | `CompOff` | `Training` | `BusinessTravel`

---

### `RosterDashboardStats`

```ts
interface RosterDashboardStats {
  total: number;
  wfo: number;
  wfh: number;
  leave: number;
  holiday: number;
  weekOff: number;
  other: number;
  transport_required: number;
  by_shift:  { shift: string;  count: number }[];
  by_team:   { team: string;   count: number }[];   // top 10
  by_tower:  { tower: string;  count: number }[];
  by_status: { name: string;   value: number }[];
}
```

---

### `RosterAuditEntry`

```ts
interface RosterAuditEntry {
  id: string;
  employee_id: string;
  work_date: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  updated_by: string;
  updated_at: string;
}
```

---

### `DashboardStats`

```ts
interface DashboardStats {
  total_employees: number;
  wfo_today: number;
  wfh_today: number;
  total_routes: number;
  assigned_employees: number;
  unassigned_employees: number;
}
```

---

### `PickupSheet` / `DropSheet`

```ts
interface PickupSheet {
  route_number: string;
  employee_id: string;
  employee_name: string;
  pickup_location: string;
  pickup_order: number;
  shift: string;
  pickup_time: string;
}

interface DropSheet {
  route_number: string;
  employee_id: string;
  employee_name: string;
  drop_location: string;
  shift: string;
  drop_time: string;
}
```

---

## employeeService

**Source:** `src/services/index.ts`
**DB table:** `employees`

---

### `getAll() → Promise<Employee[]>`

Returns all employees ordered by `employee_id`.

```ts
const employees = await employeeService.getAll();
```

---

### `create(emp) → Promise<Employee>`

Creates a new employee. All fields required except `id`.

```ts
const emp = await employeeService.create({
  employee_id: 'EMP001',
  name: 'Jane Doe',
  team: 'Engineering',
  tower: 'Tower A',
  location: 'Kondapur',
  address: '12 Main St, Kondapur',
  shift: 'Morning',
  status: 'WFO',
  phone: '9876543210',
  gender: 'Female',
  lat: 17.4604,
  lng: 78.3516,
});
```

---

### `update(id, emp) → Promise<void>`

Partial update matched by internal UUID `id`.

```ts
await employeeService.update('uuid-here', { shift: 'Night', location: 'Gachibowli' });
```

---

### `delete(id) → Promise<void>`

Deletes employee by internal UUID.

```ts
await employeeService.delete('uuid-here');
```

---

### `bulkUpsert(employees) → Promise<{ count: number }>`

Upserts an array of employees. Conflict key: `employee_id`.

```ts
const { count } = await employeeService.bulkUpsert([...employees]);
// count = number of rows inserted or updated
```

---

## routeService

**Source:** `src/services/index.ts`
**DB table:** `routes`

---

### `getAll() → Promise<Route[]>`

All routes ordered by `route_number`.

```ts
const routes = await routeService.getAll();
```

---

### `create(route) → Promise<Route>`

Creates a route. `assigned_employees` is auto-set to `0`.

```ts
const route = await routeService.create({
  route_number: 'MOR-001',
  route_name: 'Morning Route 1',
  vehicle_type: 'Bus',
  vehicle_capacity: 32,
  status: 'Active',
  shift: 'Morning',
  vendor_id: null,
  vendor_name: '',
});
```

---

### `update(id, route) → Promise<void>`

Partial update by internal UUID.

```ts
await routeService.update('uuid-here', { vehicle_capacity: 40, status: 'Inactive' });
```

---

### `delete(id) → Promise<void>`

```ts
await routeService.delete('uuid-here');
```

---

### `getOrCreateForShift(shift, count, vehicleCapacity, vehicleType) → Promise<Route[]>`

Returns existing active routes for a shift. Auto-creates missing routes to reach `count`.
Route numbers are auto-generated: `MOR-001`, `AFT-002`, `NGT-003`.

```ts
const routes = await routeService.getOrCreateForShift('Morning', 3, 32, 'Bus');
// Returns (or creates) 3 active Morning routes
```

| Parameter | Type | Description |
|---|---|---|
| `shift` | `string` | `'Morning'`, `'Afternoon'`, or `'Night'` |
| `count` | `number` | Minimum routes needed |
| `vehicleCapacity` | `number` | Seats per vehicle for newly created routes |
| `vehicleType` | `string` | Vehicle type for newly created routes |

---

## rosterService

**Source:** `src/services/index.ts`
**DB table:** `roster_records`, `roster_audit_log`

---

### `getAll() → Promise<RosterRecord[]>`

All records, newest date first, then ordered by `employee_id`.

---

### `getByDate(date) → Promise<RosterRecord[]>`

Records for a single ISO date.

```ts
const records = await rosterService.getByDate('2026-06-09');
```

---

### `getByDateRange(start, end) → Promise<RosterRecord[]>`

Inclusive date range, ordered by date then employee.

```ts
const records = await rosterService.getByDateRange('2026-06-01', '2026-06-30');
```

---

### `update(employeeId, date, changes, updatedBy?) → Promise<void>`

Updates a single roster cell and automatically writes a diff entry to `roster_audit_log` for every changed field.

```ts
await rosterService.update('EMP001', '2026-06-09', { status: 'WFH', shift: 'Afternoon' }, 'admin');
```

| Parameter | Type | Default |
|---|---|---|
| `employeeId` | `string` | required |
| `date` | `string` | required |
| `changes` | `Partial<RosterRecord>` | required |
| `updatedBy` | `string` | `'admin'` |

---

### `getDashboardStats(date) → Promise<RosterDashboardStats>`

Aggregated counts by status, shift, team, and tower for the given date.

```ts
const stats = await rosterService.getDashboardStats('2026-06-09');
// { total: 120, wfo: 80, wfh: 30, leave: 10, transport_required: 65, by_team: [...], ... }
```

---

### `getWeeklyTrend() → Promise<RosterTrendPoint[]>`

Last 7 days of WFO / WFH / Leave counts keyed by day abbreviation.

```ts
const trend = await rosterService.getWeeklyTrend();
// [{ date: 'Mon', wfo: 70, wfh: 25, leave: 5, other: 0 }, ...]
```

---

### `getAuditLog(employeeId, date) → Promise<RosterAuditEntry[]>`

Change history for a single employee on a specific date, newest first.

```ts
const log = await rosterService.getAuditLog('EMP001', '2026-06-09');
```

---

### `bulkUpsert(records) → Promise<{ count: number }>`

Upserts many roster rows at once. Conflict key: `(employee_id, date)`.
If `date` equals today, also syncs each employee's `status` and `shift` in the `employees` master table.

```ts
const { count } = await rosterService.bulkUpsert(parsedExcelRows);
```

---

### `finalizeDate(date) → Promise<void>`

Sets `approval_status = 'Approved'` for all WFO records on the given date.

```ts
await rosterService.finalizeDate('2026-06-09');
```

---

## assignmentService

**Source:** `src/services/index.ts`
**DB table:** `route_assignments`

---

### `getByVendorAndDate(vendorId, date) → Promise<{ routes, assignments }>`

Vendor-scoped view. Returns the vendor's routes and all assignments for those routes on the given date.
Enriches each assignment row with employee `phone`, `gender`, `team`, `tower`, `location`, `address`.

```ts
const { routes, assignments } = await assignmentService.getByVendorAndDate('vendor-uuid', '2026-06-09');
```

**Return shape:**
```ts
{
  routes: {
    route_number: string;
    route_name: string;
    shift: string;
    vehicle_capacity: number;
    vehicle_type: string;
  }[];
  assignments: Array<RouteAssignment & {
    employee_phone: string;
    employee_gender: string;
    employee_team: string;
    employee_tower: string;
    employee_location: string;
    employee_address: string;
  }>;
}
```

---

### `getByDate(date, shift?, routeNumber?) → Promise<RouteAssignment[]>`

All assignments for a date. Pass `'All'` (or omit) to skip a filter.

```ts
// All assignments for the date
const all = await assignmentService.getByDate('2026-06-09');

// Filter by shift
const morning = await assignmentService.getByDate('2026-06-09', 'Morning');

// Filter by route
const route1 = await assignmentService.getByDate('2026-06-09', 'All', 'MOR-001');
```

---

### `getByRoute(routeNumber, date) → Promise<RouteStop[]>`

Ordered stop list for one route on one date. Enriched with `lat`, `lng`, `address`, `team`, `tower`.

```ts
const stops = await assignmentService.getByRoute('MOR-001', '2026-06-09');
```

**Return shape (per stop):**
```ts
{
  id: string;
  pickup_order: number;
  employee_id: string;
  employee_name: string;
  pickup_location: string;
  drop_location: string;
  address: string;
  team: string;
  tower: string;
  shift: string;
  pickup_time: string;
  drop_time: string;
  lat: number;
  lng: number;
}
```

---

### `generate(date) → Promise<number>`

Auto-generates route assignments for all WFO employees in the roster on `date`.

**Algorithm:**
1. Reads WFO employees from `roster_records` for the given date
2. Enriches with `employees` table for location data (best-effort)
3. Groups employees by shift
4. Assigns round-robin across active routes that match each shift
5. Falls back to all active routes if no shift-matched routes exist

**Default pickup times:**
| Shift | Pickup Time | Drop Time |
|---|---|---|
| Morning | 07:30 AM | 09:30 PM |
| Afternoon | 01:30 PM | 10:30 PM |
| Night | 09:30 PM | 06:30 AM |

Conflict key: `(employee_id, date, shift)` — safe to re-run.

```ts
const count = await assignmentService.generate('2026-06-09');
// count = number of assignments created/updated
```

**Throws** descriptive errors if:
- No WFO employees found in roster for `date`
- No active routes are configured

---

## sheetService

**Source:** `src/services/index.ts`
**DB table:** `route_assignments` (read-only)

---

### `getPickupSheets(date?) → Promise<PickupSheet[]>`

Ordered pickup sheet rows for a date (defaults to today).

```ts
const sheets = await sheetService.getPickupSheets('2026-06-09');
```

---

### `getDropSheets(date?) → Promise<DropSheet[]>`

Drop sheet rows for a date (defaults to today), ordered by `route_number` then `employee_id`.

```ts
const sheets = await sheetService.getDropSheets('2026-06-09');
```

---

## dashboardService

**Source:** `src/services/index.ts`

---

### `getStats() → Promise<DashboardStats>`

Live counts for today across employees, routes, and assignments.

```ts
const stats = await dashboardService.getStats();
// { total_employees: 500, wfo_today: 120, wfh_today: 80, total_routes: 8,
//   assigned_employees: 115, unassigned_employees: 5 }
```

---

### `getRouteUtilization() → Promise<RouteUtilization[]>`

Per-route utilization percentages.

```ts
const util = await dashboardService.getRouteUtilization();
// [{ route: 'MOR-001', capacity: 32, assigned: 28, utilization: 87 }, ...]
```

---

### `getEmployeeTrend() → Promise<EmployeeTrend[]>`

Last 6 days of WFO / WFH / Leave counts.

```ts
const trend = await dashboardService.getEmployeeTrend();
// [{ date: 'Mon', wfo: 70, wfh: 20, leave: 5 }, ...]
```

---

### `getShiftDistribution() → Promise<ShiftDistribution[]>`

Count of currently WFO employees per shift.

```ts
const dist = await dashboardService.getShiftDistribution();
// [{ name: 'Morning', value: 60 }, { name: 'Afternoon', value: 35 }, { name: 'Night', value: 20 }]
```

---

### `getRouteOccupancy() → Promise<RouteOccupancy[]>`

Last 6 days of assignment counts split by shift.

```ts
const occ = await dashboardService.getRouteOccupancy();
// [{ date: 'Mon', morning: 55, afternoon: 30, night: 18 }, ...]
```

---

## vendorService

**Source:** `src/services/index.ts`
**DB table:** `vendors`

---

### `getAll() → Promise<Vendor[]>`

All vendors ordered by `company_name`.

```ts
const vendors = await vendorService.getAll();
```

---

### `getByUserId(userId) → Promise<Vendor | null>`

Looks up a vendor by Supabase auth UID. Returns `null` if not found.

```ts
const vendor = await vendorService.getByUserId(session.user.id);
if (!vendor) redirect('/vendor-login');
```

---

## driverService

**Source:** `src/services/index.ts`
**DB table:** `driver_submissions`

---

### `getByVendorAndDate(vendorId, date) → Promise<DriverSubmission[]>`

All driver submissions for a vendor on a given date.

```ts
const submissions = await driverService.getByVendorAndDate('vendor-uuid', '2026-06-09');
```

---

### `upsert(submission) → Promise<void>`

Create or update a driver submission.
Conflict key: `(vendor_id, route_number, date)`.
Automatically sets `submitted_at` to current timestamp.

```ts
await driverService.upsert({
  vendor_id: 'vendor-uuid',
  route_number: 'MOR-001',
  date: '2026-06-09',
  driver_name: 'Ravi Kumar',
  driver_phone: '9876543210',
  vehicle_number: 'TS09AB1234',
  vehicle_model: 'Tata Winger',
});
```

---

## settingsService

**Source:** `src/services/index.ts`
**DB table:** `app_settings`

---

### `getAll() → Promise<Record<string, string>>`

Returns all app settings as a flat `{ key: value }` map.

```ts
const settings = await settingsService.getAll();
const lat = parseFloat(settings.office_lat ?? '17.4152');
```

**Known setting keys:**

| Key | Description | Default |
|---|---|---|
| `office_lat` | Office latitude | `17.4152` |
| `office_lng` | Office longitude | `78.3516` |
| `office_address` | Office address string | — |
| `google_api_key` | Google Maps JavaScript API key | — |
| `morning_arrival_time` | Office arrival time for Morning shift | — |
| `afternoon_arrival_time` | Office arrival time for Afternoon shift | — |
| `night_arrival_time` | Office arrival time for Night shift | — |

---

### `set(key, value) → Promise<void>`

Upsert a single setting.

```ts
await settingsService.set('office_address', 'Mindspace, Madhapur, Hyderabad');
```

---

### `setMany(settings) → Promise<void>`

Upsert multiple settings in one call.

```ts
await settingsService.setMany({
  office_lat: '17.4504',
  office_lng: '78.3816',
  office_address: 'Cyber Towers, Hitech City, Hyderabad',
  google_api_key: 'AIza...',
});
```

---

## Database Tables

| Table | Primary Key | Unique / Conflict Key |
|---|---|---|
| `employees` | `id` (UUID) | `employee_id` |
| `routes` | `id` (UUID) | `route_number` |
| `route_assignments` | `id` (UUID) | `(employee_id, date, shift)` |
| `roster_records` | `id` (UUID) | `(employee_id, date)` |
| `roster_audit_log` | `id` (UUID) | — |
| `vendors` | `id` (UUID) | `user_id` |
| `driver_submissions` | `id` (UUID) | `(vendor_id, route_number, date)` |
| `app_settings` | `id` (UUID) | `key` |

All tables have **Row Level Security (RLS)** enabled with separate policies per CRUD operation.
Authenticated admin users can read/write all records.
Vendor users are scoped to their own data via `vendor_id` / `user_id` checks.

---

## Enums & Constants

### `RosterStatus`
```
WFO | WFH | Leave | Holiday | WeekOff | CompOff | Training | BusinessTravel
```

### `ApprovalStatus`
```
Draft | Submitted | Approved | Finalized
```

### `Employee.status`
```
WFO | WFH | Leave
```

### `Employee.shift`
```
Morning | Afternoon | Night
```

### `Route.status`
```
Active | Inactive
```

### Route number prefixes (auto-generated)
| Shift | Prefix | Example |
|---|---|---|
| Morning | `MOR` | `MOR-001` |
| Afternoon | `AFT` | `AFT-002` |
| Night | `NGT` | `NGT-003` |
| Other | `GEN` | `GEN-001` |
