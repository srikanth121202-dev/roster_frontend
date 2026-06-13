import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bus, Users, RefreshCw, Download, Pencil, Check, X,
  Route, CheckCircle2, AlertCircle, Clock, ChevronRight,
  MapPin, Navigation, Sparkles, Info,
} from 'lucide-react';
import { rosterService, assignmentService, settingsService, routeService } from '../../services';
import { supabase } from '../../lib/supabase';
import { cn, getShiftColor } from '../../utils/helpers';
import { toast } from 'sonner';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';

type Tab = 'dashboard' | 'upload' | 'grid' | 'calendar' | 'transport';

interface Props {
  selectedDate: string;
  onNavigate: (tab: Tab) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function msToTimeStr(ms: number): string {
  const totalMin = Math.floor(((ms % 86400000) + 86400000) % 86400000 / 60000);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

function shiftArrivalMs(shift: string, settings: Record<string, string>): number {
  const key = shift === 'Morning' ? 'office_arrival_morning'
    : shift === 'Afternoon' ? 'office_arrival_afternoon'
    : 'office_arrival_night';
  const timeStr = settings[key] ?? (shift === 'Morning' ? '09:00' : shift === 'Afternoon' ? '14:00' : '21:00');
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60 + m) * 60000;
}

function defaultPickupTime(shift: string): string {
  return shift === 'Morning' ? '07:30 AM' : shift === 'Afternoon' ? '01:30 PM' : '09:30 PM';
}
function defaultDropTime(shift: string): string {
  return shift === 'Morning' ? '07:00 PM' : shift === 'Afternoon' ? '11:00 PM' : '07:00 AM';
}

// ── Google Maps directions call (returns ordered employees with computed times) ──

async function optimizeWithMaps(
  emps: Array<{ employee_id: string; name: string; lat: number; lng: number; location: string }>,
  officeLat: number, officeLng: number,
  shift: string, settings: Record<string, string>,
): Promise<Array<{ employee_id: string; name: string; lat: number; lng: number; location: string; pickup_order: number; pickup_time: string; drop_time: string }>> {
  // Google Maps allows max 23 waypoints with optimizeWaypoints
  if (emps.length > 23) throw new Error('Route has more than 23 employees — reduce vehicle capacity or split the route.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google?.maps;
  if (!g) throw new Error('Google Maps not loaded');

  const ds = new g.DirectionsService();
  const result = await new Promise<any>((resolve, reject) => {
    ds.route({
      origin: { lat: officeLat, lng: officeLng },
      destination: { lat: officeLat, lng: officeLng },
      waypoints: emps.map(e => ({ location: { lat: e.lat, lng: e.lng }, stopover: true })),
      optimizeWaypoints: true,
      travelMode: 'DRIVING',
    }, (res: any, status: string) => {
      if (status === 'OK' && res) resolve(res);
      else reject(new Error(`Google Maps Directions API: ${status}. Verify your API key has the Directions API enabled.`));
    });
  });

  const { waypoint_order, legs } = result.routes[0] as {
    waypoint_order: number[];
    legs: Array<{ duration: { value: number } }>;
  };

  // Work backwards from office arrival to compute per-stop pickup times
  const arrivalMs = shiftArrivalMs(shift, settings);
  const bufferMs  = parseInt(settings.pickup_buffer_min ?? '5', 10) * 60000;

  // legs[i] = stop[i-1] → stop[i] (legs[0] = office → first stop, last leg = last stop → office)
  let t = arrivalMs - legs[legs.length - 1].duration.value * 1000;
  const stopTimes: number[] = new Array(emps.length);
  stopTimes[waypoint_order.length - 1] = t;
  for (let i = waypoint_order.length - 2; i >= 0; i--) {
    t -= legs[i + 1].duration.value * 1000;
    stopTimes[i] = t;
  }

  // Drop time = shift end + 30 min travel from office (approximation)
  const dropBaseMs = arrivalMs + (shift === 'Night' ? -9 * 3600000 : 9 * 3600000);

  return waypoint_order.map((origIdx, routePos) => {
    const emp = emps[origIdx];
    return {
      ...emp,
      pickup_order: routePos + 1,
      pickup_time: msToTimeStr(stopTimes[routePos] - bufferMs),
      drop_time: msToTimeStr(dropBaseMs + (routePos * 5 * 60000)),
    };
  });
}

// ── WorkflowStep ─────────────────────────────────────────────────────────────

function WorkflowStep({ number, status, title, detail, action }: {
  number: number;
  status: 'done' | 'warn' | 'pending' | 'blocked';
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  const s = {
    done:    { ring: 'bg-success-500', text: 'text-success-700 dark:text-success-300', bg: 'bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800' },
    warn:    { ring: 'bg-warning-500', text: 'text-warning-700 dark:text-warning-300', bg: 'bg-warning-50 dark:bg-warning-900/10 border-warning-200 dark:border-warning-800' },
    pending: { ring: 'bg-primary-500', text: 'text-primary-700 dark:text-primary-300', bg: 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' },
    blocked: { ring: 'bg-error-500',   text: 'text-error-600 dark:text-error-400',     bg: 'bg-error-50 dark:bg-error-900/10 border-error-200 dark:border-error-800' },
  }[status];
  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-xl border', s.bg)}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0', s.ring)}>
        {status === 'done' ? <CheckCircle2 className="w-4 h-4" /> : number}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', s.text)}>{title}</p>
        <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5">{detail}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RosterTransportTab({ selectedDate, onNavigate }: Props) {
  const queryClient = useQueryClient();
  const { isLoaded: mapsLoaded } = useGoogleMaps();
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState('');

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
    staleTime: 60000,
  });
  const vehicleCapacity = Math.max(1, parseInt(settings.vehicle_capacity ?? '6', 10) || 6);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['roster', selectedDate],
    queryFn: () => rosterService.getByDate(selectedDate),
  });

  const { data: allRoutes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: routeService.getAll,
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: () => assignmentService.getByDate(selectedDate),
  });

  const saveCapacityMutation = useMutation({
    mutationFn: (val: string) => settingsService.set('vehicle_capacity', val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditingCapacity(false);
      toast.success('Vehicle capacity updated');
    },
    onError: () => toast.error('Failed to save capacity'),
  });

  // ── Core: Approve + Generate with Google Maps ──────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async () => {
      const officeLat = parseFloat(settings.office_lat ?? '17.4152');
      const officeLng = parseFloat(settings.office_lng ?? '78.3516');
      const vehicleType = settings.default_vehicle_type ?? 'Bus';

      // 1. Finalize (approve) the roster for this date
      await rosterService.finalizeDate(selectedDate);

      // 2. Get employee coordinates from the employees master table
      const transportEmps = records.filter(r => r.status === 'WFO');
      if (transportEmps.length === 0)
        throw new Error(`No WFO employees found for ${selectedDate}. Upload a roster with WFO status first.`);

      const empIds = transportEmps.map(r => r.employee_id);
      const { data: empDetails } = await supabase
        .from('employees')
        .select('employee_id, lat, lng, location, address, name')
        .in('employee_id', empIds);
      const empMap = Object.fromEntries((empDetails ?? []).map(e => [e.employee_id, e]));

      // 3. Group by shift
      const shiftGroups: Record<string, Array<{ employee_id: string; name: string; lat: number | null; lng: number | null; location: string }>> = {};
      for (const r of transportEmps) {
        const shift = r.shift ?? 'Morning';
        if (!shiftGroups[shift]) shiftGroups[shift] = [];
        const detail = empMap[r.employee_id];
        shiftGroups[shift].push({
          employee_id: r.employee_id,
          name: r.employee_name ?? detail?.name ?? r.employee_id,
          lat: detail?.lat ?? null,
          lng: detail?.lng ?? null,
          location: detail?.location ?? detail?.address ?? r.tower ?? r.team ?? '',
        });
      }

      const allAssignments: Record<string, unknown>[] = [];
      let mapsUsed = 0;
      let fallbackUsed = 0;

      // 4. For each shift: get/create routes → chunk employees → optimize order
      for (const [shift, shiftEmps] of Object.entries(shiftGroups)) {
        const neededRoutes = Math.ceil(shiftEmps.length / vehicleCapacity);
        const routes = await routeService.getOrCreateForShift(shift, neededRoutes, vehicleCapacity, vehicleType);
        const chunks = chunkArray(shiftEmps, vehicleCapacity);

        for (let i = 0; i < chunks.length; i++) {
          const route = routes[i];
          const chunk = chunks[i];
          const hasAllCoords = chunk.every(e => e.lat && e.lng);
          const canUseApi = mapsLoaded && hasAllCoords && !!(settings.google_api_key) && officeLat && officeLng;

          let orderedEmps: Array<{ employee_id: string; name: string; location: string; pickup_order: number; pickup_time: string; drop_time: string }>;

          if (canUseApi) {
            try {
              orderedEmps = await optimizeWithMaps(
                chunk as Array<{ employee_id: string; name: string; lat: number; lng: number; location: string }>,
                officeLat, officeLng, shift, settings,
              );
              mapsUsed += chunk.length;
            } catch (err) {
              // Fall back silently and surface a warning in the toast
              orderedEmps = chunk.map((e, idx) => ({ ...e, pickup_order: idx + 1, pickup_time: defaultPickupTime(shift), drop_time: defaultDropTime(shift) }));
              fallbackUsed += chunk.length;
              console.warn('Maps optimization failed for route', route.route_number, err);
            }
          } else {
            orderedEmps = chunk.map((e, idx) => ({ ...e, pickup_order: idx + 1, pickup_time: defaultPickupTime(shift), drop_time: defaultDropTime(shift) }));
            fallbackUsed += chunk.length;
          }

          for (const emp of orderedEmps) {
            allAssignments.push({
              employee_id: emp.employee_id,
              employee_name: emp.name,
              route_number: route.route_number,
              pickup_order: emp.pickup_order,
              pickup_location: emp.location || 'Home Location',
              drop_location: emp.location || 'Home Location',
              date: selectedDate,
              shift,
              pickup_time: emp.pickup_time,
              drop_time: emp.drop_time,
            });
          }
        }
      }

      if (allAssignments.length === 0)
        throw new Error('No assignments could be built. Check roster and routes configuration.');

      // 5. Save assignments
      const { error } = await supabase
        .from('route_assignments')
        .upsert(allAssignments, { onConflict: 'employee_id,date,shift' });
      if (error) throw error;

      // 6. Update route employee counts
      const routeCounts: Record<string, number> = {};
      for (const a of allAssignments) routeCounts[a.route_number as string] = (routeCounts[a.route_number as string] ?? 0) + 1;
      await Promise.all(
        Object.entries(routeCounts).map(([rn, cnt]) =>
          supabase.from('routes').update({ assigned_employees: cnt }).eq('route_number', rn)
        )
      );

      return { total: allAssignments.length, mapsUsed, fallbackUsed };
    },
    onSuccess: ({ total, mapsUsed, fallbackUsed }) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (fallbackUsed > 0 && mapsUsed === 0)
        toast.success(`Generated ${total} assignments (sequential order — add employee coordinates + API key for Maps optimization)`);
      else if (fallbackUsed > 0)
        toast.success(`Generated ${total} assignments: ${mapsUsed} Google Maps-optimized, ${fallbackUsed} sequential fallback`);
      else
        toast.success(`Generated ${total} Google Maps-optimized assignments for ${selectedDate}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const transportEmployees = records.filter(r => r.status === 'WFO');
  const activeRoutes = allRoutes.filter(r => r.status === 'Active');
  const hasRoster = transportEmployees.length > 0;
  const hasRoutes = activeRoutes.length > 0;
  const alreadyGenerated = existingAssignments.length > 0;
  const totalVehicles = Math.ceil(transportEmployees.length / vehicleCapacity);
  const officeLat = parseFloat(settings.office_lat ?? '0');
  const officeLng = parseFloat(settings.office_lng ?? '0');
  const officeConfigured = !!(officeLat && officeLng);
  const apiKeySet = !!(settings.google_api_key);
  const mapsOptimizable = mapsLoaded && officeConfigured && apiKeySet;
  const empsWithCoords = transportEmployees.filter(r => {
    // rough check — we don't load emp details here, but guide the user
    return true;
  }).length;

  const shiftGroups: Record<string, typeof transportEmployees> = {};
  for (const r of transportEmployees) {
    const s = r.shift ?? 'Morning';
    if (!shiftGroups[s]) shiftGroups[s] = [];
    shiftGroups[s].push(r);
  }

  const teamGroups: Record<string, number> = {};
  for (const r of transportEmployees) {
    if (r.team) teamGroups[r.team] = (teamGroups[r.team] ?? 0) + 1;
  }
  const teamRows = Object.entries(teamGroups).sort((a, b) => b[1] - a[1]);

  const handleSaveCapacity = () => {
    const n = parseInt(capacityInput, 10);
    if (isNaN(n) || n < 1) { toast.error('Enter a valid capacity (minimum 1)'); return; }
    saveCapacityMutation.mutate(String(n));
  };

  const handleExport = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const summary = utils.aoa_to_sheet([
        ['Transport Requirement Report — ' + selectedDate],
        [], ['Metric', 'Value'],
        ['Total WFO Employees', transportEmployees.length],
        ['Vehicle Capacity', vehicleCapacity],
        ['Vehicles Required', totalVehicles],
        [], ['Shift', 'Employees', 'Vehicles Required'],
        ...Object.entries(shiftGroups).map(([shift, emps]) => [shift, emps.length, Math.ceil(emps.length / vehicleCapacity)]),
        [], ['Team', 'WFO Employees'], ...teamRows,
      ]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, summary, 'Transport Summary');
      utils.book_append_sheet(wb, utils.json_to_sheet(transportEmployees.map(r => ({
        'Employee ID': r.employee_id, 'Name': r.employee_name, 'Team': r.team,
        'Tower': r.tower, 'Shift': r.shift, 'Cab Used': r.cab_used ? 'Yes' : 'No',
        'Pickup Required': r.pickup_required ? 'Yes' : 'No', 'Drop Required': r.drop_required ? 'Yes' : 'No',
      }))), 'Transport Detail');
      writeFile(wb, `transport_requirement_${selectedDate}.xlsx`);
      toast.success('Exported transport report');
    });
  };

  return (
    <div className="space-y-6">

      {/* ── Google Maps status banner ── */}
      {mapsOptimizable ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800 text-sm">
          <Sparkles className="w-4 h-4 text-success-600 dark:text-success-400 flex-shrink-0" />
          <p className="text-success-700 dark:text-success-300">
            <span className="font-semibold">Google Maps optimization active.</span> Routes will be generated using real-world Directions API — employees ordered by optimal pickup sequence with estimated arrival times.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-secondary-50 dark:bg-secondary-800/60 rounded-xl border border-secondary-100 dark:border-secondary-700 text-sm">
          <Info className="w-4 h-4 text-secondary-400 mt-0.5 flex-shrink-0" />
          <p className="text-secondary-500 dark:text-secondary-400">
            {!apiKeySet
              ? <>No Google Maps API key set. Routes will be generated in sequential order. Add your API key in <strong>Settings → Google Maps</strong> for real-world route optimization.</>
              : !officeConfigured
              ? <>Office coordinates not configured. Set them in <strong>Settings → General</strong> to enable Maps optimization.</>
              : <>Google Maps loading… optimization will be used once loaded.</>
            }
          </p>
        </div>
      )}

      {/* ── 3-Step Workflow Panel ── */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-secondary-100 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800/80 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-secondary-900 dark:text-white text-sm flex items-center gap-2">
            <Route className="w-4 h-4 text-primary-500" />
            Route Generation Workflow
            <span className="text-secondary-400 font-normal">— {selectedDate}</span>
          </h3>
          {alreadyGenerated && (
            <span className="text-xs bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-200 dark:border-success-800 px-2.5 py-1 rounded-full font-medium">
              {existingAssignments.length} assignments generated
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          {/* Step 1 — Roster */}
          <WorkflowStep
            number={1}
            status={hasRoster ? 'done' : 'blocked'}
            title="Upload & Approve Roster"
            detail={
              hasRoster
                ? `${transportEmployees.length} WFO employee${transportEmployees.length !== 1 ? 's' : ''} ready — roster will be approved on generate`
                : `No WFO employees for ${selectedDate}. Upload a roster file with employees marked WFO.`
            }
            action={!hasRoster && (
              <button onClick={() => onNavigate('upload')} className="btn-secondary text-xs flex items-center gap-1">
                Go to Upload <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          />

          {/* Step 2 — Routes (auto-created if missing) */}
          <WorkflowStep
            number={2}
            status="done"
            title="Configure Routes in Route Master"
            detail={
              hasRoutes
                ? `${activeRoutes.length} active route${activeRoutes.length !== 1 ? 's' : ''} found. Missing routes will be auto-created per shift (MOR-001, AFT-001, NGT-001…).`
                : `No active routes found — they will be auto-created per shift when you generate (e.g. MOR-001, AFT-001). Or add custom routes in Route Master first.`
            }
          />

          {/* Step 3 — Generate */}
          <WorkflowStep
            number={3}
            status={alreadyGenerated ? 'done' : hasRoster ? 'pending' : 'warn'}
            title={alreadyGenerated ? 'Routes Generated & Roster Approved' : mapsOptimizable ? 'Approve Roster & Generate Optimized Routes' : 'Approve Roster & Generate Routes'}
            detail={
              alreadyGenerated
                ? `${existingAssignments.length} assignments across ${[...new Set(existingAssignments.map((a: Record<string, unknown>) => a.route_number))].length} route(s). Re-generate to refresh with latest roster.`
                : hasRoster
                  ? mapsOptimizable
                    ? `Will call Google Maps Directions API to find the optimal pickup order for ${transportEmployees.length} employees, then save routes + assignments. Pickup times calculated from shift arrival times.`
                    : `Will assign ${transportEmployees.length} employee${transportEmployees.length !== 1 ? 's' : ''} to routes in sequential order. Add a Google Maps API key for real-world optimization.`
                  : 'Complete Step 1 first.'
            }
            action={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {transportEmployees.length > 0 && (
                  <button onClick={handleExport} className="btn-secondary text-xs">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                )}
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={!hasRoster || generateMutation.isPending}
                  className={cn(
                    'btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2',
                    alreadyGenerated && hasRoster && 'bg-warning-500 hover:bg-warning-600 border-warning-500 hover:border-warning-600',
                  )}
                >
                  {generateMutation.isPending
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                    : mapsOptimizable
                      ? <><Navigation className="w-4 h-4" /> {alreadyGenerated ? 'Re-generate (Maps)' : 'Generate Routes (Maps)'}</>
                      : <><RefreshCw className="w-4 h-4" /> {alreadyGenerated ? 'Re-generate Routes' : 'Generate Routes'}</>
                  }
                </button>
              </div>
            }
          />

          {/* Office location summary */}
          {officeConfigured && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary-50 dark:bg-secondary-700/40 rounded-lg text-xs text-secondary-500 dark:text-secondary-400 border border-secondary-100 dark:border-secondary-700">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary-400" />
              <span>
                <span className="font-medium text-secondary-700 dark:text-secondary-300">Office destination: </span>
                {settings.office_address || `${settings.office_lat}, ${settings.office_lng}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Vehicle Capacity ── */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Vehicle Configuration</h3>
            <p className="text-xs text-secondary-400 mt-0.5">Seats per vehicle — used to split employees into route groups</p>
          </div>
          {editingCapacity ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
                <input
                  type="number" min={1} max={100}
                  value={capacityInput}
                  onChange={e => setCapacityInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveCapacity(); if (e.key === 'Escape') setEditingCapacity(false); }}
                  className="input-field pl-9 w-28 text-center font-semibold"
                  autoFocus
                />
              </div>
              <span className="text-sm text-secondary-500">seats</span>
              <button onClick={handleSaveCapacity} disabled={saveCapacityMutation.isPending} className="btn-primary p-2">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditingCapacity(false)} className="btn-secondary p-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-lg border border-primary-100 dark:border-primary-800">
                <Bus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span className="text-2xl font-bold text-primary-700 dark:text-primary-300">{vehicleCapacity}</span>
                <span className="text-sm text-primary-600 dark:text-primary-400">seats / vehicle</span>
              </div>
              <button onClick={() => { setCapacityInput(String(vehicleCapacity)); setEditingCapacity(true); }} className="btn-secondary text-sm">
                <Pencil className="w-4 h-4" /> Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'WFO Employees',    value: transportEmployees.length,                   cls: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
          { label: 'Vehicles Required', value: totalVehicles,                               cls: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
          { label: 'Seats Available',   value: totalVehicles * vehicleCapacity,             cls: 'text-secondary-500',                     bg: 'bg-secondary-100 dark:bg-secondary-700' },
          { label: 'Non-Transport',     value: records.length - transportEmployees.length,  cls: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' },
        ].map(({ label, value, cls, bg }) => (
          <div key={label} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', bg)}>
              <Bus className={cn('w-5 h-5', cls)} />
            </div>
            <p className="text-3xl font-bold text-secondary-900 dark:text-white">{value}</p>
            <p className="text-xs text-secondary-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="p-10 flex justify-center">
          <div className="w-7 h-7 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Shift breakdown */}
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-secondary-100 dark:border-secondary-700">
              <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Shift-wise Transport Requirement</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left">Shift</th>
                  <th className="px-4 py-3 text-right">Employees</th>
                  <th className="px-4 py-3 text-right">Vehicles</th>
                  <th className="px-4 py-3 text-right">Arrival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {Object.entries(shiftGroups).length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-secondary-400">
                    <Clock className="w-6 h-6 text-secondary-300 mx-auto mb-1" />
                    No WFO employees on {selectedDate}
                  </td></tr>
                ) : Object.entries(shiftGroups).map(([shift, emps]) => {
                  const vehicles = Math.ceil(emps.length / vehicleCapacity);
                  const util = Math.round((emps.length / (vehicles * vehicleCapacity)) * 100);
                  const arrivalKey = shift === 'Morning' ? 'office_arrival_morning' : shift === 'Afternoon' ? 'office_arrival_afternoon' : 'office_arrival_night';
                  const arrivalTime = settings[arrivalKey] ?? '—';
                  return (
                    <tr key={shift} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                      <td className="px-4 py-3"><span className={cn('badge', getShiftColor(shift))}>{shift}</span></td>
                      <td className="px-4 py-3 text-right font-semibold text-secondary-900 dark:text-white">{emps.length}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 h-1.5 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${util}%` }} />
                          </div>
                          <span className="font-semibold text-primary-600 dark:text-primary-400">{vehicles}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-secondary-500 dark:text-secondary-400 font-mono">{arrivalTime}</td>
                    </tr>
                  );
                })}
                {Object.keys(shiftGroups).length > 0 && (
                  <tr className="bg-secondary-50 dark:bg-secondary-700/30 font-semibold">
                    <td className="px-4 py-3 text-secondary-700 dark:text-secondary-300">Total</td>
                    <td className="px-4 py-3 text-right text-secondary-900 dark:text-white">{transportEmployees.length}</td>
                    <td className="px-4 py-3 text-right text-primary-600 dark:text-primary-400">{totalVehicles} vehicles</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Team breakdown */}
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-secondary-100 dark:border-secondary-700">
              <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Team-wise WFO Count</h3>
            </div>
            <div className="overflow-y-auto max-h-[340px]">
              <table className="w-full text-sm">
                <thead className="table-header sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-right">WFO Employees</th>
                    <th className="px-4 py-3 text-right">Vehicles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                  {teamRows.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-secondary-400">No team data available</td></tr>
                  ) : teamRows.map(([team, count]) => (
                    <tr key={team} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-secondary-800 dark:text-secondary-200">{team}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                            <div className="h-full bg-success-500 rounded-full" style={{ width: `${Math.min(100, (count / Math.max(1, transportEmployees.length)) * 100)}%` }} />
                          </div>
                          <span className="font-semibold text-secondary-900 dark:text-white w-6 text-right">{count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-secondary-500 dark:text-secondary-400 text-xs">{Math.ceil(count / vehicleCapacity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-secondary-50 dark:bg-secondary-800/50 rounded-xl border border-secondary-100 dark:border-secondary-700">
        <p className="text-xs text-secondary-500 dark:text-secondary-400">
          <span className="font-semibold">Formula:</span> Vehicles = ⌈ WFO ÷ {vehicleCapacity} seats ⌉ &nbsp;·&nbsp;
          <span className="font-semibold">Route naming:</span> MOR-001…MOR-N (Morning), AFT-001…AFT-N (Afternoon), NGT-001…NGT-N (Night) — auto-created if not present &nbsp;·&nbsp;
          {mapsOptimizable
            ? <span className="text-success-600 dark:text-success-400">Google Maps optimization: ON — pickup sequence &amp; times from Directions API</span>
            : <span>Google Maps: OFF — add API key in Settings for real-world route optimization</span>
          }
        </p>
      </div>
    </div>
  );
}
