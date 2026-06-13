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
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['rosterDash', selectedDate],
    queryFn: () => rosterService.getDashboardStats(selectedDate),
  });

  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ['rosterTrend'],
    queryFn: () => rosterService.getWeeklyTrend(),
    staleTime: 60000,
  });

  const kpiCards = stats ? [
    { label: 'Total Employees',    value: stats.total,              icon: Users,     cls: 'text-primary-600 dark:text-primary-400',  bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { label: 'WFO',                value: stats.wfo,                icon: Briefcase, cls: 'text-success-600 dark:text-success-400',  bg: 'bg-success-50 dark:bg-success-900/20' },
    { label: 'WFH',                value: stats.wfh,                icon: Home,      cls: 'text-primary-500 dark:text-primary-400',  bg: 'bg-primary-50 dark:bg-primary-900/20' },
    { label: 'Leave',              value: stats.leave,              icon: Calendar,  cls: 'text-warning-600 dark:text-warning-400',  bg: 'bg-warning-50 dark:bg-warning-900/20' },
    { label: 'Holiday',            value: stats.holiday,            icon: Palmtree,  cls: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: 'Week Off',           value: stats.weekOff,            icon: BookOpen,  cls: 'text-secondary-500 dark:text-secondary-400', bg: 'bg-secondary-100 dark:bg-secondary-700' },
    { label: 'Transport Required', value: stats.transport_required, icon: Bus,       cls: 'text-success-600 dark:text-success-400',  bg: 'bg-success-50 dark:bg-success-900/20' },
    { label: 'Business / Training',value: stats.other,              icon: Plane,     cls: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {statsLoading
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
          {statsLoading ? <Skeleton className="h-48" /> : (
            stats && stats.by_status.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={stats.by_status} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {stats.by_status.map(entry => (
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

      {/* Charts row 2: Team + Tower + Shift */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team distribution */}
        <div className="lg:col-span-1 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">WFO by Team</h3>
          {statsLoading ? <Skeleton className="h-48" /> : (
            stats && stats.by_team.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.by_team} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="team" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#22c55e" name="WFO" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No team data</div>
            )
          )}
        </div>

        {/* Tower distribution */}
        <div className="lg:col-span-1 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">WFO by Tower</h3>
          {statsLoading ? <Skeleton className="h-48" /> : (
            stats && stats.by_tower.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.by_tower} layout="vertical" margin={{ top: 0, right: 16, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="tower" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#3b82f6" name="WFO" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No tower data</div>
            )
          )}
        </div>

        {/* Shift distribution */}
        <div className="lg:col-span-1 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-semibold text-secondary-900 dark:text-white mb-4">WFO by Shift</h3>
          {statsLoading ? <Skeleton className="h-48" /> : (
            stats && stats.by_shift.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.by_shift} margin={{ top: 0, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="shift" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="count" name="Employees" radius={[4, 4, 0, 0]}>
                    {stats.by_shift.map(entry => (
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
