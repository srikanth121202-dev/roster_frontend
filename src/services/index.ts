import { supabase } from '../lib/supabase';
import type {
  Employee, Route, Vendor, DriverSubmission, RosterRecord, RosterDashboardStats, RosterTrendPoint, RosterAuditEntry,
  DashboardStats, RouteUtilization, EmployeeTrend, ShiftDistribution,
  RouteOccupancy, PickupSheet, DropSheet,
} from '../types';

function mapRosterRow(row: Record<string, unknown>): RosterRecord {
  return {
    id: row.id as string,
    employee_id: row.employee_id as string,
    employee_name: (row.employee_name as string) ?? '',
    date: row.date as string,
    status: (row.status as RosterRecord['status']) ?? 'WFO',
    shift: (row.shift as string) ?? 'Morning',
    team: (row.team as string) ?? '',
    tower: (row.tower as string) ?? '',
    cab_used: (row.cab_used as boolean) ?? false,
    pickup_required: (row.pickup_required as boolean) ?? false,
    drop_required: (row.drop_required as boolean) ?? false,
    transport_required: (row.transport_required as boolean) ?? false,
    gender: (row.gender as string) ?? '',
    manager_name: (row.manager_name as string) ?? '',
    remarks: (row.remarks as string) ?? '',
    approval_status: (row.approval_status as RosterRecord['approval_status']) ?? 'Draft',
  };
}

// ─────────────────────────────────────────
// EMPLOYEE SERVICE
// ─────────────────────────────────────────
export const employeeService = {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('employee_id');
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      employee_id: row.employee_id,
      name: row.name,
      team: row.team,
      tower: row.tower,
      location: row.location,
      shift: row.shift as Employee['shift'],
      status: row.status as Employee['status'],
      address: row.address,
      lat: row.lat,
      lng: row.lng,
    }));
  },

  async create(emp: Omit<Employee, 'id'>): Promise<Employee> {
    const { data, error } = await supabase
      .from('employees')
      .insert({
        employee_id: emp.employee_id,
        name: emp.name,
        team: emp.team,
        tower: emp.tower,
        location: emp.location,
        shift: emp.shift,
        status: emp.status,
        address: emp.address,
        lat: emp.lat,
        lng: emp.lng,
      })
      .select()
      .single();
    if (error) throw error;
    return { ...emp, id: data.id };
  },

  async update(id: string, emp: Partial<Employee>): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .update({
        employee_id: emp.employee_id,
        name: emp.name,
        team: emp.team,
        tower: emp.tower,
        location: emp.location,
        shift: emp.shift,
        status: emp.status,
        address: emp.address,
        lat: emp.lat,
        lng: emp.lng,
      })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },

  async bulkUpsert(employees: Omit<Employee, 'id'>[]): Promise<{ count: number }> {
    const { error, count } = await supabase
      .from('employees')
      .upsert(
        employees.map(e => ({
          employee_id: e.employee_id,
          name: e.name,
          team: e.team,
          tower: e.tower,
          location: e.location,
          shift: e.shift,
          status: e.status,
          address: e.address,
          lat: e.lat,
          lng: e.lng,
        })),
        { onConflict: 'employee_id' }
      );
    if (error) throw error;
    return { count: count ?? employees.length };
  },
};

