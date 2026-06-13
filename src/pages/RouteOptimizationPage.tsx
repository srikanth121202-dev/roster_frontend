import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Navigation, Clock, Route, Bus,
  Info, Eye, Calendar, Users, Layers,
  ChevronRight, Download, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { routeService, assignmentService, settingsService } from '../services';
import { supabase } from '../lib/supabase';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { cn, getShiftColor } from '../utils/helpers';
import RouteDetailModal from '../components/route/RouteDetailModal';
import type { Route as RouteType } from '../types';

const ROUTE_COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#ef4444',
  '#a855f7', '#f59e0b', '#06b6d4', '#ec4899',
];

const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1e2a3a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0e1626' }] },
];

// ── SVG fallback (no API key) ─────────────────────────────────────────────────

function SvgMapFallback({ message }: { message: string }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-secondary-50 dark:bg-secondary-900/50 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-secondary-100 dark:bg-secondary-800 flex items-center justify-center mb-4">
        <MapPin className="w-8 h-8 text-secondary-300 dark:text-secondary-600" />
      </div>
      <p className="text-secondary-600 dark:text-secondary-400 text-sm font-medium max-w-xs">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RouteOptimizationPage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [detailRoute, setDetailRoute] = useState<RouteType | null>(null);

  const { isLoaded: mapsLoaded, hasError: mapsError } = useGoogleMaps();

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
    staleTime: 60000,
  });

  const { data: dbRoutes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: routeService.getAll,
  });

  const { data: rawAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', selectedDate],
    queryFn: () => assignmentService.getByDate(selectedDate),
  });

  // Fetch employee coordinates for every employee in these assignments
  const empIds = useMemo(() => [...new Set(rawAssignments.map(a => a.employee_id as string))], [rawAssignments]);

  const { data: empCoords = [] } = useQuery({
    queryKey: ['empCoords', empIds.join(',')],
    queryFn: async () => {
      if (empIds.length === 0) return [];
      const { data } = await supabase
        .from('employees')
        .select('employee_id, lat, lng, location, address, name')
        .in('employee_id', empIds);
      return data ?? [];
    },
    enabled: empIds.length > 0,
  });

  const empMap = useMemo(
    () => Object.fromEntries(empCoords.map(e => [e.employee_id, e])),
    [empCoords],
  );

  // Group assignments by route_number, sorted by pickup_order
  const routeGroups = useMemo(() => {
    const groups: Record<string, typeof rawAssignments> = {};
    for (const a of rawAssignments) {
      const key = a.route_number as string;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    // Sort each group by pickup_order
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (a.pickup_order as number) - (b.pickup_order as number));
    }
    return groups;
  }, [rawAssignments]);

  const officeLat = parseFloat(settings.office_lat ?? '17.4152');
  const officeLng = parseFloat(settings.office_lng ?? '78.3516');
  const apiKeySet = !!(settings.google_api_key);

  // ── Google Map refs & lifecycle ─────────────────────────────────────────────

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef  = useRef<any>(null);
  const polylinesRef    = useRef<any[]>([]);
  const markersRef      = useRef<any[]>([]);
  const infoWindowRef   = useRef<any>(null);

  // Initialise map once
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google.maps;
    const isDark = document.documentElement.classList.contains('dark');
    mapInstanceRef.current = new g.Map(mapContainerRef.current, {
      center: { lat: officeLat, lng: officeLng },
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: isDark ? DARK_MAP_STYLES : [],
    });
    infoWindowRef.current = new g.InfoWindow();
  }, [mapsLoaded, officeLat, officeLng]);

  // Re-draw whenever data or filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google.maps;

    // Clear previous overlays
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Office marker
    const officeMarker = new g.Marker({
      position: { lat: officeLat, lng: officeLng },
      map: mapInstanceRef.current,
      zIndex: 9999,
      title: settings.office_address ?? 'Office',
      icon: {
        path: g.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#f97316',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      label: { text: 'HQ', color: '#ffffff', fontSize: '10px', fontWeight: '700' },
    });
    officeMarker.addListener('click', () => {
      infoWindowRef.current.setContent(
        `<div style="padding:6px;font-family:sans-serif;font-size:13px;"><strong>Office</strong><br><span style="color:#555;">${settings.office_address ?? ''}</span></div>`,
      );
      infoWindowRef.current.open({ anchor: officeMarker, map: mapInstanceRef.current });
    });
    markersRef.current.push(officeMarker);

    if (Object.keys(routeGroups).length === 0) return;

    const bounds = new g.LatLngBounds();
    bounds.extend({ lat: officeLat, lng: officeLng });

    let routeIdx = 0;
    for (const [routeNumber, routeAssignments] of Object.entries(routeGroups)) {
      const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
      const isHighlighted = !selectedRoute || selectedRoute === routeNumber;
      const opacity = isHighlighted ? 1 : 0.15;
      routeIdx++;

      const validStops = routeAssignments.filter(a => {
        const e = empMap[a.employee_id as string];
        return e?.lat && e?.lng;
      });

      // Polyline: office → stops → office
      const path = [
        { lat: officeLat, lng: officeLng },
        ...validStops.map(s => {
          const e = empMap[s.employee_id as string];
          return { lat: e.lat as number, lng: e.lng as number };
        }),
        { lat: officeLat, lng: officeLng },
      ];

      const polyline = new g.Polyline({
        path,
        strokeColor: color,
        strokeWeight: isHighlighted ? 4 : 2,
        strokeOpacity: isHighlighted ? 0.85 : 0.2,
        icons: isHighlighted ? [{
          icon: { path: g.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: color },
          offset: '50%',
        }] : [],
        map: mapInstanceRef.current,
        zIndex: isHighlighted ? 10 : 1,
      });
      polylinesRef.current.push(polyline);

      // Employee markers
      validStops.forEach((stop, i) => {
        const e = empMap[stop.employee_id as string];
        bounds.extend({ lat: e.lat as number, lng: e.lng as number });

        const marker = new g.Marker({
          position: { lat: e.lat, lng: e.lng },
          map: mapInstanceRef.current,
          title: stop.employee_name as string,
          zIndex: isHighlighted ? 100 : 5,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: color,
            fillOpacity: opacity,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
          label: {
            text: String(i + 1),
            color: '#ffffff',
            fontSize: '8px',
            fontWeight: '700',
          },
        });

        marker.addListener('click', () => {
          const content = `
            <div style="padding:6px 2px;min-width:200px;font-family:sans-serif;">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${stop.employee_name}</div>
              <div style="display:flex;gap:16px;font-size:12px;color:#555;">
                <span>Stop #${i + 1}</span>
                <span>${routeNumber}</span>
                <span>${stop.shift ?? ''}</span>
              </div>
              <div style="font-size:12px;color:#555;margin-top:4px;">
                Pickup: <strong>${stop.pickup_time ?? '—'}</strong> &nbsp; Drop: <strong>${stop.drop_time ?? '—'}</strong>
              </div>
              ${(e.address || e.location) ? `<div style="font-size:11px;color:#888;margin-top:4px;">${e.address || e.location}</div>` : ''}
            </div>`;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open({ anchor: marker, map: mapInstanceRef.current });
        });

        markersRef.current.push(marker);
      });
    }

    if (!bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds, 60);
    }
  }, [routeGroups, empMap, selectedRoute, mapsLoaded, officeLat, officeLng, settings.office_address]);

  // ── Derived sidebar data ────────────────────────────────────────────────────

  const routeKeys = Object.keys(routeGroups);
  const totalEmployees = rawAssignments.length;
  const shifts = [...new Set(rawAssignments.map(a => a.shift as string).filter(Boolean))];

  // Build sidebar route objects
  const sidebarRoutes = useMemo(() => {
    return routeKeys.map((rn, idx) => {
      const assignments = routeGroups[rn];
      const dbRoute = dbRoutes.find(r => r.route_number === rn);
      const shift = assignments[0]?.shift as string ?? '—';
      const validCoords = assignments.filter(a => empMap[a.employee_id as string]?.lat).length;
      return {
        route_number: rn,
        route_name: dbRoute?.route_name ?? rn,
        color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        employeeCount: assignments.length,
        shift,
        vehicle_capacity: dbRoute?.vehicle_capacity ?? 0,
        hasCoords: validCoords > 0,
        dbRoute: dbRoute ?? null,
      };
    });
  }, [routeKeys, routeGroups, dbRoutes, empMap]);

  // ── Export handlers ─────────────────────────────────────────────────────────

  const handleExcelExport = () => {
    if (!sidebarRoutes.length) return toast.error('No route data to export');
    import('xlsx').then(({ utils, writeFile }) => {
      // Sheet 1 — Route Summary
      const summaryRows = sidebarRoutes.map(r => ({
        'Route No.': r.route_number,
        'Route Name': r.route_name,
        'Shift': r.shift,
        'Vehicle Type': r.dbRoute?.vehicle_type ?? '',
        'Capacity': r.vehicle_capacity,
        'Employees Assigned': r.employeeCount,
        'Occupancy %': r.vehicle_capacity > 0 ? Math.round((r.employeeCount / r.vehicle_capacity) * 100) + '%' : '—',
        'Status': r.dbRoute?.status ?? '',
        'Coordinates Available': routeGroups[r.route_number]?.filter(a => empMap[a.employee_id as string]?.lat).length ?? 0,
      }));
      const ws1 = utils.json_to_sheet(summaryRows);
      ws1['!cols'] = [10, 28, 12, 14, 10, 18, 12, 10, 22].map(wch => ({ wch }));

      // Sheet 2 — Stop Sequence (all routes)
      const stopRows: Record<string, unknown>[] = [];
      sidebarRoutes.forEach(r => {
        const stops = (routeGroups[r.route_number] ?? [])
          .slice().sort((a, b) => (a.pickup_order as number) - (b.pickup_order as number));
        stops.forEach(s => {
          const e = empMap[s.employee_id as string];
          stopRows.push({
            'Route No.': r.route_number,
            'Route Name': r.route_name,
            'Shift': s.shift,
            'Stop #': s.pickup_order,
            'Employee ID': s.employee_id,
            'Employee Name': s.employee_name,
            'Pickup Location': s.pickup_location,
            'Pickup Time': s.pickup_time,
            'Drop Location': s.drop_location ?? '',
            'Drop Time': s.drop_time,
            'Home Locality': e?.location ?? '',
            'Address': e?.address ?? '',
            'Latitude': e?.lat ?? '',
            'Longitude': e?.lng ?? '',
          });
        });
      });
      const ws2 = utils.json_to_sheet(stopRows);
      ws2['!cols'] = [10, 28, 12, 8, 14, 24, 28, 12, 28, 12, 20, 36, 12, 12].map(wch => ({ wch }));

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws1, 'Route Summary');
      utils.book_append_sheet(wb, ws2, 'Stop Sequence');
      writeFile(wb, `route_optimization_${selectedDate}.xlsx`);
      toast.success('Excel exported successfully');
    });
  };

  const handlePDFExport = () => {
    if (!sidebarRoutes.length) return toast.error('No route data to export');
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ orientation: 'landscape' });
      const pageW = 277;
      const displayDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      const addHeader = (title: string, sub: string) => {
        doc.setFillColor(37, 99, 235);
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

      const trunc = (s: string | null | undefined, max: number) =>
        (s ?? '').length > max ? (s ?? '').substring(0, max - 1) + '…' : (s ?? '');

      // ── Page 1: Route Summary ──
      addHeader('Route Optimization Summary', displayDate);

      const cols1 = [
        { label: 'ROUTE NO.', x: 10 },
        { label: 'ROUTE NAME', x: 33 },
        { label: 'SHIFT', x: 88 },
        { label: 'VEHICLE', x: 108 },
        { label: 'CAPACITY', x: 130 },
        { label: 'ASSIGNED', x: 148 },
        { label: 'OCCUPANCY', x: 166 },
        { label: 'STATUS', x: 192 },
        { label: 'STOPS W/ COORDS', x: 213 },
      ];

      let hy = 22;
      doc.setFontSize(7.5);
      doc.setTextColor(80);
      doc.setFont('helvetica', 'bold');
      cols1.forEach(c => doc.text(c.label, c.x, hy));
      doc.setLineWidth(0.3);
      doc.setDrawColor(180);
      doc.line(10, hy + 2, pageW - 10, hy + 2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      let y = hy + 7;

      sidebarRoutes.forEach(r => {
        if (y > 192) { doc.addPage(); addHeader('Route Summary (cont.)', displayDate); y = 22; }
        const util = r.vehicle_capacity > 0 ? Math.round((r.employeeCount / r.vehicle_capacity) * 100) : 0;
        const coordCount = routeGroups[r.route_number]?.filter(a => empMap[a.employee_id as string]?.lat).length ?? 0;

        doc.text(r.route_number, cols1[0].x, y);
        doc.text(trunc(r.route_name, 28), cols1[1].x, y);
        doc.text(r.shift, cols1[2].x, y);
        doc.text(trunc(r.dbRoute?.vehicle_type ?? '', 10), cols1[3].x, y);
        doc.text(r.vehicle_capacity > 0 ? String(r.vehicle_capacity) : '—', cols1[4].x, y);
        doc.text(String(r.employeeCount), cols1[5].x, y);
        if (util > 90) doc.setTextColor(220, 38, 38);
        else if (util > 70) doc.setTextColor(217, 119, 6);
        else doc.setTextColor(22, 163, 74);
        doc.text(r.vehicle_capacity > 0 ? `${util}%` : '—', cols1[6].x, y);
        doc.setTextColor(0);
        doc.text(r.dbRoute?.status ?? '', cols1[7].x, y);
        doc.text(`${coordCount} / ${r.employeeCount}`, cols1[8].x, y);
        doc.setDrawColor(220);
        doc.line(10, y + 2, pageW - 10, y + 2);
        y += 7;
      });

      // ── Per-route stop pages ──
      sidebarRoutes.forEach(r => {
        const stops = (routeGroups[r.route_number] ?? [])
          .slice().sort((a, b) => (a.pickup_order as number) - (b.pickup_order as number));
        if (!stops.length) return;

        doc.addPage();
        addHeader(
          `${r.route_number} — ${r.route_name}`,
          `${r.shift}  |  ${r.dbRoute?.vehicle_type ?? ''}  |  ${stops.length}/${r.vehicle_capacity} seats  |  ${displayDate}`,
        );

        const cols2 = [
          { label: 'STOP', x: 10 },
          { label: 'EMPLOYEE NAME', x: 22 },
          { label: 'EMP ID', x: 76 },
          { label: 'PICKUP LOCATION', x: 104 },
          { label: 'PICKUP TIME', x: 180 },
          { label: 'DROP TIME', x: 207 },
          { label: 'HOME LOCALITY', x: 225 },
        ];

        let sy = 22;
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

        stops.forEach((s, idx) => {
          if (py > 195) {
            doc.addPage();
            addHeader(`${r.route_number} — ${r.route_name} (cont.)`, displayDate);
            py = 22;
          }
          const e = empMap[s.employee_id as string];
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(10, py - 5, pageW - 20, 6.5, 'F');
          }
          doc.setFontSize(7.5);
          doc.text(String(s.pickup_order), cols2[0].x, py);
          doc.text(trunc(s.employee_name as string, 28), cols2[1].x, py);
          doc.text(trunc(s.employee_id as string, 14), cols2[2].x, py);
          doc.text(trunc(s.pickup_location as string, 36), cols2[3].x, py);
          doc.text(s.pickup_time as string ?? '', cols2[4].x, py);
          doc.text(s.drop_time as string ?? '', cols2[5].x, py);
          doc.text(trunc(e?.location ?? '', 20), cols2[6].x, py);
          doc.setDrawColor(230);
          doc.line(10, py + 2, pageW - 10, py + 2);
          py += 7;
        });
      });

      doc.save(`route_optimization_${selectedDate}.pdf`);
      toast.success('PDF exported successfully');
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const showMap = mapsLoaded && apiKeySet;
  const mapHeight = 'h-[500px]';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Route Optimization</h1>
          <p className="page-subtitle">Google Maps view of all active routes for the selected date</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-secondary-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setSelectedRoute(null); }}
            className="input-field text-sm"
          />
          <button
            onClick={handleExcelExport}
            disabled={!sidebarRoutes.length}
            title="Export to Excel"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-secondary-200 dark:border-secondary-600 rounded-lg text-secondary-600 dark:text-secondary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:border-primary-300 dark:hover:border-primary-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handlePDFExport}
            disabled={!sidebarRoutes.length}
            title="Export to PDF"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-secondary-200 dark:border-secondary-600 rounded-lg text-secondary-600 dark:text-secondary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:border-primary-300 dark:hover:border-primary-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Routes',        value: routeKeys.length,   icon: Route, cls: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
          { label: 'Employees',     value: totalEmployees,     icon: Users, cls: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
          { label: 'Vehicles',      value: routeKeys.length,   icon: Bus,   cls: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-900/20' },
          { label: 'Shifts Active', value: shifts.length,      icon: Clock, cls: 'text-secondary-500',                    bg: 'bg-secondary-100 dark:bg-secondary-700' },
        ].map(({ label, value, icon: Icon, cls, bg }) => (
          <div key={label} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bg)}>
              <Icon className={cn('w-4 h-4', cls)} />
            </div>
            <p className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</p>
            <p className="text-xs text-secondary-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Map panel */}
        <div className="xl:col-span-2 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-secondary-100 dark:border-secondary-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary-500" />
              <span className="font-semibold text-secondary-900 dark:text-white text-sm">
                Route Map — {selectedDate}
              </span>
              {showMap && routeKeys.length > 0 && (
                <span className="text-xs text-secondary-400">
                  ({routeKeys.length} route{routeKeys.length !== 1 ? 's' : ''}, click marker for details)
                </span>
              )}
            </div>
            {selectedRoute && (
              <button
                onClick={() => setSelectedRoute(null)}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Show all routes
              </button>
            )}
          </div>

          <div className={cn('relative', mapHeight)}>
            {/* Google Map container */}
            <div
              ref={mapContainerRef}
              className={cn('w-full h-full', !showMap && 'hidden')}
            />

            {/* Loading state */}
            {(assignmentsLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-secondary-800/60 backdrop-blur-sm z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-sm text-secondary-500">Loading assignments…</p>
                </div>
              </div>
            )}

            {/* No assignments state */}
            {showMap && !assignmentsLoading && routeKeys.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 dark:bg-secondary-800/90 rounded-xl p-6 text-center shadow-lg max-w-xs">
                  <Layers className="w-8 h-8 text-secondary-300 dark:text-secondary-600 mx-auto mb-3" />
                  <p className="text-sm font-medium text-secondary-700 dark:text-secondary-300">No routes for {selectedDate}</p>
                  <p className="text-xs text-secondary-400 mt-1">Upload a roster and generate routes from the Roster → Transport tab.</p>
                </div>
              </div>
            )}

            {/* No API key fallback */}
            {!apiKeySet && !mapsError && (
              <SvgMapFallback message="Add a Google Maps API key in Settings → Google Maps to enable interactive route visualization." />
            )}

            {/* Maps error */}
            {mapsError && (
              <SvgMapFallback message="Google Maps failed to load. Check that your API key is valid and has the Maps JavaScript API enabled." />
            )}

            {/* Maps loading */}
            {apiKeySet && !mapsLoaded && !mapsError && (
              <div className="flex items-center justify-center h-full bg-secondary-50 dark:bg-secondary-900/50">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <p className="text-sm text-secondary-500">Loading Google Maps…</p>
                </div>
              </div>
            )}

            {/* Legend (bottom-left overlay) */}
            {showMap && sidebarRoutes.length > 0 && (
              <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-secondary-800/95 rounded-xl shadow-lg border border-secondary-100 dark:border-secondary-700 p-3 backdrop-blur-sm max-w-[180px]">
                <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mb-2 uppercase tracking-wide">Routes</p>
                <div className="space-y-1.5">
                  {sidebarRoutes.map(r => (
                    <button
                      key={r.route_number}
                      onClick={() => setSelectedRoute(selectedRoute === r.route_number ? null : r.route_number)}
                      className={cn(
                        'flex items-center gap-2 w-full text-left rounded-lg px-2 py-1 transition-colors',
                        selectedRoute === r.route_number
                          ? 'bg-secondary-100 dark:bg-secondary-700'
                          : 'hover:bg-secondary-50 dark:hover:bg-secondary-700/50',
                      )}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="text-xs text-secondary-700 dark:text-secondary-300 font-medium truncate">{r.route_number}</span>
                      <span className="text-xs text-secondary-400 ml-auto">{r.employeeCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Google Maps info tip */}
            {showMap && sidebarRoutes.length > 0 && (
              <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-secondary-800/95 rounded-lg shadow border border-secondary-100 dark:border-secondary-700 px-3 py-2 text-xs text-secondary-400 backdrop-blur-sm flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Click any marker for details
              </div>
            )}
          </div>
        </div>

        {/* Route sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">
              Routes on {selectedDate}
            </h3>
            {selectedRoute && (
              <button onClick={() => setSelectedRoute(null)} className="text-xs text-secondary-400 hover:text-secondary-600">
                Clear
              </button>
            )}
          </div>

          {sidebarRoutes.length === 0 ? (
            <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 text-center">
              <Route className="w-8 h-8 text-secondary-200 dark:text-secondary-700 mx-auto mb-2" />
              <p className="text-sm text-secondary-500">No routes generated for this date.</p>
            </div>
          ) : (
            sidebarRoutes.map(r => (
              <div
                key={r.route_number}
                onClick={() => setSelectedRoute(selectedRoute === r.route_number ? null : r.route_number)}
                className={cn(
                  'bg-white dark:bg-secondary-800 rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md group',
                  selectedRoute === r.route_number
                    ? 'border-primary-400 dark:border-primary-600 shadow-md ring-1 ring-primary-200 dark:ring-primary-800'
                    : 'border-secondary-100 dark:border-secondary-700 hover:border-secondary-200 dark:hover:border-secondary-600',
                )}
              >
                {/* Route header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="font-bold text-secondary-900 dark:text-white text-sm">{r.route_number}</span>
                  <span className={cn('badge text-xs ml-1', getShiftColor(r.shift))}>{r.shift}</span>
                </div>
                <p className="text-xs text-secondary-400 mb-3 truncate">{r.route_name}</p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{r.employeeCount} employees</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary-600 dark:text-secondary-400">
                    <Bus className="w-3.5 h-3.5" />
                    <span>{r.vehicle_capacity > 0 ? `${r.employeeCount}/${r.vehicle_capacity}` : `${r.employeeCount} seats`}</span>
                  </div>
                </div>

                {/* Capacity bar */}
                {r.vehicle_capacity > 0 && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', r.employeeCount / r.vehicle_capacity > 0.9 ? 'bg-error-500' : r.employeeCount / r.vehicle_capacity > 0.7 ? 'bg-warning-500' : 'bg-success-500')}
                        style={{ width: `${Math.min(100, (r.employeeCount / r.vehicle_capacity) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* View details button */}
                {r.dbRoute && (
                  <button
                    onClick={e => { e.stopPropagation(); setDetailRoute(r.dbRoute); }}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium group-hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View trip plan
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Office info card */}
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Navigation className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="font-semibold text-primary-800 dark:text-primary-300 text-sm">Office (Destination)</span>
            </div>
            <p className="text-xs text-primary-600 dark:text-primary-400 leading-relaxed">
              {settings.office_address ?? 'Not configured'}
            </p>
            <p className="text-xs text-primary-500 dark:text-primary-500 mt-1 font-mono">
              {officeLat}°N, {officeLng}°E
            </p>
          </div>

          {/* Maps tip */}
          {!apiKeySet && (
            <div className="flex items-start gap-2 p-3 bg-secondary-50 dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 text-xs text-secondary-500">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-secondary-400" />
              Add a Google Maps API key in Settings → Google Maps to see routes on an interactive map.
            </div>
          )}
        </div>
      </div>

      {/* Route Detail Modal */}
      {detailRoute && (
        <RouteDetailModal
          route={detailRoute}
          date={selectedDate}
          onClose={() => setDetailRoute(null)}
        />
      )}
    </div>
  );
}
