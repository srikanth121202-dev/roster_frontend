import type { RouteUtilization, EmployeeTrend, ShiftDistribution, RouteOccupancy } from '../types';

export const mockRouteUtilization: RouteUtilization[] = [
  { route: 'RT001', capacity: 20, assigned: 15, utilization: 75 },
  { route: 'RT002', capacity: 15, assigned: 12, utilization: 80 },
  { route: 'RT003', capacity: 25, assigned: 20, utilization: 80 },
  { route: 'RT004', capacity: 15, assigned: 10, utilization: 67 },
  { route: 'RT005', capacity: 20, assigned: 18, utilization: 90 },
  { route: 'RT006', capacity: 12, assigned: 8,  utilization: 67 },
];

export const mockEmployeeTrend: EmployeeTrend[] = [
  { date: 'Mon', wfo: 180, wfh: 45, leave: 23 },
  { date: 'Tue', wfo: 195, wfh: 38, leave: 15 },
  { date: 'Wed', wfo: 186, wfh: 42, leave: 20 },
  { date: 'Thu', wfo: 210, wfh: 30, leave: 8  },
  { date: 'Fri', wfo: 175, wfh: 55, leave: 18 },
  { date: 'Sat', wfo: 90,  wfh: 80, leave: 78 },
];

export const mockShiftDistribution: ShiftDistribution[] = [
  { name: 'Morning',   value: 98 },
  { name: 'Afternoon', value: 72 },
  { name: 'Night',     value: 16 },
];

export const mockRouteOccupancy: RouteOccupancy[] = [
  { date: 'Mon', morning: 85, afternoon: 72, night: 60 },
  { date: 'Tue', morning: 90, afternoon: 78, night: 55 },
  { date: 'Wed', morning: 88, afternoon: 82, night: 65 },
  { date: 'Thu', morning: 92, afternoon: 75, night: 70 },
  { date: 'Fri', morning: 82, afternoon: 68, night: 58 },
  { date: 'Sat', morning: 45, afternoon: 40, night: 30 },
];
