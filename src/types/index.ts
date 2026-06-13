export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  team: string;
  tower: string;
  location: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  status: 'WFO' | 'WFH' | 'Leave';
  address: string;
  lat: number;
  lng: number;
  phone: string;
  gender: string;
  route_number?: string;
  pickup_order?: number;
}

export interface Route {
  id: string;
  route_number: string;
  route_name: string;
  vehicle_capacity: number;
  vehicle_type: string;
  assigned_employees: number;
  status: 'Active' | 'Inactive';
  shift: string;
  vendor_id?: string | null;
  vendor_name?: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
}

export interface DriverSubmission {
  id: string;
  vendor_id: string;
  route_number: string;
  date: string;
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  vehicle_model: string;
  submitted_at: string;
}

export type RosterStatus =
  | 'WFO' | 'WFH' | 'Leave' | 'Holiday'
  | 'WeekOff' | 'CompOff' | 'Training' | 'BusinessTravel';

export type ApprovalStatus = 'Draft' | 'Submitted' | 'Approved' | 'Finalized';

export interface RosterRecord {
  id?: string;
  employee_id: string;
  employee_name: string;
  date: string;
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
  approval_status: ApprovalStatus;
}

export interface RosterDashboardStats {
  total: number;
  wfo: number;
  wfh: number;
  leave: number;
  holiday: number;
  weekOff: number;
  other: number;
  transport_required: number;
  by_shift: { shift: string; count: number }[];
  by_team: { team: string; count: number }[];
  by_tower: { tower: string; count: number }[];
  by_status: { name: string; value: number }[];
}

export interface RosterTrendPoint {
  date: string;
  wfo: number;
  wfh: number;
  leave: number;
  other: number;
}

export interface RosterAuditEntry {
  id: string;
  employee_id: string;
  work_date: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  updated_by: string;
  updated_at: string;
}

export interface DashboardStats {
  total_employees: number;
  wfo_today: number;
  wfh_today: number;
  total_routes: number;
  assigned_employees: number;
  unassigned_employees: number;
}

export interface RouteUtilization {
  route: string;
  capacity: number;
  assigned: number;
  utilization: number;
}

export interface EmployeeTrend {
  date: string;
  wfo: number;
  wfh: number;
  leave: number;
}

export interface ShiftDistribution {
  name: string;
  value: number;
}

export interface RouteOccupancy {
  date: string;
  morning: number;
  afternoon: number;
  night: number;
}

export interface PickupSheet {
  route_number: string;
  employee_id: string;
  employee_name: string;
  pickup_location: string;
  pickup_order: number;
  shift: string;
  pickup_time: string;
}

export interface DropSheet {
  route_number: string;
  employee_id: string;
  employee_name: string;
  drop_location: string;
  shift: string;
  drop_time: string;
}

export interface UploadValidation {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface UploadResult {
  total: number;
  valid: number;
  invalid: number;
  errors: UploadValidation[];
}

export type ThemeMode = 'light' | 'dark';

export interface User {
  username: string;
  name: string;
  role: string;
  avatar?: string;
}