// ─────────────────────────────────────────
// ROUTE SERVICE
// ─────────────────────────────────────────
export const routeService = {
  async getAll(): Promise<Route[]> {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('route_number');
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      route_number: row.route_number,
      route_name: row.route_name,
      vehicle_capacity: row.vehicle_capacity,
      vehicle_type: row.vehicle_type,
      status: row.status as Route['status'],
      shift: row.shift,
      assigned_employees: row.assigned_employees,
      vendor_id: row.vendor_id ?? null,
      vendor_name: row.vendor_name ?? '',
    }));
  },

  async create(route: Omit<Route, 'id' | 'assigned_employees'>): Promise<Route> {
    const { data, error } = await supabase
      .from('routes')
      .insert({
        route_number: route.route_number,
        route_name: route.route_name,
        vehicle_capacity: route.vehicle_capacity,
        vehicle_type: route.vehicle_type,
        status: route.status,
        shift: route.shift,
        assigned_employees: 0,
        vendor_id: route.vendor_id ?? null,
        vendor_name: route.vendor_name ?? '',
      })
      .select()
      .single();
    if (error) throw error;
    return { ...route, id: data.id, assigned_employees: 0 };
  },

  async update(id: string, route: Partial<Route>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (route.route_number !== undefined) payload.route_number = route.route_number;
    if (route.route_name !== undefined) payload.route_name = route.route_name;
    if (route.vehicle_capacity !== undefined) payload.vehicle_capacity = route.vehicle_capacity;
    if (route.vehicle_type !== undefined) payload.vehicle_type = route.vehicle_type;
    if (route.status !== undefined) payload.status = route.status;
    if (route.shift !== undefined) payload.shift = route.shift;
    if (route.vendor_id !== undefined) payload.vendor_id = route.vendor_id;
    if (route.vendor_name !== undefined) payload.vendor_name = route.vendor_name;
    const { error } = await supabase.from('routes').update(payload).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw error;
  },

  // Auto-creates missing routes for a shift so generate can always proceed.
  async getOrCreateForShift(
    shift: string,
    count: number,
    vehicleCapacity: number,
    vehicleType: string,
  ): Promise<Route[]> {
    const { data: existing } = await supabase
      .from('routes')
      .select('*')
      .eq('status', 'Active')
      .eq('shift', shift)
      .order('route_number');

    const existingRoutes = ((existing ?? []).map(row => ({
      id: row.id as string,
      route_number: row.route_number as string,
      route_name: row.route_name as string,
      vehicle_capacity: row.vehicle_capacity as number,
      vehicle_type: row.vehicle_type as string,
      status: row.status as Route['status'],
      shift: row.shift as string,
      assigned_employees: row.assigned_employees as number,
    }))) as Route[];

    if (existingRoutes.length >= count) return existingRoutes.slice(0, count);

    const prefix = ({ Morning: 'MOR', Afternoon: 'AFT', Night: 'NGT' } as Record<string, string>)[shift] ?? 'GEN';
    const created: Route[] = [...existingRoutes];

    for (let i = existingRoutes.length; i < count; i++) {
      const n = i + 1;
      const routeNumber = `${prefix}-${String(n).padStart(3, '0')}`;
      const { data: newRoute, error } = await supabase
        .from('routes')
        .upsert({
          route_number: routeNumber,
          route_name: `${shift} Route ${n}`,
          shift,
          vehicle_capacity: vehicleCapacity,
          vehicle_type: vehicleType,
          status: 'Active',
          assigned_employees: 0,
        }, { onConflict: 'route_number' })
        .select()
        .single();
      if (error) throw error;
      if (newRoute) created.push({
        id: newRoute.id, route_number: newRoute.route_number, route_name: newRoute.route_name,
        vehicle_capacity: newRoute.vehicle_capacity, vehicle_type: newRoute.vehicle_type,
        status: newRoute.status, shift: newRoute.shift, assigned_employees: 0,
      });
    }
    return created;
  },
};

