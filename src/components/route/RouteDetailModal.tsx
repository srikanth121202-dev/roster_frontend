import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, MapPin, Users, Clock, Bus, Building2, Navigation,
  AlertTriangle, Loader2, Download, Settings,
} from 'lucide-react';
import { assignmentService, settingsService } from '../../services';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import type { Route } from '../../types';
import { cn, getShiftColor, getStatusColor } from '../../utils/helpers';
import { toast } from 'sonner';

interface Props {
  route: Route | null;
  date: string;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gm = () => (window as any).google?.maps as any;

export default function RouteDetailModal({ route, date, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
    staleTime: 60000,
  });

  const apiKey = (settings.google_api_key as string | undefined) || undefined;
  const { isLoaded, isLoading: mapsLoading, hasError: mapsError } = useGoogleMaps(apiKey);

  const { data: stops = [], isLoading: stopsLoading } = useQuery({
    queryKey: ['routeStops', route?.route_number, date],
    queryFn: () => assignmentService.getByRoute(route!.route_number, date),
    enabled: !!route,
  });

  const officeLat = parseFloat(settings.office_lat ?? '0');
  const officeLng = parseFloat(settings.office_lng ?? '0');
  const officeAddress = settings.office_address ?? 'Office';
  const hasOffice = officeLat !== 0 && officeLng !== 0;
  const validStops = stops.filter(s => s.lat !== 0 && s.lng !== 0);

  // Render / update the Google Map whenever data or load state changes
  useEffect(() => {
    const maps = gm();
    if (!isLoaded || !maps || !mapRef.current) return;
    if (validStops.length === 0 && !hasOffice) return;

    const map = new maps.Map(mapRef.current, {
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative',
    });

    const bounds = new maps.LatLngBounds();
    if (hasOffice) bounds.extend({ lat: officeLat, lng: officeLng });
    validStops.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });

    // Office marker (blue — destination)
    if (hasOffice) {
      const officeMarker = new maps.Marker({
        position: { lat: officeLat, lng: officeLng },
        map,
        title: 'Office (Destination)',
        zIndex: 200,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
        label: { text: 'D', color: '#fff', fontSize: '10px', fontWeight: 'bold' },
      });
      const officeInfoWindow = new maps.InfoWindow({
        content: `<div style="font-family:system-ui;padding:6px 2px;">
          <div style="font-weight:700;font-size:13px;color:#1e293b;">Office</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${officeAddress}</div>
          <div style="font-size:11px;color:#3b82f6;margin-top:4px;font-weight:600;">Destination</div>
        </div>`,
      });
      officeMarker.addListener('click', () => officeInfoWindow.open(map, officeMarker));
    }

