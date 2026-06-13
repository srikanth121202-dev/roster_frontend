import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Users, Briefcase, Home, Calendar, Bus, Palmtree, BookOpen, Plane } from 'lucide-react';
import { rosterService } from '../../services';
import { cn } from '../../utils/helpers';
import { Skeleton } from '../ui/Skeleton';

const STATUS_COLORS: Record<string, string> = {
  WFO: '#22c55e', WFH: '#3b82f6', Leave: '#f59e0b',
  Holiday: '#f97316', WeekOff: '#94a3b8', Other: '#e2e8f0',
};

interface Props { selectedDate: string; }

export default function RosterDashboardTab({ selectedDate }: Props) {
  const [filterTeam, setFilterTeam] = useState('All');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['rosterDash', selectedDate],
    queryFn: () => rosterService.getDashboardStats(selectedDate),
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['roster', selectedDate],
    queryFn: () => rosterService.getByDate(selectedDate),
  });

  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['rosterTrend'],
    queryFn: () => rosterService.getWeeklyTrend(),
    staleTime: 60000,
  });

  const teams = useMemo(
    () => [...new Set(records.map(r => r.team).filter(Boolean))].sort(),
    [records],
  );

  // When a team is selected, compute stats from raw filtered records
  const filteredStats = useMemo(() => {
    if (filterTeam === 'All') return stats;
    const rows = records.filter(r => r.team === filterTeam);
    if (!rows.length) return null;

    const cnt = (s: string) => rows.filter(r => r.status === s).length;
    const shiftMap: Record<string, number> = {};
    for (const r of rows) {
      if (r.shift) shiftMap[r.shift] = (shiftMap[r.shift] ?? 0) + 1;
    }
    const wfo = cnt('WFO'), wfh = cnt('WFH'), leave = cnt('Leave'),
          holiday = cnt('Holiday'), weekOff = cnt('WeekOff');
    const other = rows.length - wfo - wfh - leave - holiday - weekOff;

    return {
      total: rows.length, wfo, wfh, leave, holiday, weekOff, other,
      transport_required: rows.filter(r => r.transport_required).length,
      by_team: [{ team: filterTeam, count: rows.length }],
      by_tower: [],
      by_shift: Object.entries(shiftMap).map(([shift, count]) => ({ shift, count })),
      by_status: [
        { name: 'WFO', value: wfo }, { name: 'WFH', value: wfh },
        { name: 'Leave', value: leave }, { name: 'Holiday', value: holiday },
        { name: 'WeekOff', value: weekOff }, { name: 'Other', value: other },
      ].filter(s => s.value > 0),
    };
  }, [filterTeam, stats, records]);

  const isLoading = statsLoading || recordsLoading;
  const display = filteredStats;

  const kpiCards = display ? [
    { label: 'Total Employees',    value: display.total,              icon: Users,     cls: 'text-primary-600 dark:text-primary-400',  bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { label: 'WFO',                value: display.wfo,                icon: Briefcase, cls: 'text-success-600 dark:text-success-400',  bg: 'bg-success-50 dark:bg-success-900/20' },
    { label: 'WFH',                value: display.wfh,                icon: Home,      cls: 'text-primary-500 dark:text-primary-400',  bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { label: 'Leave',              value: display.leave,              icon: Calendar,  cls: 'text-warning-600 dark:text-warning-400',  bg: 'bg-warning-50 dark:bg-warning-900/20' },
    { label: 'Holiday',            value: display.holiday,            icon: Palmtree,  cls: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Week Off',           value: display.weekOff,            icon: BookOpen,  cls: 'text-secondary-500 dark:text-secondary-400', bg: 'bg-secondary-100 dark:bg-secondary-700' },
    { label: 'Transport Required', value: display.transport_required, icon: Bus,       cls: 'text-success-600 dark:text-success-400',  bg: 'bg-success-50 dark:bg-success-900/20' },
    { label: 'Business / Training',value: display.other,              icon: Plane,     cls: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Team filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 whitespace-nowrap">Filter by Team</label>
        <select
          value={filterTeam}
          onChange={e => setFilterTeam(e.target.value)}
          className="input-field w-auto"
          disabled={teams.length === 0}
        >
          <option value="All">All Teams</option>
          {teams.map(t => <option key={t}>{t}</option>)}
        </select>
        {filterTeam !== 'All' && (
          <button
            onClick={() => setFilterTeam('All')}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Clear
          </button>
        )}
        {filterTeam !== 'All' && (
          <span className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full font-medium">
            {filterTeam}
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : kpiCards.map(({ label, value, icon: Icon, cls, bg }) => (
            <div key={label} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', bg)}>
                <Icon className={cn('w-4 h-4', cls)} />
              </div>
              <p className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</p>
              <p className="text-xs text-secondary-400 leading-tight mt-0.5">{label}</p>
            </div>
          ))
        }
      </div>

      {/* Charts row 1: Trend + Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 7-day trend */}
        <div className="lg:col-span-2 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">7-Day WFO / WFH Trend</h3>
          {trendLoading ? <Skeleton className="h-48" /> : (
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={trend} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" strokeOpacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="wfo" stroke="#22c55e" strokeWidth={2} dot={false} name="WFO" />
                <Line type="monotone" dataKey="wfh" stroke="#3b82f6" strokeWidth={2} dot={false} name="WFH" />
                <Line type="monotone" dataKey="leave" stroke="#f59e0b" strokeWidth={2} dot={false} name="Leave" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status distribution */}
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">Status Distribution</h3>
          {isLoading ? <Skeleton className="h-48" /> : (
            display && display.by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={display.by_status} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {display.by_status.map(entry => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No data for {selectedDate}</div>
            )
          )}
        </div>
      </div>

      {/* Charts row 2: Team + Shift */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team distribution */}
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">
            {filterTeam !== 'All' ? `${filterTeam} — Status Breakdown` : 'Employees by Team'}
          </h3>
          {isLoading ? <Skeleton className="h-48" /> : (
            display && display.by_team.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={display.by_team} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="team" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#22c55e" name="Employees" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No team data</div>
            )
          )}
        </div>

        {/* Shift distribution */}
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">Employees by Shift</h3>
          {isLoading ? <Skeleton className="h-48" /> : (
            display && display.by_shift.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={display.by_shift} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="shift" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Employees" radius={[4, 4, 0, 0]}>
                    {display.by_shift.map(entry => (
                      <Cell key={entry.shift} fill={entry.shift === 'Morning' ? '#f59e0b' : entry.shift === 'Afternoon' ? '#3b82f6' : '#8b5cf6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No shift data</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