// ─────────────────────────────────────────
// ROSTER SERVICE
// ─────────────────────────────────────────
export const rosterService = {
  async getAll(): Promise<RosterRecord[]> {
    const { data, error } = await supabase
      .from('roster_records')
      .select('*')
      .order('date', { ascending: false })
      .order('employee_id');
    if (error) throw error;
    return (data ?? []).map(mapRosterRow);
  },

  async getByDate(date: string): Promise<RosterRecord[]> {
    const { data, error } = await supabase
      .from('roster_records')
      .select('*')
      .eq('date', date)
      .order('employee_id');
    if (error) throw error;
    return (data ?? []).map(mapRosterRow);
  },

  async getByDateRange(start: string, end: string): Promise<RosterRecord[]> {
    const { data, error } = await supabase
      .from('roster_records')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .order('employee_id');
    if (error) throw error;
    return (data ?? []).map(mapRosterRow);
  },

  async update(
    employeeId: string,
    date: string,
    changes: Partial<RosterRecord>,
    updatedBy = 'admin'
  ): Promise<void> {
    const { data: current } = await supabase
      .from('roster_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();

    if (current) {
      const auditEntries = Object.entries(changes)
        .filter(([key]) => key !== 'id' && key !== 'uploaded_at')
        .filter(([key, val]) => String(current[key] ?? '') !== String(val ?? ''))
        .map(([key, val]) => ({
          employee_id: employeeId,
          work_date: date,
          field_changed: key,
          old_value: String(current[key] ?? ''),
          new_value: String(val ?? ''),
          updated_by: updatedBy,
        }));
      if (auditEntries.length > 0)
        await supabase.from('roster_audit_log').insert(auditEntries);
    }

    const { error } = await supabase
      .from('roster_records')
      .update({ ...changes, uploaded_at: new Date().toISOString() })
      .eq('employee_id', employeeId)
      .eq('date', date);
    if (error) throw error;
  },

  async getDashboardStats(date: string): Promise<RosterDashboardStats> {
    const { data, error } = await supabase
      .from('roster_records')
      .select('*')
      .eq('date', date);
    if (error) throw error;
    const rows = data ?? [];
    const cnt = (s: string) => rows.filter(r => r.status === s).length;

    const teamMap: Record<string, number> = {};
    const towerMap: Record<string, number> = {};
    const shiftMap: Record<string, number> = {};
    for (const r of rows) {
      if (r.team) teamMap[r.team] = (teamMap[r.team] ?? 0) + 1;
      if (r.tower) towerMap[r.tower] = (towerMap[r.tower] ?? 0) + 1;
      if (r.shift) shiftMap[r.shift] = (shiftMap[r.shift] ?? 0) + 1;
    }

    const wfo = cnt('WFO'), wfh = cnt('WFH'), leave = cnt('Leave'),
          holiday = cnt('Holiday'), weekOff = cnt('WeekOff');
    const other = rows.length - wfo - wfh - leave - holiday - weekOff;

    return {
      total: rows.length, wfo, wfh, leave, holiday, weekOff, other,
      transport_required: rows.filter(r => r.transport_required).length,
      by_team: Object.entries(teamMap).map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      by_tower: Object.entries(towerMap).map(([tower, count]) => ({ tower, count })).sort((a, b) => b.count - a.count),
      by_shift: Object.entries(shiftMap).map(([shift, count]) => ({ shift, count })),
      by_status: [
        { name: 'WFO', value: wfo }, { name: 'WFH', value: wfh },
        { name: 'Leave', value: leave }, { name: 'Holiday', value: holiday },
        { name: 'WeekOff', value: weekOff }, { name: 'Other', value: other },
      ].filter(s => s.value > 0),
    };
  },

  async getWeeklyTrend(): Promise<RosterTrendPoint[]> {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    const { data } = await supabase
      .from('roster_records')
      .select('date, status')
      .in('date', days);

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(day => {
      const rs = (data ?? []).filter(r => r.date === day);
      return {
        date: labels[new Date(day + 'T12:00:00').getDay()],
        wfo: rs.filter(r => r.status === 'WFO').length,
        wfh: rs.filter(r => r.status === 'WFH').length,
        leave: rs.filter(r => r.status === 'Leave').length,
        other: rs.filter(r => !['WFO', 'WFH', 'Leave'].includes(r.status)).length,
      };
    });
  },

  async getAuditLog(employeeId: string, date: string): Promise<RosterAuditEntry[]> {
    const { data, error } = await supabase
      .from('roster_audit_log')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('work_date', date)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as RosterAuditEntry[];
  },

  async bulkUpsert(records: RosterRecord[]): Promise<{ count: number }> {
    const { error, count } = await supabase
      .from('roster_records')
      .upsert(
        records.map(r => ({
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          date: r.date,
          status: r.status,
          shift: r.shift,
          team: r.team ?? '',
          tower: r.tower ?? '',
          cab_used: r.cab_used ?? false,
          pickup_required: r.pickup_required ?? (r.status === 'WFO'),
          drop_required: r.drop_required ?? (r.status === 'WFO'),
          transport_required: r.status === 'WFO',
          gender: r.gender ?? '',
          manager_name: r.manager_name ?? '',
          remarks: r.remarks ?? '',
          approval_status: r.approval_status ?? 'Draft',
          uploaded_at: new Date().toISOString(),
        })),
        { onConflict: 'employee_id,date' }
      );
    if (error) throw error;
    // Sync employee statuses for today
    const today = records[0]?.date;
    if (today === new Date().toISOString().split('T')[0]) {
      const empStatuses: Record<string, RosterRecord['status']> = {
        WFO: 'WFO', WFH: 'WFH', Leave: 'Leave',
      };
      for (const r of records) {
        const empStatus = empStatuses[r.status] ?? 'WFO';
        await supabase
          .from('employees')
          .update({ status: empStatus, shift: r.shift })
          .eq('employee_id', r.employee_id);
      }
    }
    return { count: count ?? records.length };
  },

  async finalizeDate(date: string): Promise<void> {
    const { error } = await supabase
      .from('roster_records')
      .update({ approval_status: 'Approved' })
      .eq('date', date)
      .eq('status', 'WFO');
    if (error) throw error;
  },
};

// ─────────────────────────────────────────
// VENDOR SERVICE
// ─────────────────────────────────────────
export const vendorService = {
  async getAll(): Promise<Vendor[]> {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .order('company_name');
    if (error) throw error;
    return (data ?? []) as Vendor[];
  },

  async getByUserId(userId: string): Promise<Vendor | null> {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data as Vendor | null;
  },
};

// ─────────────────────────────────────────
// ROUTE ASSIGNMENT SERVICE
// ─────────────────────────────────────────
export const assignmentService = {
  async getByVendorAndDate(vendorId: string, date: string) {
    // Get route numbers assigned to this vendor
    const { data: vendorRoutes, error: rErr } = await supabase
      .from('routes')
      .select('route_number, route_name, shift, vehicle_capacity, vehicle_type')
      .eq('vendor_id', vendorId);
    if (rErr) throw rErr;
    if (!vendorRoutes?.length) return { routes: [], assignments: [] };

    const routeNumbers = vendorRoutes.map(r => r.route_number);

    const { data: assignments, error: aErr } = await supabase
      .from('route_assignments')
      .select('*')
      .eq('date', date)
      .in('route_number', routeNumbers)
      .order('route_number')
      .order('pickup_order');
    if (aErr) throw aErr;

    const rows = assignments ?? [];

    // Enrich with employee contact details
    if (rows.length > 0) {
      const empIds = [...new Set(rows.map(a => a.employee_id))];
      const { data: employees } = await supabase
        .from('employees')
        .select('employee_id, phone, gender, team, tower, location, address')
        .in('employee_id', empIds);
      const empMap = Object.fromEntries((employees ?? []).map(e => [e.employee_id, e]));
      rows.forEach(a => {
        const e = empMap[a.employee_id];
        if (e) {
          a.employee_phone = e.phone ?? '';
          a.employee_gender = e.gender ?? '';
          a.employee_team = e.team ?? '';
          a.employee_tower = e.tower ?? '';
          a.employee_location = e.location ?? '';
          a.employee_address = e.address ?? '';
        }
      });
    }

    return {
      routes: vendorRoutes as Array<{ route_number: string; route_name: string; shift: string; vehicle_capacity: number; vehicle_type: string }>,
      assignments: rows,
    };
  },

  async getByDate(date: string, shift?: string, routeNumber?: string) {
    let query = supabase
      .from('route_assignments')
      .select('*')
      .eq('date', date)
      .order('route_number')
      .order('pickup_order');

    if (shift && shift !== 'All') query = query.eq('shift', shift);
    if (routeNumber && routeNumber !== 'All') query = query.eq('route_number', routeNumber);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getByDateRange(start: string, end: string) {
    const { data, error } = await supabase
      .from('route_assignments')
      .select('employee_id, employee_name, route_number, pickup_order, pickup_location, date, shift, pickup_time, drop_time')
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .order('route_number')
      .order('pickup_order');
    if (error) throw error;
    return data ?? [];
  },

  async getByRoute(routeNumber: string, date: string) {
    const { data: assignments, error } = await supabase
      .from('route_assignments')
      .select('*')
      .eq('route_number', routeNumber)
      .eq('date', date)
      .order('pickup_order');
    if (error) throw error;
    if (!assignments?.length) return [];

    const empIds = [...new Set(assignments.map(a => a.employee_id))];
    const { data: employees } = await supabase
      .from('employees')
      .select('employee_id, lat, lng, address, team, tower')
      .in('employee_id', empIds);

    const empMap = Object.fromEntries((employees ?? []).map(e => [e.employee_id, e]));

    return assignments.map(a => ({
      id: a.id as string,
      pickup_order: a.pickup_order as number,
      employee_id: a.employee_id as string,
      employee_name: a.employee_name as string,
      pickup_location: (a.pickup_location as string) ?? '',
      drop_location: (a.drop_location as string) ?? '',
      address: empMap[a.employee_id]?.address ?? (a.pickup_location as string) ?? '',
      team: empMap[a.employee_id]?.team ?? '',
      tower: empMap[a.employee_id]?.tower ?? '',
      shift: a.shift as string,
      pickup_time: (a.pickup_time as string) ?? '',
      drop_time: (a.drop_time as string) ?? '',
      lat: (empMap[a.employee_id]?.lat as number) ?? 0,
      lng: (empMap[a.employee_id]?.lng as number) ?? 0,
    }));
  },

  async generate(date: string): Promise<number> {
    // Read vehicle capacity from settings
    const { data: settingsRows } = await supabase.from('settings').select('key, value');
    const cfg = Object.fromEntries((settingsRows ?? []).map(s => [s.key, s.value]));
    const vehicleCapacity = Math.max(1, parseInt(cfg.vehicle_capacity ?? '6', 10) || 6);
    const vehicleType = cfg.default_vehicle_type ?? 'Bus';

    // 1. WFO employees from roster
    const { data: rosterRows } = await supabase
      .from('roster_records')
      .select('employee_id, employee_name, shift, tower, team')
      .eq('date', date)
      .eq('status', 'WFO');

    if (!rosterRows || rosterRows.length === 0)
      throw new Error(`No WFO employees found in roster for ${date}. Upload a roster file with at least one employee marked as WFO.`);

    // 2. Enrich with employees table for location data (best-effort)
    const empIds = rosterRows.map(r => r.employee_id);
    const { data: empDetails } = await supabase
      .from('employees')
      .select('employee_id, location, shift')
      .in('employee_id', empIds);
    const empMap = Object.fromEntries((empDetails ?? []).map(e => [e.employee_id, e]));

    // 3. Group by shift
    const shiftGroups: Record<string, Array<{ employee_id: string; name: string; location: string }>> = {};
    for (const r of rosterRows) {
      const shift = r.shift ?? empMap[r.employee_id]?.shift ?? 'Morning';
      if (!shiftGroups[shift]) shiftGroups[shift] = [];
      shiftGroups[shift].push({
        employee_id: r.employee_id,
        name: r.employee_name ?? r.employee_id,
        location: empMap[r.employee_id]?.location ?? r.tower ?? r.team ?? '',
      });
    }

    // 4. Delete existing assignments for this date (ensures capacity is never exceeded
    //    by stale records from a previous generation run)
    const { error: delErr } = await supabase.from('route_assignments').delete().eq('date', date);
    if (delErr) throw delErr;

    // 5. Assign using capacity-based chunks (never exceeds vehicleCapacity per route)
    const allAssignments: Record<string, unknown>[] = [];
    for (const [shift, shiftEmps] of Object.entries(shiftGroups)) {
      const needed = Math.ceil(shiftEmps.length / vehicleCapacity);
      const routes = await routeService.getOrCreateForShift(shift, needed, vehicleCapacity, vehicleType);

      const chunks: typeof shiftEmps[] = [];
      for (let i = 0; i < shiftEmps.length; i += vehicleCapacity) chunks.push(shiftEmps.slice(i, i + vehicleCapacity));

      for (let i = 0; i < chunks.length; i++) {
        const route = routes[i];
        chunks[i].forEach((emp, j) => {
          allAssignments.push({
            employee_id: emp.employee_id,
            employee_name: emp.name,
            route_number: route.route_number,
            pickup_order: j + 1,
            pickup_location: emp.location,
            drop_location: emp.location,
            date,
            shift,
            pickup_time: shift === 'Morning' ? '07:30 AM' : shift === 'Afternoon' ? '01:30 PM' : '09:30 PM',
            drop_time:   shift === 'Morning' ? '09:30 PM' : shift === 'Afternoon' ? '10:30 PM' : '06:30 AM',
          });
        });
      }
    }

    if (allAssignments.length === 0)
      throw new Error('No assignments could be built. Ensure WFO employees exist in the roster and active routes are configured.');

    const { error } = await supabase.from('route_assignments').insert(allAssignments);
    if (error) throw error;

    // 6. Update assigned_employee counts per route
    const routeCounts: Record<string, number> = {};
    for (const a of allAssignments) routeCounts[a.route_number as string] = (routeCounts[a.route_number as string] ?? 0) + 1;
    await Promise.all(
      Object.entries(routeCounts).map(([rn, cnt]) =>
        supabase.from('routes').update({ assigned_employees: cnt }).eq('route_number', rn)
      )
    );

    return allAssignments.length;
  },
};

// ─────────────────────────────────────────
// SHEET SERVICE  (derives from assignments)
// ─────────────────────────────────────────
export const sheetService = {
  async getPickupSheets(date?: string): Promise<PickupSheet[]> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('route_assignments')
      .select('*')
      .eq('date', d)
      .order('route_number')
      .order('pickup_order');
    if (error) throw error;
    return (data ?? []).map(row => ({
      route_number: row.route_number,
      employee_id: row.employee_id,
      employee_name: row.employee_name,
      pickup_location: row.pickup_location,
      pickup_order: row.pickup_order,
      shift: row.shift,
      pickup_time: row.pickup_time,
    }));
  },

  async getDropSheets(date?: string): Promise<DropSheet[]> {
    const d = date ?? new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('route_assignments')
      .select('*')
      .eq('date', d)
      .order('route_number')
      .order('employee_id');
    if (error) throw error;
    return (data ?? []).map(row => ({
      route_number: row.route_number,
      employee_id: row.employee_id,
      employee_name: row.employee_name,
      drop_location: row.drop_location,
      shift: row.shift,
      drop_time: row.drop_time,
    }));
  },
};

// ─────────────────────────────────────────
// DASHBOARD SERVICE  (computed from live data)
// ─────────────────────────────────────────
export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const today = new Date().toISOString().split('T')[0];
    const [empRes, routeRes, rosterRes, assignRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('routes').select('id', { count: 'exact', head: true }),
      supabase.from('roster_records').select('status').eq('date', today),
      supabase.from('route_assignments').select('employee_id', { count: 'exact', head: true }).eq('date', today),
    ]);

    const total_employees = empRes.count ?? 0;
    const total_routes = routeRes.count ?? 0;
    const rosterToday = rosterRes.data ?? [];
    const wfo_today = rosterToday.filter(r => r.status === 'WFO').length ||
      ((await supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'WFO')).count ?? 0);
    const wfh_today = rosterToday.filter(r => r.status === 'WFH').length ||
      ((await supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'WFH')).count ?? 0);
    const assigned_employees = assignRes.count ?? 0;
    const unassigned_employees = Math.max(0, wfo_today - assigned_employees);

    return { total_employees, wfo_today, wfh_today, total_routes, assigned_employees, unassigned_employees };
  },

  async getRouteUtilization(): Promise<RouteUtilization[]> {
    const { data, error } = await supabase
      .from('routes')
      .select('route_number, vehicle_capacity, assigned_employees')
      .order('route_number');
    if (error) throw error;
    return (data ?? []).map(r => ({
      route: r.route_number,
      capacity: r.vehicle_capacity,
      assigned: r.assigned_employees,
      utilization: r.vehicle_capacity > 0
        ? Math.round((r.assigned_employees / r.vehicle_capacity) * 100)
        : 0,
    }));
  },

  async getEmployeeTrend(): Promise<EmployeeTrend[]> {
    // Last 6 days of roster data
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (5 - i));
      return d.toISOString().split('T')[0];
    });

    const { data } = await supabase
      .from('roster_records')
      .select('date, status')
      .in('date', days);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((day, i) => {
      const rows = (data ?? []).filter(r => r.date === day);
      return {
        date: labels[new Date(day).getDay()] ?? labels[i],
        wfo: rows.filter(r => r.status === 'WFO').length,
        wfh: rows.filter(r => r.status === 'WFH').length,
        leave: rows.filter(r => r.status === 'Leave').length,
      };
    });
  },

  async getShiftDistribution(): Promise<ShiftDistribution[]> {
    const { data } = await supabase
      .from('employees')
      .select('shift')
      .eq('status', 'WFO');
    const counts: Record<string, number> = { Morning: 0, Afternoon: 0, Night: 0 };
    for (const row of data ?? []) {
      if (counts[row.shift] !== undefined) counts[row.shift]++;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  },

  async getRouteOccupancy(): Promise<RouteOccupancy[]> {
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (5 - i));
      return d.toISOString().split('T')[0];
    });

    const { data } = await supabase
      .from('route_assignments')
      .select('date, shift')
      .in('date', days);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((day, i) => {
      const rows = (data ?? []).filter(r => r.date === day);
      return {
        date: labels[new Date(day).getDay()] ?? labels[i],
        morning: rows.filter(r => r.shift === 'Morning').length,
        afternoon: rows.filter(r => r.shift === 'Afternoon').length,
        night: rows.filter(r => r.shift === 'Night').length,
      };
    });
  },
};

