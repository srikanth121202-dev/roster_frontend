import { useQuery } from '@tanstack/react-query';
import {
  Users, Briefcase, Home, Map, UserCheck, UserX,
  TrendingUp, TrendingDown
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { dashboardService } from '../services';
import { KpiCardSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { formatNumber, cn } from '../utils/helpers';

const kpiConfig = [
  { key: 'total_employees',    label: 'Total Employees',  icon: Users,      color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20',  trend: '+12', positive: true  },
  { key: 'wfo_today',          label: 'WFO Today',        icon: Briefcase,  color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20',  trend: '+5',  positive: true  },
  { key: 'wfh_today',          label: 'WFH Today',        icon: Home,       color: 'text-accent-600 dark:text-accent-400',   bg: 'bg-accent-50 dark:bg-accent-900/20',    trend: '-3',  positive: false },
  { key: 'total_routes',       label: 'Total Routes',     icon: Map,        color: 'text-primary-700 dark:text-primary-300', bg: 'bg-primary-50 dark:bg-primary-900/20',  trend: '0',   positive: true  },
  { key: 'assigned_employees', label: 'Assigned',         icon: UserCheck,  color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20',  trend: '+8',  positive: true  },
  { key: 'unassigned_employees',label: 'Unassigned',      icon: UserX,      color: 'text-error-600 dark:text-error-400',     bg: 'bg-error-50 dark:bg-error-900/20',      trend: '-8',  positive: true  },
];

const COLORS = ['#f97316', '#22c55e', '#8b5cf6', '#f59e0b'];

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: dashboardService.getStats,
    refetchInterval: 30000,
  });
  const { data: routeUtil } = useQuery({
    queryKey: ['routeUtil'],
    queryFn: dashboardService.getRouteUtilization,
    refetchInterval: 60000,
  });
  const { data: trend } = useQuery({
    queryKey: ['trend'],
    queryFn: dashboardService.getEmployeeTrend,
  });
  const { data: shiftDist } = useQuery({
    queryKey: ['shiftDist'],
    queryFn: dashboardService.getShiftDistribution,
  });
  const { data: routeOcc } = useQuery({
    queryKey: ['routeOcc'],
    queryFn: dashboardService.getRouteOccupancy,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your transport management operations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          kpiConfig.map(({ key, label, icon: Icon, color, bg, trend: t, positive }) => (
            <div key={key} className="kpi-card">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                  <Icon className={cn('w-5 h-5', color)} />
                </div>
                <div className={cn('flex items-center gap-0.5 text-xs font-medium', positive ? 'text-success-600 dark:text-success-400' : 'text-error-500')}>
                  {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {t}
                </div>
              </div>
              <p className="text-2xl font-bold text-secondary-900 dark:text-white">
                {formatNumber(stats?.[key as keyof typeof stats] as number ?? 0)}
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-1">{label}</p>
            </div>
          ))
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-secondary-900 dark:text-white mb-1">Route Utilization</h3>
          <p className="text-xs text-secondary-400 mb-4">Capacity vs assigned employees</p>
          {!routeUtil ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={routeUtil} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-100 dark:text-secondary-700" />
                <XAxis dataKey="route" tick={{ fontSize: 12, fill: 'currentColor' }} className="text-secondary-500" />
                <YAxis tick={{ fontSize: 12, fill: 'currentColor' }} className="text-secondary-500" />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="capacity" fill="#fed7aa" name="Capacity" radius={[4, 4, 0, 0]} />
                <Bar dataKey="assigned" fill="#f97316" name="Assigned" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-secondary-900 dark:text-white mb-1">Employee Trend</h3>
          <p className="text-xs text-secondary-400 mb-4">Weekly attendance breakdown</p>
          {!trend ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-100 dark:text-secondary-700" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="wfo"   stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="WFO" />
                <Line type="monotone" dataKey="wfh"   stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="WFH" />
                <Line type="monotone" dataKey="leave" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Leave" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-secondary-900 dark:text-white mb-1">Shift Distribution</h3>
          <p className="text-xs text-secondary-400 mb-4">Employees by shift type today</p>
          {!shiftDist ? <ChartSkeleton /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={shiftDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {shiftDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {shiftDist.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-secondary-600 dark:text-secondary-300">{item.name}</span>
                    <span className="text-sm font-semibold text-secondary-900 dark:text-white ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-secondary-900 dark:text-white mb-1">Route Occupancy</h3>
          <p className="text-xs text-secondary-400 mb-4">Weekly occupancy by shift (%)</p>
          {!routeOcc ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={routeOcc}>
                <defs>
                  <linearGradient id="gMorning" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAfternoon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gNight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-secondary-100 dark:text-secondary-700" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="morning"   stroke="#f97316" fill="url(#gMorning)"   strokeWidth={2} name="Morning" />
                <Area type="monotone" dataKey="afternoon" stroke="#22c55e" fill="url(#gAfternoon)" strokeWidth={2} name="Afternoon" />
                <Area type="monotone" dataKey="night"     stroke="#8b5cf6" fill="url(#gNight)"     strokeWidth={2} name="Night" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
