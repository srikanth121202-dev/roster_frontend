import type { Employee, Route, RosterRecord, DashboardStats, RouteUtilization, EmployeeTrend, ShiftDistribution, RouteOccupancy, PickupSheet, DropSheet } from '../types';

export const mockEmployees: Employee[] = [
  { id: '1', employee_id: 'EMP001', name: 'Arjun Sharma', team: 'Engineering', tower: 'Tower A', location: 'Gachibowli', shift: 'Morning', status: 'WFO', address: 'Gachibowli, Hyderabad', lat: 17.4401, lng: 78.3489 },
  { id: '2', employee_id: 'EMP002', name: 'Priya Reddy', team: 'Design', tower: 'Tower B', location: 'Kondapur', shift: 'Afternoon', status: 'WFO', address: 'Kondapur, Hyderabad', lat: 17.4600, lng: 78.3600 },
  { id: '3', employee_id: 'EMP003', name: 'Rahul Kumar', team: 'Product', tower: 'Tower A', location: 'Manikonda', shift: 'Morning', status: 'WFH', address: 'Manikonda, Hyderabad', lat: 17.4000, lng: 78.3800 },
  { id: '4', employee_id: 'EMP004', name: 'Sneha Patel', team: 'Engineering', tower: 'Tower C', location: 'Narsingi', shift: 'Night', status: 'WFO', address: 'Narsingi, Hyderabad', lat: 17.3900, lng: 78.3400 },
  { id: '5', employee_id: 'EMP005', name: 'Vikram Singh', team: 'QA', tower: 'Tower B', location: 'Kokapet', shift: 'Morning', status: 'WFO', address: 'Kokapet, Hyderabad', lat: 17.4100, lng: 78.3300 },
  { id: '6', employee_id: 'EMP006', name: 'Divya Nair', team: 'HR', tower: 'Tower A', location: 'Nanakramguda', shift: 'Afternoon', status: 'Leave', address: 'Nanakramguda, Hyderabad', lat: 17.4200, lng: 78.3500 },
  { id: '7', employee_id: 'EMP007', name: 'Aditya Verma', team: 'Engineering', tower: 'Tower C', location: 'Miyapur', shift: 'Morning', status: 'WFO', address: 'Miyapur, Hyderabad', lat: 17.4950, lng: 78.3500 },
  { id: '8', employee_id: 'EMP008', name: 'Kavya Iyer', team: 'Finance', tower: 'Tower B', location: 'Kukatpally', shift: 'Afternoon', status: 'WFO', address: 'Kukatpally, Hyderabad', lat: 17.4849, lng: 78.4138 },
  { id: '9', employee_id: 'EMP009', name: 'Suresh Rao', team: 'Operations', tower: 'Tower A', location: 'Madhapur', shift: 'Night', status: 'WFO', address: 'Madhapur, Hyderabad', lat: 17.4490, lng: 78.3760 },
  { id: '10', employee_id: 'EMP010', name: 'Meena Krishnan', team: 'Engineering', tower: 'Tower C', location: 'HITEC City', shift: 'Morning', status: 'WFH', address: 'HITEC City, Hyderabad', lat: 17.4435, lng: 78.3772 },
  { id: '11', employee_id: 'EMP011', name: 'Kiran Babu', team: 'Design', tower: 'Tower B', location: 'Jubilee Hills', shift: 'Afternoon', status: 'WFO', address: 'Jubilee Hills, Hyderabad', lat: 17.4319, lng: 78.4053 },
  { id: '12', employee_id: 'EMP012', name: 'Ananya Gupta', team: 'Product', tower: 'Tower A', location: 'Banjara Hills', shift: 'Morning', status: 'WFO', address: 'Banjara Hills, Hyderabad', lat: 17.4126, lng: 78.4371 },
  { id: '13', employee_id: 'EMP013', name: 'Rohit Mishra', team: 'Engineering', tower: 'Tower C', location: 'Ameerpet', shift: 'Night', status: 'WFO', address: 'Ameerpet, Hyderabad', lat: 17.4375, lng: 78.4483 },
  { id: '14', employee_id: 'EMP014', name: 'Pooja Joshi', team: 'QA', tower: 'Tower B', location: 'SR Nagar', shift: 'Morning', status: 'Leave', address: 'SR Nagar, Hyderabad', lat: 17.4500, lng: 78.4400 },
  { id: '15', employee_id: 'EMP015', name: 'Naveen Reddy', team: 'Operations', tower: 'Tower A', location: 'Punjagutta', shift: 'Afternoon', status: 'WFO', address: 'Punjagutta, Hyderabad', lat: 17.4260, lng: 78.4502 },
];

export const mockRoutes: Route[] = [
  { id: '1', route_number: 'RT001', route_name: 'Gachibowli Route', vehicle_capacity: 20, vehicle_type: 'Bus', assigned_employees: 15, status: 'Active', shift: 'Morning' },
  { id: '2', route_number: 'RT002', route_name: 'Kondapur Route', vehicle_capacity: 15, vehicle_type: 'Van', assigned_employees: 12, status: 'Active', shift: 'Afternoon' },
  { id: '3', route_number: 'RT003', route_name: 'Miyapur Route', vehicle_capacity: 25, vehicle_type: 'Bus', assigned_employees: 20, status: 'Active', shift: 'Morning' },
  { id: '4', route_number: 'RT004', route_name: 'Kukatpally Route', vehicle_capacity: 15, vehicle_type: 'Van', assigned_employees: 10, status: 'Active', shift: 'Night' },
  { id: '5', route_number: 'RT005', route_name: 'Madhapur Route', vehicle_capacity: 20, vehicle_type: 'Bus', assigned_employees: 18, status: 'Active', shift: 'Morning' },
  { id: '6', route_number: 'RT006', route_name: 'Banjara Hills Route', vehicle_capacity: 12, vehicle_type: 'Van', assigned_employees: 8, status: 'Inactive', shift: 'Afternoon' },
];

