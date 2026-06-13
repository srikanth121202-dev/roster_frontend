import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Search, Map, ChevronDown, ChevronUp,
  Users, Clock, Bus, MapPin, RefreshCw,
} from 'lucide-react';
import { routeService, assignmentService, vendorService } from '../services';
import type { Route } from '../types';
import Modal from '../components/ui/Modal';
import RouteDetailModal from '../components/route/RouteDetailModal';
import { cn, getStatusColor, getShiftColor } from '../utils/helpers';
import { toast } from 'sonner';

const emptyRoute: Omit<Route, 'id' | 'assigned_employees'> = {
  route_number: '', route_name: '', vehicle_capacity: 20, vehicle_type: 'Bus', status: 'Active', shift: 'Morning',
  vendor_id: null, vendor_name: '',
};

export default function RouteMasterPage() {
  const queryClient = useQueryClient();

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: routeService.getAll,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: vendorService.getAll,
  });

  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch]               = useState('');
  const [modalOpen, setModalOpen]         = useState(false);
  const [editRoute, setEditRoute]         = useState<Route | null>(null);
  const [form, setForm]                   = useState(emptyRoute);
  const [deleteConfirm, setDeleteConfirm] = useState<Route | null>(null);
  const [detailRoute, setDetailRoute]     = useState<Route | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());

  /* ── Assignments for selected date ── */
  const { data: assignments = [], isLoading: assignLoading, refetch: refetchAssignments } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: () => assignmentService.getByDate(selectedDate),
  });

  // Group assignments by route_number
  const assignmentsByRoute = useMemo(() => {
    const map: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      if (!map[a.route_number]) map[a.route_number] = [];
      map[a.route_number].push(a);
    }
    return map;
  }, [assignments]);

  const generateMutation = useMutation({
    mutationFn: () => assignmentService.generate(selectedDate),
    onSuccess: count => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Generated ${count} route assignments for ${selectedDate}`);
    },
    onError: (err: Error) => toast.error('Generation failed: ' + err.message),
  });

  const createMutation = useMutation({
    mutationFn: (r: Omit<Route, 'id' | 'assigned_employees'>) => routeService.create(r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Route created');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, route }: { id: string; route: Partial<Route> }) => routeService.update(id, route),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route updated');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => routeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Route deleted');
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter(r =>
      r.route_number.toLowerCase().includes(q) || r.route_name.toLowerCase().includes(q)
    );
  }, [routes, search]);

  const openAdd = () => { setEditRoute(null); setForm(emptyRoute); setModalOpen(true); };
  const openEdit = (r: Route) => {
    setEditRoute(r);
    setForm({
      route_number: r.route_number, route_name: r.route_name,
      vehicle_capacity: r.vehicle_capacity, vehicle_type: r.vehicle_type,
      status: r.status, shift: r.shift,
      vendor_id: r.vendor_id ?? null, vendor_name: r.vendor_name ?? '',
    });
    setModalOpen(true);
  };

  const toggleExpand = (rn: string) =>
    setExpandedRoutes(s => { const n = new Set(s); n.has(rn) ? n.delete(rn) : n.add(rn); return n; });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editRoute) updateMutation.mutate({ id: editRoute.id, route: form });
    else createMutation.mutate(form);
  };

  // Routes that have assignments for the selected date
  const routesWithData = routes.filter(r => (assignmentsByRoute[r.route_number]?.length ?? 0) > 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Route Master</h1>
          <p className="page-subtitle">{routes.length} routes configured · {assignments.length} assignments on {selectedDate}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 block mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); }}
              className="input-field text-sm"
            />
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-secondary text-sm"
          >
            <RefreshCw className={cn('w-4 h-4', generateMutation.isPending && 'animate-spin')} />
            {generateMutation.isPending ? 'Generating…' : 'Generate Routes'}
          </button>
          <button onClick={openAdd} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add Route
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routes…" className="input-field pl-9" />
      </div>

      {/* ── Route config cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5 h-52 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(route => {
            const routeAssignments = assignmentsByRoute[route.route_number] ?? [];
            const dateCount = routeAssignments.length;
            const utilization = route.vehicle_capacity > 0
              ? Math.round((route.assigned_employees / route.vehicle_capacity) * 100)
              : 0;
            const dateUtil = route.vehicle_capacity > 0
              ? Math.round((dateCount / route.vehicle_capacity) * 100) : 0;

            return (
              <div key={route.id} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5 hover:shadow-card-hover transition-all duration-200 flex flex-col gap-3">
                {/* Title row */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-md">{route.route_number}</span>
                      <span className={cn('badge', getStatusColor(route.status))}>{route.status}</span>
                      <span className={cn('badge', getShiftColor(route.shift))}>{route.shift}</span>
                    </div>
                    <h3 className="font-semibold text-secondary-900 dark:text-white truncate">{route.route_name}</h3>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => openEdit(route)} className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 rounded-md transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirm(route)} className="p-1.5 hover:bg-error-50 dark:hover:bg-error-900/20 text-error-500 rounded-md transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-secondary-400 text-xs">Vehicle</p>
                    <p className="font-medium text-secondary-700 dark:text-secondary-200">{route.vehicle_type}</p>
                  </div>
                  <div>
                    <p className="text-secondary-400 text-xs">Total Capacity</p>
                    <p className="font-medium text-secondary-700 dark:text-secondary-200">{route.assigned_employees}/{route.vehicle_capacity}</p>
                  </div>
                  {route.vendor_name && (
                    <div className="col-span-2">
                      <p className="text-secondary-400 text-xs">Vendor</p>
                      <p className="font-medium text-secondary-700 dark:text-secondary-200 text-xs truncate">{route.vendor_name}</p>
                    </div>
                  )}
                </div>

                {/* Overall utilization */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-secondary-400">Overall Utilization</span>
                    <span className="text-xs font-medium text-secondary-600 dark:text-secondary-300">{utilization}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', utilization > 90 ? 'bg-error-500' : utilization > 70 ? 'bg-warning-500' : 'bg-primary-500')}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>

                {/* Date-specific assignment pill */}
                <div className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-xs',
                  dateCount > 0
                    ? 'bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-800'
                    : 'bg-secondary-50 dark:bg-secondary-700/30 border border-secondary-100 dark:border-secondary-700'
                )}>
                  <span className={cn('font-medium', dateCount > 0 ? 'text-success-700 dark:text-success-400' : 'text-secondary-400')}>
                    {assignLoading ? 'Loading…' : dateCount > 0 ? `${dateCount} assigned on ${selectedDate}` : `No assignments on ${selectedDate}`}
                  </span>
                  {dateCount > 0 && (
                    <span className={cn('font-semibold', dateUtil > 90 ? 'text-error-600' : dateUtil > 70 ? 'text-warning-600' : 'text-success-600 dark:text-success-400')}>
                      {dateUtil}%
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <button onClick={() => setDetailRoute(route)} className="btn-secondary text-xs py-2">
                    <Map className="w-3.5 h-3.5" /> Trip Plan
                  </button>
                  <button
                    onClick={() => dateCount > 0 && document.getElementById(`route-section-${route.route_number}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    disabled={dateCount === 0}
                    className={cn('btn-secondary text-xs py-2 disabled:opacity-40 disabled:cursor-not-allowed')}
                  >
                    <Users className="w-3.5 h-3.5" /> View Employees
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Generated Route Data section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-secondary-900 dark:text-white flex items-center gap-2">
            <Bus className="w-5 h-5 text-primary-500" />
            Generated Route Data
            <span className="text-sm font-normal text-secondary-400">— {selectedDate}</span>
          </h2>
          {assignments.length > 0 && (
            <span className="text-xs bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 border border-success-100 dark:border-success-800 px-3 py-1 rounded-full font-medium">
              {assignments.length} assignments · {routesWithData.length} routes
            </span>
          )}
        </div>

        {assignLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-10 text-center">
            <Bus className="w-10 h-10 text-secondary-300 mx-auto mb-3" />
            <p className="font-medium text-secondary-500 dark:text-secondary-400">No routes generated for {selectedDate}</p>
            <p className="text-sm text-secondary-400 mt-1">Upload a roster and click "Generate Routes" to assign employees to routes.</p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary text-sm mt-4"
            >
              <RefreshCw className={cn('w-4 h-4', generateMutation.isPending && 'animate-spin')} />
              {generateMutation.isPending ? 'Generating…' : 'Generate Routes Now'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {routes
              .filter(r => (assignmentsByRoute[r.route_number]?.length ?? 0) > 0)
              .map(route => {
                const routeAssigns = (assignmentsByRoute[route.route_number] ?? [])
                  .slice()
                  .sort((a, b) => (a.pickup_order ?? 0) - (b.pickup_order ?? 0));
                const isExpanded = expandedRoutes.has(route.route_number);
                const utilization = route.vehicle_capacity > 0
                  ? Math.round((routeAssigns.length / route.vehicle_capacity) * 100)
                  : 0;

                // Group employees by shift within this route
                const shiftGroups = routeAssigns.reduce<Record<string, typeof routeAssigns>>((acc, a) => {
                  const s = a.shift ?? 'Morning';
                  if (!acc[s]) acc[s] = [];
                  acc[s].push(a);
                  return acc;
                }, {});

                return (
                  <div
                    key={route.route_number}
                    id={`route-section-${route.route_number}`}
                    className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm"
                  >
                    {/* Route header — always visible */}
                    <button
                      onClick={() => toggleExpand(route.route_number)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors text-left"
                    >
                      {/* Route badge + name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{route.route_number}</span>
                            <span className="font-semibold text-secondary-900 dark:text-white truncate">{route.route_name}</span>
                            <span className={cn('badge text-xs', getShiftColor(route.shift))}>{route.shift}</span>
                            <span className={cn('badge text-xs', getStatusColor(route.status))}>{route.status}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                            <span className="text-xs text-secondary-500 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {routeAssigns.length} of {route.vehicle_capacity} seats
                            </span>
                            <span className="text-xs text-secondary-500 flex items-center gap-1">
                              <Bus className="w-3 h-3" /> {route.vehicle_type}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Utilization pill */}
                      <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-secondary-400">Utilization</p>
                          <p className={cn('text-sm font-bold', utilization > 90 ? 'text-error-600' : utilization > 70 ? 'text-warning-600' : 'text-success-600 dark:text-success-400')}>
                            {utilization}%
                          </p>
                        </div>
                        <div className="w-20 h-2 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', utilization > 90 ? 'bg-error-500' : utilization > 70 ? 'bg-warning-500' : 'bg-success-500')}
                            style={{ width: `${Math.min(100, utilization)}%` }}
                          />
                        </div>
                      </div>

                      {/* Trip plan button */}
                      <button
                        onClick={e => { e.stopPropagation(); setDetailRoute(route); }}
                        className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0 hidden sm:flex"
                      >
                        <Map className="w-3.5 h-3.5" /> Map
                      </button>

                      {/* Expand chevron */}
                      <div className="flex-shrink-0 text-secondary-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Expanded employee table */}
                    {isExpanded && (
                      <div className="border-t border-secondary-100 dark:border-secondary-700">
                        {Object.entries(shiftGroups).map(([shift, emps]) => (
                          <div key={shift}>
                            {/* Shift sub-header */}
                            <div className={cn(
                              'px-5 py-2 flex items-center gap-2 text-xs font-semibold border-b border-secondary-100 dark:border-secondary-700',
                              'bg-secondary-50 dark:bg-secondary-700/30'
                            )}>
                              <span className={cn('badge', getShiftColor(shift))}>{shift}</span>
                              <span className="text-secondary-500 dark:text-secondary-400">{emps.length} employees</span>
                              {emps[0]?.pickup_time && (
                                <span className="text-secondary-400 flex items-center gap-1 ml-1">
                                  <Clock className="w-3 h-3" /> Pickup: {emps[0].pickup_time}
                                </span>
                              )}
                            </div>
                            {/* Employee rows */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="table-header">
                                  <tr>
                                    <th className="px-4 py-2.5 text-left w-12">#</th>
                                    <th className="px-4 py-2.5 text-left">Employee</th>
                                    <th className="px-4 py-2.5 text-left hidden md:table-cell">Employee ID</th>
                                    <th className="px-4 py-2.5 text-left hidden lg:table-cell">Pickup Location</th>
                                    <th className="px-4 py-2.5 text-left hidden lg:table-cell">Pickup Time</th>
                                    <th className="px-4 py-2.5 text-left hidden xl:table-cell">Drop Time</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                                  {emps.map(a => (
                                    <tr key={a.id ?? a.employee_id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/20 transition-colors">
                                      <td className="px-4 py-2.5">
                                        <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-bold flex items-center justify-center">
                                          {a.pickup_order}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <p className="font-medium text-secondary-800 dark:text-secondary-200">{a.employee_name}</p>
                                      </td>
                                      <td className="px-4 py-2.5 hidden md:table-cell">
                                        <span className="text-xs text-secondary-400 font-mono">{a.employee_id}</span>
                                      </td>
                                      <td className="px-4 py-2.5 hidden lg:table-cell">
                                        <span className="flex items-center gap-1 text-secondary-500 dark:text-secondary-400 text-xs">
                                          <MapPin className="w-3 h-3 flex-shrink-0" />
                                          {a.pickup_location}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-success-600 dark:text-success-400 font-medium">{a.pickup_time}</td>
                                      <td className="px-4 py-2.5 hidden xl:table-cell text-xs text-secondary-400">{a.drop_time}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Route form modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editRoute ? 'Edit Route' : 'Add Route'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Route Number</label>
              <input className="input-field" value={form.route_number} onChange={e => setForm({ ...form, route_number: e.target.value })} required disabled={!!editRoute} />
            </div>
            <div>
              <label className="label-field">Route Name</label>
              <input className="input-field" value={form.route_name} onChange={e => setForm({ ...form, route_name: e.target.value })} required />
            </div>
            <div>
              <label className="label-field">Vehicle Capacity</label>
              <input type="number" className="input-field" value={form.vehicle_capacity} onChange={e => setForm({ ...form, vehicle_capacity: Number(e.target.value) })} required min={1} />
            </div>
            <div>
              <label className="label-field">Vehicle Type</label>
              <select className="input-field" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
                <option>Bus</option><option>Van</option><option>Car</option><option>Minibus</option>
              </select>
            </div>
            <div>
              <label className="label-field">Shift</label>
              <select className="input-field" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
                <option>Morning</option><option>Afternoon</option><option>Night</option>
              </select>
            </div>
            <div>
              <label className="label-field">Status</label>
              <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Route['status'] })}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-field">Vendor / Transport Partner</label>
              <select
                className="input-field"
                value={form.vendor_id ?? ''}
                onChange={e => {
                  const v = vendors.find(v => v.id === e.target.value);
                  setForm({ ...form, vendor_id: e.target.value || null, vendor_name: v?.company_name ?? '' });
                }}
              >
                <option value="">— Unassigned —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.company_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
              {editRoute ? 'Update' : 'Create'} Route
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Delete confirm ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Route">
        <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
          Are you sure you want to delete route <strong>{deleteConfirm?.route_name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="btn-danger">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Modal>

      {/* ── Route detail + Google Map ── */}
      <RouteDetailModal route={detailRoute} date={selectedDate} onClose={() => setDetailRoute(null)} />
    </div>
  );
}
