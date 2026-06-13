import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings, Map, Truck, Bell, Shield } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { settingsService } from '../services';
import { cn } from '../utils/helpers';
import { toast } from 'sonner';

const tabs = [
  { id: 'general',       label: 'General',      icon: Settings },
  { id: 'maps',          label: 'Google Maps',  icon: Map },
  { id: 'routes',        label: 'Route Config', icon: Truck },
  { id: 'notifications', label: 'Notifications',icon: Bell },
];

const defaultSettings = {
  company_name: 'TechCorp Hyderabad',
  office_address: 'Hyderabad Financial District, Nanakramguda, Hyderabad 500032',
  office_lat: '17.4152',
  office_lng: '78.3516',
  google_api_key: '',
  default_capacity: '20',
  default_vehicle_type: 'Bus',
  pickup_buffer_min: '5',
  drop_buffer_min: '5',
  office_arrival_morning: '09:00',
  office_arrival_afternoon: '14:00',
  office_arrival_night: '21:00',
  route_departure_buffer: '30',
  email_notifications: 'true',
  unassigned_alert: 'true',
  route_change_alert: 'true',
  daily_report_email: '',
  smtp_host: '',
  smtp_port: '587',
};

export default function SettingsPage() {
  const { theme, toggleTheme } = useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState(defaultSettings);

  const { data: dbSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  useEffect(() => {
    if (dbSettings) {
      setSettings(prev => ({ ...prev, ...dbSettings }));
    }
  }, [dbSettings]);

  const saveMutation = useMutation({
    mutationFn: () => settingsService.setMany(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings saved successfully');
    },
    onError: (err: Error) => toast.error('Save failed: ' + err.message),
  });

  const toggle = (key: string) =>
    setSettings(prev => ({ ...prev, [key]: prev[key as keyof typeof prev] === 'true' ? 'false' : 'true' }));

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure your Route Master application</p>
      </div>

      <div className="flex gap-1 bg-secondary-100 dark:bg-secondary-800 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
              activeTab === id
                ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 shadow-sm">

        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            <h2 className="text-base font-semibold text-secondary-900 dark:text-white">General Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-field">Company Name</label>
                <input className="input-field" value={settings.company_name} onChange={e => setSettings({ ...settings, company_name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Office Address</label>
                <input className="input-field" value={settings.office_address} onChange={e => setSettings({ ...settings, office_address: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Office Latitude</label>
                <input className="input-field" value={settings.office_lat} onChange={e => setSettings({ ...settings, office_lat: e.target.value })} />
              </div>
              <div>
                <label className="label-field">Office Longitude</label>
                <input className="input-field" value={settings.office_lng} onChange={e => setSettings({ ...settings, office_lng: e.target.value })} />
              </div>
            </div>
            <div className="border-t border-secondary-100 dark:border-secondary-700 pt-5">
              <h3 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Appearance
              </h3>
              <div className="flex items-center justify-between p-4 bg-secondary-50 dark:bg-secondary-700/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-secondary-800 dark:text-secondary-200">Dark Mode</p>
                  <p className="text-xs text-secondary-400">Toggle between light and dark theme</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={cn('relative w-12 h-6 rounded-full transition-colors duration-200', theme === 'dark' ? 'bg-primary-500' : 'bg-secondary-300')}
                >
                  <div className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200', theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maps' && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-secondary-900 dark:text-white">Google Maps Configuration</h2>
            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl">
              <p className="text-sm text-warning-800 dark:text-warning-300">
                A Google Maps API key is required for live map features. Enable the Maps JavaScript API, Directions API, and Geocoding API in your Google Cloud Console.
              </p>
            </div>
            <div>
              <label className="label-field">Google Maps API Key</label>
              <input
                type="password"
                className="input-field"
                value={settings.google_api_key}
                onChange={e => setSettings({ ...settings, google_api_key: e.target.value })}
                placeholder="AIza..."
              />
              <p className="text-xs text-secondary-400 mt-1">Stored securely in the database. Saved with the button below.</p>
            </div>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-secondary-900 dark:text-white">Route Configuration</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-field">Default Vehicle Capacity</label>
                <input type="number" className="input-field" value={settings.default_capacity} onChange={e => setSettings({ ...settings, default_capacity: e.target.value })} min={1} />
              </div>
              <div>
                <label className="label-field">Default Vehicle Type</label>
                <select className="input-field" value={settings.default_vehicle_type} onChange={e => setSettings({ ...settings, default_vehicle_type: e.target.value })}>
                  <option>Bus</option><option>Van</option><option>Car</option><option>Minibus</option>
                </select>
              </div>
              <div>
                <label className="label-field">Pickup Buffer Time (min)</label>
                <input type="number" className="input-field" value={settings.pickup_buffer_min} onChange={e => setSettings({ ...settings, pickup_buffer_min: e.target.value })} min={0} />
                <p className="text-xs text-secondary-400 mt-1">Extra time subtracted from computed pickup — gives employees buffer to board.</p>
              </div>
              <div>
                <label className="label-field">Drop Buffer Time (min)</label>
                <input type="number" className="input-field" value={settings.drop_buffer_min} onChange={e => setSettings({ ...settings, drop_buffer_min: e.target.value })} min={0} />
              </div>
            </div>

            <div className="border-t border-secondary-100 dark:border-secondary-700 pt-5">
              <h3 className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-1">Office Shift Arrival Times</h3>
              <p className="text-xs text-secondary-400 mb-4">
                When using Google Maps optimization, pickup times are calculated by working backwards from these target office arrival times.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="label-field">Morning Shift Arrival</label>
                  <input type="time" className="input-field font-mono" value={settings.office_arrival_morning} onChange={e => setSettings({ ...settings, office_arrival_morning: e.target.value })} />
                  <p className="text-xs text-secondary-400 mt-1">Target office arrival for morning shift</p>
                </div>
                <div>
                  <label className="label-field">Afternoon Shift Arrival</label>
                  <input type="time" className="input-field font-mono" value={settings.office_arrival_afternoon} onChange={e => setSettings({ ...settings, office_arrival_afternoon: e.target.value })} />
                  <p className="text-xs text-secondary-400 mt-1">Target office arrival for afternoon shift</p>
                </div>
                <div>
                  <label className="label-field">Night Shift Arrival</label>
                  <input type="time" className="input-field font-mono" value={settings.office_arrival_night} onChange={e => setSettings({ ...settings, office_arrival_night: e.target.value })} />
                  <p className="text-xs text-secondary-400 mt-1">Target office arrival for night shift</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-secondary-900 dark:text-white">Notification Settings</h2>
            <div className="space-y-3">
              {[
                { key: 'email_notifications', label: 'Email Notifications',       desc: 'Receive notifications via email' },
                { key: 'unassigned_alert',    label: 'Unassigned Employee Alert', desc: 'Alert when employees are not assigned to routes' },
                { key: 'route_change_alert',  label: 'Route Change Alert',        desc: 'Notify when route assignments change' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-secondary-50 dark:bg-secondary-700/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-secondary-800 dark:text-secondary-200">{label}</p>
                    <p className="text-xs text-secondary-400">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(key)}
                    className={cn('relative w-12 h-6 rounded-full transition-colors duration-200',
                      settings[key as keyof typeof settings] === 'true' ? 'bg-primary-500' : 'bg-secondary-300')}
                  >
                    <div className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                      settings[key as keyof typeof settings] === 'true' ? 'translate-x-6' : 'translate-x-0.5')} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label-field">Daily Report Email</label>
                <input type="email" className="input-field" value={settings.daily_report_email} onChange={e => setSettings({ ...settings, daily_report_email: e.target.value })} placeholder="reports@company.com" />
              </div>
              <div>
                <label className="label-field">SMTP Host</label>
                <input className="input-field" value={settings.smtp_host} onChange={e => setSettings({ ...settings, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="label-field">SMTP Port</label>
                <input type="number" className="input-field" value={settings.smtp_port} onChange={e => setSettings({ ...settings, smtp_port: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex justify-end border-t border-secondary-100 dark:border-secondary-700 pt-4">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