export const mockDashboardStats: DashboardStats = {
  total_employees: 248,
  wfo_today: 186,
  wfh_today: 42,
  total_routes: 12,
  assigned_employees: 172,
  unassigned_employees: 14,
};

export const mockRouteUtilization: RouteUtilization[] = [
  { route: 'RT001', capacity: 20, assigned: 15, utilization: 75 },
  { route: 'RT002', capacity: 15, assigned: 12, utilization: 80 },
  { route: 'RT003', capacity: 25, assigned: 20, utilization: 80 },
  { route: 'RT004', capacity: 15, assigned: 10, utilization: 67 },
  { route: 'RT005', capacity: 20, assigned: 18, utilization: 90 },
  { route: 'RT006', capacity: 12, assigned: 8, utilization: 67 },
];

export const mockEmployeeTrend: EmployeeTrend[] = [
  { date: 'Mon', wfo: 180, wfh: 45, leave: 23 },
  { date: 'Tue', wfo: 195, wfh: 38, leave: 15 },
  { date: 'Wed', wfo: 186, wfh: 42, leave: 20 },
  { date: 'Thu', wfo: 210, wfh: 30, leave: 8 },
  { date: 'Fri', wfo: 175, wfh: 55, leave: 18 },
  { date: 'Sat', wfo: 90, wfh: 80, leave: 78 },
];

export const mockShiftDistribution: ShiftDistribution[] = [
  { name: 'Morning', value: 98 },
  { name: 'Afternoon', value: 72 },
  { name: 'Night', value: 16 },
];

export const mockRouteOccupancy: RouteOccupancy[] = [
  { date: 'Mon', morning: 85, afternoon: 72, night: 60 },
  { date: 'Tue', morning: 90, afternoon: 78, night: 55 },
  { date: 'Wed', morning: 88, afternoon: 82, night: 65 },
  { date: 'Thu', morning: 92, afternoon: 75, night: 70 },
  { date: 'Fri', morning: 82, afternoon: 68, night: 58 },
  { date: 'Sat', morning: 45, afternoon: 40, night: 30 },
];

export const mockPickupSheets: PickupSheet[] = mockEmployees
  .filter(e => e.status === 'WFO')
  .map((e, i) => ({
    route_number: `RT00${(i % 5) + 1}`,
    employee_id: e.employee_id,
    employee_name: e.name,
    pickup_location: e.location,
    pickup_order: (i % 8) + 1,
    shift: e.shift,
    pickup_time: e.shift === 'Morning' ? '07:30 AM' : e.shift === 'Afternoon' ? '01:30 PM' : '09:30 PM',
  }));

export const mockDropSheets: DropSheet[] = mockEmployees
  .filter(e => e.status === 'WFO')
  .map((e, i) => ({
    route_number: `RT00${(i % 5) + 1}`,
    employee_id: e.employee_id,
    employee_name: e.name,
    drop_location: e.location,
    shift: e.shift,
    drop_time: e.shift === 'Morning' ? '09:30 PM' : e.shift === 'Afternoon' ? '10:30 PM' : '06:30 AM',
  }));

export const mockRosterRecords: RosterRecord[] = mockEmployees.map(e => ({
  employee_id: e.employee_id,
  employee_name: e.name,
  date: new Date().toISOString().split('T')[0],
  status: e.status,
  shift: e.shift,
}));

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const dashboardService = {
  getStats: async () => { await delay(300); return mockDashboardStats; },
  getRouteUtilization: async () => { await delay(200); return mockRouteUtilization; },
  getEmployeeTrend: async () => { await delay(200); return mockEmployeeTrend; },
  getShiftDistribution: async () => { await delay(200); return mockShiftDistribution; },
  getRouteOccupancy: async () => { await delay(200); return mockRouteOccupancy; },
};

export const employeeService = {
  getAll: async () => { await delay(400); return mockEmployees; },
  create: async (emp: Omit<Employee, 'id'>) => { await delay(300); return { ...emp, id: Date.now().toString() }; },
  update: async (id: string, emp: Partial<Employee>) => { await delay(300); return emp; },
  delete: async (id: string) => { await delay(300); return { success: true }; },
};

export const routeService = {
  getAll: async () => { await delay(300); return mockRoutes; },
  create: async (route: Omit<Route, 'id'>) => { await delay(300); return { ...route, id: Date.now().toString() }; },
  update: async (id: string, route: Partial<Route>) => { await delay(300); return route; },
  delete: async (id: string) => { await delay(300); return { success: true }; },
};

export const sheetService = {
  getPickupSheets: async () => { await delay(300); return mockPickupSheets; },
  getDropSheets: async () => { await delay(300); return mockDropSheets; },
};

export const rosterService = {
  getAll: async () => { await delay(300); return mockRosterRecords; },
};