    // Employee pickup markers (numbered, green)
    validStops.forEach(stop => {
      const marker = new maps.Marker({
        position: { lat: stop.lat, lng: stop.lng },
        map,
        title: stop.employee_name,
        zIndex: 100 + stop.pickup_order,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
        label: {
          text: String(stop.pickup_order),
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 'bold',
        },
      });

      const infoContent = `<div style="font-family:system-ui;padding:6px 2px;min-width:160px;">
        <div style="font-weight:700;font-size:13px;color:#1e293b;">Stop ${stop.pickup_order}: ${stop.employee_name}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${stop.employee_id}</div>
        ${stop.team ? `<div style="font-size:11px;color:#64748b;">${stop.team}${stop.tower ? ` · ${stop.tower}` : ''}</div>` : ''}
        <div style="font-size:11px;color:#475569;margin-top:4px;">${stop.address || stop.pickup_location}</div>
        <div style="font-size:11px;color:#22c55e;margin-top:4px;font-weight:600;">Pickup: ${stop.pickup_time}</div>
      </div>`;
      const iw = new maps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => iw.open(map, marker));
    });

    if (validStops.length === 0) return;

    // Attempt Directions API for route polyline
    const directionsService = new maps.DirectionsService();
    const directionsRenderer = new maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 3.5, strokeOpacity: 0.8 },
    });
    directionsRenderer.setMap(map);

    const allWaypoints = hasOffice ? validStops : validStops.slice(0, -1);
    const origin = new maps.LatLng(validStops[0].lat, validStops[0].lng);
    const destination = hasOffice
      ? { lat: officeLat, lng: officeLng }
      : new maps.LatLng(validStops[validStops.length - 1].lat, validStops[validStops.length - 1].lng);

    const waypoints = allWaypoints.slice(1).slice(0, 23).map((s: { lat: number; lng: number }) => ({
      location: new maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    directionsService.route(
      { origin, destination, waypoints, travelMode: maps.TravelMode.DRIVING },
      (result: unknown, status: string) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
        } else {
          // Fallback: straight-line polyline
          const path = [
            ...validStops.map((s: { lat: number; lng: number }) => ({ lat: s.lat, lng: s.lng })),
            ...(hasOffice ? [{ lat: officeLat, lng: officeLng }] : []),
          ];
          new maps.Polyline({
            path, map,
            geodesic: true,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            icons: [{
              icon: { path: maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 3 },
              offset: '50%',
            }],
          });
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, stops, officeLat, officeLng]);

  const handleExport = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.aoa_to_sheet([
        [`Trip Plan — ${route?.route_name} (${route?.route_number}) — ${date}`],
        [],
        ['Stop #', 'Employee ID', 'Employee Name', 'Team', 'Tower', 'Pickup Location', 'Address', 'Pickup Time', 'Drop Time'],
        ...stops.map(s => [
          s.pickup_order, s.employee_id, s.employee_name, s.team, s.tower,
          s.pickup_location, s.address, s.pickup_time, s.drop_time,
        ]),
        [],
        ['', '', '', '', '', 'Office (Destination)', officeAddress],
      ]);
      ws['!cols'] = [{ wch: 7 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 12 }];
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Trip Plan');
      writeFile(wb, `trip_plan_${route?.route_number}_${date}.xlsx`);
      toast.success('Trip plan exported');
    });
  };

  if (!route) return null;

  const utilization = route.vehicle_capacity > 0
    ? Math.round((route.assigned_employees / route.vehicle_capacity) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white dark:bg-secondary-900 rounded-2xl w-full max-w-7xl flex flex-col shadow-2xl my-4 overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-secondary-100 dark:border-secondary-800 bg-white dark:bg-secondary-900 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Navigation className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded-md">{route.route_number}</span>
                <h2 className="text-base font-bold text-secondary-900 dark:text-white">{route.route_name}</h2>
                <span className={cn('badge text-xs', getShiftColor(route.shift))}>{route.shift}</span>
                <span className={cn('badge text-xs', getStatusColor(route.status))}>{route.status}</span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-secondary-500 dark:text-secondary-400 flex-wrap">
                <span className="flex items-center gap-1"><Bus className="w-3.5 h-3.5" />{route.vehicle_type}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{route.assigned_employees}/{route.vehicle_capacity} seats ({utilization}%)</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{date}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={handleExport} disabled={stops.length === 0} className="btn-secondary text-xs py-1.5 px-3">
              <Download className="w-3.5 h-3.5" /> Export Plan
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-700 text-secondary-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="h-1 bg-secondary-100 dark:bg-secondary-800">
          <div
            className={cn('h-full transition-all', utilization > 90 ? 'bg-error-500' : utilization > 70 ? 'bg-warning-500' : 'bg-primary-500')}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex overflow-hidden" style={{ height: '75vh' }}>

          {/* ── Left: Trip Plan Timeline ── */}
          <div className="w-[320px] flex-shrink-0 border-r border-secondary-100 dark:border-secondary-800 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">
                Trip Plan — {stops.length} stop{stops.length !== 1 ? 's' : ''}
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {stopsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : stops.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MapPin className="w-8 h-8 text-secondary-300 mb-3" />
                  <p className="text-sm text-secondary-400">No assignments for {date}.</p>
                  <p className="text-xs text-secondary-400 mt-1">Generate routes first.</p>
                </div>
              ) : (
                <div>
                  {stops.map((stop, idx) => (
                    <div key={stop.employee_id} className="flex gap-3">
                      {/* Step indicator */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-7 h-7 rounded-full bg-success-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                          {stop.pickup_order}
                        </div>
                        {idx < stops.length - 1 && (
                          <div className="w-px flex-1 bg-secondary-200 dark:bg-secondary-700 my-1 min-h-[20px]" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={cn('pb-4 flex-1 min-w-0', idx < stops.length - 1 && 'mb-0')}>
                        <div className="bg-secondary-50 dark:bg-secondary-800/60 rounded-xl p-3 hover:bg-secondary-100 dark:hover:bg-secondary-700/60 transition-colors cursor-default">
                          <p className="font-semibold text-secondary-900 dark:text-white text-sm leading-tight truncate">{stop.employee_name}</p>
                          <p className="text-xs text-secondary-400 mt-0.5 font-mono">{stop.employee_id}</p>
                          {(stop.team || stop.tower) && (
                            <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">
                              {[stop.team, stop.tower].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <div className="flex items-start gap-1 mt-1.5">
                            <MapPin className="w-3 h-3 text-secondary-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-secondary-500 dark:text-secondary-400 leading-snug">{stop.address || stop.pickup_location}</p>
                          </div>
                          {!stop.lat && !stop.lng && (
                            <p className="text-[10px] text-warning-600 dark:text-warning-400 mt-1">Not geocoded — not shown on map</p>
                          )}
                          <div className="flex items-center gap-1 mt-2">
                            <Clock className="w-3 h-3 text-success-600 dark:text-success-400" />
                            <span className="text-xs text-success-700 dark:text-success-400 font-medium">Pickup {stop.pickup_time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Office destination */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center shadow-sm">
                        <Building2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                    <div className="pb-2 flex-1">
                      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 border border-primary-100 dark:border-primary-800">
                        <p className="font-semibold text-primary-700 dark:text-primary-400 text-sm">Office (Destination)</p>
                        <div className="flex items-start gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-primary-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-primary-600 dark:text-primary-400 leading-snug">{officeAddress}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Google Map ── */}
          <div className="flex-1 relative bg-secondary-100 dark:bg-secondary-800">
            {!apiKey ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-14 h-14 bg-warning-50 dark:bg-warning-900/20 rounded-2xl flex items-center justify-center">
                  <Settings className="w-7 h-7 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <p className="font-semibold text-secondary-700 dark:text-secondary-200">Google Maps API Key Required</p>
                  <p className="text-sm text-secondary-400 mt-1 max-w-xs">
                    Go to <strong>Settings → Google Maps</strong> and add your API key to enable the live map and route directions.
                  </p>
                </div>
              </div>
            ) : mapsError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-error-400" />
                <p className="font-semibold text-secondary-700 dark:text-secondary-200">Failed to Load Google Maps</p>
                <p className="text-sm text-secondary-400">Check your API key in Settings and ensure the Maps JavaScript API is enabled.</p>
              </div>
            ) : mapsLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <p className="text-sm text-secondary-400">Loading Google Maps...</p>
              </div>
            ) : stopsLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : validStops.length === 0 && !hasOffice ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
                <MapPin className="w-10 h-10 text-secondary-300" />
                <p className="font-semibold text-secondary-500">No geocoded locations</p>
                <p className="text-sm text-secondary-400 max-w-xs">
                  Employee lat/lng coordinates are required to display the map. Update employee addresses with coordinates.
                </p>
              </div>
            ) : (
              // Map container — key forces remount when stops change
              <div
                key={`${route.route_number}-${date}-${stops.length}`}
                ref={mapRef}
                className="w-full h-full"
              />
            )}

            {/* Legend overlay */}
            {isLoaded && validStops.length > 0 && (
              <div className="absolute bottom-4 left-4 bg-white dark:bg-secondary-800 rounded-xl shadow-lg p-3 border border-secondary-100 dark:border-secondary-700 z-10">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-secondary-600 dark:text-secondary-300">
                    <div className="w-5 h-5 rounded-full bg-success-500 flex items-center justify-center text-white text-[9px] font-bold">1</div>
                    Pickup Stop
                  </div>
                  <div className="flex items-center gap-2 text-xs text-secondary-600 dark:text-secondary-300">
                    <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center text-white text-[9px] font-bold">D</div>
                    Destination
                  </div>
                  <div className="flex items-center gap-2 text-xs text-secondary-600 dark:text-secondary-300">
                    <div className="w-8 h-0.5 bg-primary-500 rounded" />
                    Route
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