// ─────────────────────────────────────────
// DRIVER SUBMISSION SERVICE
// ─────────────────────────────────────────
export const driverService = {
  async getByVendorAndDate(vendorId: string, date: string): Promise<DriverSubmission[]> {
    const { data, error } = await supabase
      .from('driver_submissions')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('date', date);
    if (error) throw error;
    return (data ?? []) as DriverSubmission[];
  },

  async upsert(submission: Omit<DriverSubmission, 'id' | 'submitted_at'>): Promise<void> {
    const { error } = await supabase
      .from('driver_submissions')
      .upsert(
        { ...submission, submitted_at: new Date().toISOString() },
        { onConflict: 'vendor_id,route_number,date' }
      );
    if (error) throw error;
  },
};

// ─────────────────────────────────────────
// SETTINGS SERVICE
// ─────────────────────────────────────────
export const settingsService = {
  async getAll(): Promise<Record<string, string>> {
    const { data, error } = await supabase.from('app_settings').select('key, value');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  },

  async set(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  },

  async setMany(settings: Record<string, string>): Promise<void> {
    const rows = Object.entries(settings).map(([key, value]) => ({
      key, value, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' });
    if (error) throw error;
  },
};

// ─────────────────────────────────────────
// MOCK CHART DATA  (kept for trend charts that
// need historical data not yet in DB)
// ─────────────────────────────────────────
export { mockRouteUtilization, mockEmployeeTrend, mockShiftDistribution, mockRouteOccupancy } from './mockChartData';
