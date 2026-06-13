import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, Bus, Users, Clock, MapPin, LogOut,
  ChevronDown, ChevronUp, Truck, AlertCircle,
  UserCircle, Phone, Car, CheckCircle2, Pencil, X,
  Download, FileText,
} from 'lucide-react';
import { assignmentService, driverService } from '../services';
import type { DriverSubmission } from '../types';
import { useApp } from '../store/AppContext';
import { cn } from '../utils/helpers';
import { toast } from 'sonner';

const SHIFT_COLOR: Record<string, string> = {
  Morning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Afternoon: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Night: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};
function shiftColor(shift: string) {
  return SHIFT_COLOR[shift] ?? 'bg-gray-100 text-gray-700';
}

interface DriverFormState {
  driver_name: string;
  driver_phone: string;
  vehicle_number: string;
  vehicle_model: string;
}

const EMPTY_FORM: DriverFormState = {
  driver_name: '', driver_phone: '', vehicle_number: '', vehicle_model: '',
};

interface DriverModalProps {
  routeNumber: string;
  routeName: string;
  existing: DriverSubmission | null;
  onClose: () => void;
  onSubmit: (form: DriverFormState) => void;
  loading: boolean;
}

function DriverModal({ routeNumber, routeName, existing, onClose, onSubmit, loading }: DriverModalProps) {
  const [form, setForm] = useState<DriverFormState>({
    driver_name: existing?.driver_name ?? '',
    driver_phone: existing?.driver_phone ?? '',
    vehicle_number: existing?.vehicle_number ?? '',
    vehicle_model: existing?.vehicle_model ?? '',
  });

  const f = (field: keyof DriverFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Modal header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {existing ? 'Update Driver Details' : 'Assign Driver Details'}
            </h2>
            <p className="text-teal-100 text-sm">{routeNumber} — {routeName}</p>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Driver Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.driver_name}
                onChange={f('driver_name')}
                placeholder="e.g. Suresh Kumar"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Driver Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={form.driver_phone}
                onChange={f('driver_phone')}
                placeholder="e.g. +91 9876543210"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Vehicle Registration Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.vehicle_number}
                onChange={f('vehicle_number')}
                placeholder="e.g. MH 12 AB 1234"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Vehicle Model / Make
            </label>
            <div className="relative">
              <Bus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.vehicle_model}
                onChange={f('vehicle_model')}
                placeholder="e.g. Tata Starbus, Force Traveller"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {existing ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorTripsPage() {
  const { vendor, logout } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [driverModal, setDriverModal] = useState<{ routeNumber: string; routeName: string } | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/vendor/login', { replace: true });
  };

  const { data: tripsData, isLoading, isError } = useQuery({
    queryKey: ['vendor-trips', vendor?.id, date],
    queryFn: () => assignmentService.getByVendorAndDate(vendor!.id, date),
    enabled: !!vendor?.id,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['driver-submissions', vendor?.id, date],
    queryFn: () => driverService.getByVendorAndDate(vendor!.id, date),
    enabled: !!vendor?.id,
  });

  const submitMutation = useMutation({
    mutationFn: (form: DriverFormState & { routeNumber: string }) =>
      driverService.upsert({
        vendor_id: vendor!.id,
        route_number: form.routeNumber,
        date,
        driver_name: form.driver_name,
        driver_phone: form.driver_phone,
        vehicle_number: form.vehicle_number,
        vehicle_model: form.vehicle_model,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-submissions', vendor?.id, date] });
      toast.success('Driver details submitted successfully');
      setDriverModal(null);
    },
    onError: (err: Error) => toast.error('Failed to submit: ' + err.message),
  });

  const routes = tripsData?.routes ?? [];
  const assignments = tripsData?.assignments ?? [];

  const byRoute = useMemo(() => {
    const map: Record<string, typeof assignments> = {};
    for (const a of assignments) {
      if (!map[a.route_number]) map[a.route_number] = [];
      map[a.route_number].push(a);
    }
    return map;
  }, [assignments]);

  const submissionsByRoute = useMemo(() =>
    Object.fromEntries(submissions.map(s => [s.route_number, s])),
    [submissions]
  );

  const routesWithTrips = routes.filter(r => (byRoute[r.route_number]?.length ?? 0) > 0);
  const totalPassengers = assignments.length;
  const routeCount = routesWithTrips.length;

  const handleExcelExport = () => {
    if (!routesWithTrips.length) return toast.error('No trip data to export');
    import('xlsx').then(({ utils, writeFile }) => {
      const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });

      // ── Sheet 1: Route & Driver Summary ──
      const routeRows = routesWithTrips.map(r => {
        const d = submissionsByRoute[r.route_number];
        const pax = byRoute[r.route_number] ?? [];
        return {
          'Date': displayDate,
          'Route No.': r.route_number,
          'Route Name': r.route_name,
          'Shift': r.shift,
          'Vehicle Type': r.vehicle_type,
          'Capacity': r.vehicle_capacity,
          'Passengers Assigned': pax.length,
          'Occupancy %': r.vehicle_capacity > 0 ? Math.round((pax.length / r.vehicle_capacity) * 100) + '%' : '0%',
          'Driver Name': d?.driver_name ?? '',
          'Driver Phone': d?.driver_phone ?? '',
          'Vehicle No.': d?.vehicle_number ?? '',
          'Vehicle Model': d?.vehicle_model ?? '',
          'Driver Status': d ? 'Submitted' : 'Pending',
          'First Pickup Time': pax[0]?.pickup_time ?? '',
        };
      });
      const ws1 = utils.json_to_sheet(routeRows);
      ws1['!cols'] = [12, 10, 26, 12, 14, 10, 18, 12, 22, 16, 16, 20, 14, 16].map(wch => ({ wch }));

      // ── Sheet 2: Full Employee Trip Details ──
      const routeMap = Object.fromEntries(routesWithTrips.map(r => [r.route_number, r]));
      const passengerRows = assignments
        .slice()
        .sort((a, b) => a.route_number.localeCompare(b.route_number) || (a.pickup_order ?? 0) - (b.pickup_order ?? 0))
        .map(a => {
          const r = routeMap[a.route_number];
          const d = submissionsByRoute[a.route_number];
          return {
            'Date': date,
            'Route No.': a.route_number,
            'Route Name': r?.route_name ?? '',
            'Shift': a.shift,
            'Vehicle Type': r?.vehicle_type ?? '',
            'Pickup #': a.pickup_order,
            'Employee ID': a.employee_id,
            'Employee Name': a.employee_name,
            'Gender': a.employee_gender ?? '',
            'Phone': a.employee_phone ?? '',
            'Team': a.employee_team ?? '',
            'Tower': a.employee_tower ?? '',
            'Home Locality': a.employee_location ?? '',
            'Address': a.employee_address ?? '',
            'Pickup Location': a.pickup_location,
            'Drop Location': a.drop_location ?? '',
            'Pickup Time': a.pickup_time,
            'Drop Time': a.drop_time,
            'Driver Name': d?.driver_name ?? '',
            'Driver Phone': d?.driver_phone ?? '',
            'Vehicle No.': d?.vehicle_number ?? '',
            'Vehicle Model': d?.vehicle_model ?? '',
          };
        });
      const ws2 = utils.json_to_sheet(passengerRows);
      ws2['!cols'] = [12, 10, 26, 10, 14, 9, 14, 24, 8, 16, 18, 12, 18, 30, 28, 28, 12, 12, 22, 16, 16, 20].map(wch => ({ wch }));

      // ── Sheet 3: Per-Route Breakdown ──
      const perRouteRows: Record<string, unknown>[] = [];
      routesWithTrips.forEach(r => {
        const d = submissionsByRoute[r.route_number];
        const pax = (byRoute[r.route_number] ?? [])
          .slice().sort((a, b) => (a.pickup_order ?? 0) - (b.pickup_order ?? 0));

        // Route header row
        perRouteRows.push({
          'Route No.': r.route_number,
          'Route Name': r.route_name,
          'Shift': r.shift,
          'Vehicle Type': r.vehicle_type,
          'Capacity': r.vehicle_capacity,
          'Pickup #': '',
          'Employee ID': '',
          'Employee Name': 'ROUTE HEADER',
          'Gender': '',
          'Phone': '',
          'Team': '',
          'Tower': '',
          'Pickup Location': '',
          'Drop Location': '',
          'Pickup Time': '',
          'Drop Time': '',
          'Driver Name': d?.driver_name ?? 'Pending',
          'Driver Phone': d?.driver_phone ?? '',
          'Vehicle No.': d?.vehicle_number ?? '',
        });

        pax.forEach(a => {
          perRouteRows.push({
            'Route No.': a.route_number,
            'Route Name': r.route_name,
            'Shift': a.shift,
            'Vehicle Type': r.vehicle_type,
            'Capacity': '',
            'Pickup #': a.pickup_order,
            'Employee ID': a.employee_id,
            'Employee Name': a.employee_name,
            'Gender': a.employee_gender ?? '',
            'Phone': a.employee_phone ?? '',
            'Team': a.employee_team ?? '',
            'Tower': a.employee_tower ?? '',
            'Pickup Location': a.pickup_location,
            'Drop Location': a.drop_location ?? '',
            'Pickup Time': a.pickup_time,
            'Drop Time': a.drop_time,
            'Driver Name': '',
            'Driver Phone': '',
            'Vehicle No.': '',
          });
        });
        perRouteRows.push({});
      });
      const ws3 = utils.json_to_sheet(perRouteRows);
      ws3['!cols'] = [10, 26, 12, 14, 10, 9, 14, 24, 8, 16, 18, 12, 28, 28, 12, 12, 22, 16, 16].map(wch => ({ wch }));

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws1, 'Route & Driver Summary');
      utils.book_append_sheet(wb, ws2, 'All Employee Trips');
      utils.book_append_sheet(wb, ws3, 'Per-Route Breakdown');
      writeFile(wb, `trips_${date}_${vendor?.company_name?.replace(/\s+/g, '_') ?? 'export'}.xlsx`);
      toast.success('Excel exported successfully');
    });
  };

  const handlePDFExport = () => {
    if (!routesWithTrips.length) return toast.error('No trip data to export');
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'landscape' });
      const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const pageW = 277;

      const addPageHeader = (title: string, sub: string) => {
        doc.setFillColor(13, 148, 136);
        doc.rect(0, 0, pageW, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 10, 9);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(sub, pageW - 10, 9, { align: 'right' });
        doc.setTextColor(0);
      };

      // ── Page 1: Route & Driver Summary ──
      addPageHeader('Trip & Driver Assignment Sheet', `${vendor?.company_name ?? ''}  |  ${displayDate}`);
      doc.setFontSize(8);
      doc.setTextColor(80);

      const cols1 = [
        { label: 'ROUTE NO.', x: 10, w: 22 },
        { label: 'ROUTE NAME', x: 33, w: 44 },
        { label: 'SHIFT', x: 78, w: 18 },
        { label: 'VEHICLE', x: 97, w: 20 },
        { label: 'CAP', x: 118, w: 10 },
        { label: 'PAX', x: 129, w: 10 },
        { label: 'DRIVER NAME', x: 140, w: 36 },
        { label: 'DRIVER PHONE', x: 177, w: 30 },
        { label: 'VEHICLE NO.', x: 208, w: 30 },
        { label: 'STATUS', x: 239, w: 22 },
        { label: '1ST PICKUP', x: 262, w: 24 },
      ];

      let hy = 22;
      doc.setFont('helvetica', 'bold');
      cols1.forEach(c => doc.text(c.label, c.x, hy));
      doc.setLineWidth(0.3);
      doc.setDrawColor(180);
      doc.line(10, hy + 2, pageW - 10, hy + 2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      let y = hy + 7;

      routesWithTrips.forEach(r => {
        if (y > 192) { doc.addPage(); addPageHeader('Route & Driver Summary (cont.)', displayDate); y = 22; }
        const d = submissionsByRoute[r.route_number];
        const pax = byRoute[r.route_number] ?? [];
        const cap = r.vehicle_capacity;
        const utilPct = cap > 0 ? Math.round((pax.length / cap) * 100) : 0;

        const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max - 1) + '…' : s;
        doc.text(r.route_number, cols1[0].x, y);
        doc.text(truncate(r.route_name, 22), cols1[1].x, y);
        doc.text(r.shift, cols1[2].x, y);
        doc.text(truncate(r.vehicle_type, 10), cols1[3].x, y);
        doc.text(String(cap), cols1[4].x, y);
        doc.text(`${pax.length} (${utilPct}%)`, cols1[5].x, y);
        if (d) {
          doc.text(truncate(d.driver_name, 18), cols1[6].x, y);
          doc.text(d.driver_phone, cols1[7].x, y);
          doc.text(d.vehicle_number, cols1[8].x, y);
          doc.setTextColor(22, 163, 74);
          doc.text('Submitted', cols1[9].x, y);
          doc.setTextColor(0);
        } else {
          doc.setTextColor(217, 119, 6);
          doc.text('Pending', cols1[6].x, y);
          doc.setTextColor(0);
        }
        doc.text(pax[0]?.pickup_time ?? '', cols1[10].x, y);
        doc.setDrawColor(220);
        doc.line(10, y + 2, pageW - 10, y + 2);
        y += 7;
      });

      // ── Per-route passenger pages ──
      const cols2 = [
        { label: '#', x: 10, w: 8 },
        { label: 'EMPLOYEE NAME', x: 18, w: 46 },
        { label: 'EMP ID', x: 65, w: 22 },
        { label: 'GENDER', x: 88, w: 14 },
        { label: 'PHONE', x: 103, w: 30 },
        { label: 'TEAM', x: 134, w: 28 },
        { label: 'TOWER', x: 163, w: 20 },
        { label: 'PICKUP LOCATION', x: 184, w: 40 },
        { label: 'PICKUP TIME', x: 225, w: 22 },
        { label: 'DROP TIME', x: 248, w: 20 },
      ];

      routesWithTrips.forEach(r => {
        const pax = (byRoute[r.route_number] ?? [])
          .slice().sort((a, b) => (a.pickup_order ?? 0) - (b.pickup_order ?? 0));
        const d = submissionsByRoute[r.route_number];

        doc.addPage();
        addPageHeader(
          `${r.route_number} — ${r.route_name}`,
          `${r.shift}  |  ${r.vehicle_type}  |  ${pax.length}/${r.vehicle_capacity} seats  |  ${displayDate}`,
        );

        let sy = 20;
        if (d) {
          doc.setFontSize(8.5);
          doc.setTextColor(13, 148, 136);
          doc.setFont('helvetica', 'bold');
          doc.text('Driver:', 10, sy);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0);
          doc.text(`${d.driver_name}  |  ${d.driver_phone}  |  ${d.vehicle_number}${d.vehicle_model ? ` (${d.vehicle_model})` : ''}`, 24, sy);
          sy += 7;
        }

        doc.setFontSize(7.5);
        doc.setTextColor(80);
        doc.setFont('helvetica', 'bold');
        cols2.forEach(c => doc.text(c.label, c.x, sy));
        doc.setLineWidth(0.3);
        doc.setDrawColor(150);
        doc.line(10, sy + 2, pageW - 10, sy + 2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
        let py = sy + 7;

        const trunc = (s: string, max: number) => (s ?? '').length > max ? (s ?? '').substring(0, max - 1) + '…' : (s ?? '');

        pax.forEach((a, idx) => {
          if (py > 195) {
            doc.addPage();
            addPageHeader(`${r.route_number} — ${r.route_name} (cont.)`, displayDate);
            py = 22;
          }
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(10, py - 5, pageW - 20, 6.5, 'F');
          }
          doc.setFontSize(7.5);
          doc.text(String(a.pickup_order), cols2[0].x, py);
          doc.text(trunc(a.employee_name, 24), cols2[1].x, py);
          doc.text(trunc(a.employee_id, 12), cols2[2].x, py);
          doc.text(trunc(a.employee_gender ?? '', 8), cols2[3].x, py);
          doc.text(trunc(a.employee_phone ?? '', 16), cols2[4].x, py);
          doc.text(trunc(a.employee_team ?? '', 16), cols2[5].x, py);
          doc.text(trunc(a.employee_tower ?? '', 10), cols2[6].x, py);
          doc.text(trunc(a.pickup_location ?? '', 22), cols2[7].x, py);
          doc.text(a.pickup_time ?? '', cols2[8].x, py);
          doc.text(a.drop_time ?? '', cols2[9].x, py);
          doc.setDrawColor(230);
          doc.line(10, py + 2, pageW - 10, py + 2);
          py += 7;
        });
      });

      doc.save(`trips_${date}_${vendor?.company_name?.replace(/\s+/g, '_') ?? 'export'}.pdf`);
      toast.success('PDF exported successfully');
    });
  };

  const toggleExpand = (rn: string) =>
    setExpanded(s => { const n = new Set(s); n.has(rn) ? n.delete(rn) : n.add(rn); return n; });

  const activeModalRoute = driverModal
    ? routesWithTrips.find(r => r.route_number === driverModal.routeNumber)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">Vendor Portal</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {vendor?.company_name ?? '...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={handleExcelExport}
              disabled={!routesWithTrips.length}
              title="Export to Excel"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-teal-300 dark:hover:border-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Excel</span>
            </button>
            <button
              onClick={handlePDFExport}
              disabled={!routesWithTrips.length}
              title="Export to PDF"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-teal-300 dark:hover:border-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden md:inline">PDF</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-200 dark:hover:border-red-800 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile date picker */}
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── Summary bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Trips for {new Date(date + 'T12:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </h1>
            {!isLoading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {routeCount} {routeCount === 1 ? 'route' : 'routes'} &middot; {totalPassengers} passengers
                {submissions.length > 0 && (
                  <span className="ml-2 text-teal-600 dark:text-teal-400 font-medium">
                    &middot; {submissions.length} driver{submissions.length > 1 ? 's' : ''} assigned
                  </span>
                )}
              </p>
            )}
          </div>

          {!isLoading && routeCount > 0 && (
            <div className="flex gap-2 flex-wrap">
              {['Morning', 'Afternoon', 'Night'].map(shift => {
                const cnt = assignments.filter(a => a.shift === shift).length;
                if (!cnt) return null;
                return (
                  <span key={shift} className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', shiftColor(shift))}>
                    <Clock className="w-3 h-3" />{shift}: {cnt}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="font-medium text-gray-700 dark:text-gray-300">Failed to load trips</p>
          </div>
        )}

        {/* ── Empty: no routes assigned ── */}
        {!isLoading && !isError && routes.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">No routes assigned</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Contact the admin to assign routes to your company.</p>
          </div>
        )}

        {/* ── Empty: routes exist but no trips today ── */}
        {!isLoading && !isError && routes.length > 0 && routesWithTrips.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">No trips on this date</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              You have {routes.length} assigned {routes.length === 1 ? 'route' : 'routes'}, but no trips were generated for this date.
            </p>
          </div>
        )}

        {/* ── Trip cards ── */}
        {!isLoading && !isError && routesWithTrips.length > 0 && (
          <div className="space-y-3">
            {routesWithTrips.map(route => {
              const passengers = (byRoute[route.route_number] ?? [])
                .slice().sort((a, b) => (a.pickup_order ?? 0) - (b.pickup_order ?? 0));
              const isOpen = expanded.has(route.route_number);
              const utilPct = route.vehicle_capacity > 0
                ? Math.round((passengers.length / route.vehicle_capacity) * 100) : 0;
              const firstPickup = passengers[0]?.pickup_time;
              const driver = submissionsByRoute[route.route_number] ?? null;

              const shiftGroups = passengers.reduce<Record<string, typeof passengers>>((acc, a) => {
                const s = a.shift ?? 'Morning';
                if (!acc[s]) acc[s] = [];
                acc[s].push(a);
                return acc;
              }, {});

              return (
                <div
                  key={route.route_number}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* ── Card header ── */}
                  <div className="px-5 py-4 flex items-start gap-4">
                    <button
                      onClick={() => toggleExpand(route.route_number)}
                      className="flex items-center gap-4 flex-1 min-w-0 text-left"
                    >
                      <div className="w-11 h-11 bg-teal-50 dark:bg-teal-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Bus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{route.route_number}</span>
                          <span className="font-semibold text-gray-900 dark:text-white truncate">{route.route_name}</span>
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', shiftColor(route.shift))}>
                            {route.shift}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{passengers.length} passengers</span>
                          <span className="flex items-center gap-1"><Bus className="w-3 h-3" />{route.vehicle_type}</span>
                          {firstPickup && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />First pickup: {firstPickup}</span>}
                        </div>
                      </div>
                    </button>

                    {/* Utilization + expand */}
                    <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={cn('text-sm font-bold', utilPct > 90 ? 'text-red-500' : utilPct > 70 ? 'text-amber-500' : 'text-teal-600 dark:text-teal-400')}>
                        {utilPct}%
                      </span>
                      <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', utilPct > 90 ? 'bg-red-500' : utilPct > 70 ? 'bg-amber-500' : 'bg-teal-500')}
                          style={{ width: `${Math.min(100, utilPct)}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(route.route_number)}
                      className="flex-shrink-0 text-gray-400 p-1"
                    >
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* ── Driver details strip ── */}
                  <div className={cn(
                    'mx-5 mb-4 rounded-xl border px-4 py-3',
                    driver
                      ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
                      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 border-dashed'
                  )}>
                    {driver ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-4 flex-wrap text-sm">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                            <span className="font-semibold text-teal-700 dark:text-teal-300">Driver Assigned</span>
                          </div>
                          <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                            <UserCircle className="w-3.5 h-3.5 text-gray-400" />{driver.driver_name}
                          </span>
                          <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />{driver.driver_phone}
                          </span>
                          <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                            <Car className="w-3.5 h-3.5 text-gray-400" />{driver.vehicle_number}
                            {driver.vehicle_model && <span className="text-gray-400">({driver.vehicle_model})</span>}
                          </span>
                        </div>
                        <button
                          onClick={() => setDriverModal({ routeNumber: route.route_number, routeName: route.route_name })}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors font-medium"
                        >
                          <Pencil className="w-3 h-3" />Edit
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Driver details not submitted</p>
                          <p className="text-xs text-amber-600/70 dark:text-amber-500/70 mt-0.5">Add the driver and vehicle info for this trip</p>
                        </div>
                        <button
                          onClick={() => setDriverModal({ routeNumber: route.route_number, routeName: route.route_name })}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg transition-colors font-semibold whitespace-nowrap"
                        >
                          <UserCircle className="w-3.5 h-3.5" />
                          Add Driver
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Expanded passenger table ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {Object.entries(shiftGroups).map(([shift, pax]) => (
                        <div key={shift}>
                          <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', shiftColor(shift))}>{shift}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{pax.length} passengers</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50/50 dark:bg-gray-700/20 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                  <th className="px-4 py-2.5 text-left w-10">#</th>
                                  <th className="px-4 py-2.5 text-left">Employee</th>
                                  <th className="px-4 py-2.5 text-left hidden md:table-cell">ID</th>
                                  <th className="px-4 py-2.5 text-left hidden lg:table-cell">Phone</th>
                                  <th className="px-4 py-2.5 text-left hidden lg:table-cell">Pickup Location</th>
                                  <th className="px-4 py-2.5 text-left">Pickup Time</th>
                                  <th className="px-4 py-2.5 text-left hidden xl:table-cell">Drop Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {pax.map(a => (
                                  <tr key={a.employee_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-bold flex items-center justify-center">
                                        {a.pickup_order}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-gray-800 dark:text-gray-200">{a.employee_name}</span>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <span className="text-xs font-mono text-gray-400">{a.employee_id}</span>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <Phone className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                        {a.employee_phone || <span className="italic text-gray-300">—</span>}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs">
                                        <MapPin className="w-3 h-3 flex-shrink-0 text-teal-500" />
                                        {a.pickup_location}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{a.pickup_time}</span>
                                    </td>
                                    <td className="px-4 py-3 hidden xl:table-cell">
                                      <span className="text-xs text-gray-400">{a.drop_time}</span>
                                    </td>
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

      {/* ── Driver details modal ── */}
      {driverModal && activeModalRoute && (
        <DriverModal
          routeNumber={driverModal.routeNumber}
          routeName={activeModalRoute.route_name}
          existing={submissionsByRoute[driverModal.routeNumber] ?? null}
          loading={submitMutation.isPending}
          onClose={() => setDriverModal(null)}
          onSubmit={form => submitMutation.mutate({ ...form, routeNumber: driverModal.routeNumber })}
        />
      )}
    </div>
  );
}
