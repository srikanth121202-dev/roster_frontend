import { useState } from 'react';
import { LayoutDashboard, Upload, Grid3X3, Calendar, Bus } from 'lucide-react';
import { cn } from '../utils/helpers';
import RosterUploadTab    from '../components/roster/RosterUploadTab';
import RosterGridTab      from '../components/roster/RosterGridTab';
import RosterCalendarTab  from '../components/roster/RosterCalendarTab';
import RosterDashboardTab from '../components/roster/RosterDashboardTab';
import RosterTransportTab from '../components/roster/RosterTransportTab';

type Tab = 'dashboard' | 'upload' | 'grid' | 'calendar' | 'transport';

const TABS: { key: Tab; label: string; Icon: React.ElementType }[] = [
  { key: 'dashboard',  label: 'Dashboard',  Icon: LayoutDashboard },
  { key: 'upload',     label: 'Upload',     Icon: Upload },
  { key: 'grid',       label: 'Grid View',  Icon: Grid3X3 },
  { key: 'calendar',   label: 'Calendar',   Icon: Calendar },
  { key: 'transport',  label: 'Transport',  Icon: Bus },
];

export default function RosterPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Roster Management</h1>
          <p className="page-subtitle">Manage employee schedules, identify transport requirements and generate routes</p>
        </div>
        {tab !== 'upload' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 whitespace-nowrap">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input-field text-sm"
            />
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 bg-secondary-100 dark:bg-secondary-800 rounded-xl w-fit overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap',
              tab === key
                ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <RosterDashboardTab selectedDate={selectedDate} />}
      {tab === 'upload'    && <RosterUploadTab    selectedDate={selectedDate} onDateChange={setSelectedDate} onGoToTransport={() => setTab('transport')} />}
      {tab === 'grid'      && <RosterGridTab      selectedDate={selectedDate} />}
      {tab === 'calendar'  && <RosterCalendarTab  selectedDate={selectedDate} />}
      {tab === 'transport' && <RosterTransportTab selectedDate={selectedDate} onNavigate={setTab} />}
    </div>
  );
}
