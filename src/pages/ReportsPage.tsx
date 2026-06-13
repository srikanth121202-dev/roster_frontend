import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Map, Download, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import { dashboardService } from '../services';
import { cn } from '../utils/helpers';

const reportTypes = [
  { id: 'daily',    label: 'Daily Summary',   icon: BarChart3, desc: 'Attendance and route summary for today' },
  { id: 'route',    label: 'Route Summary',    icon: Map,       desc: 'Route utilization and performance metrics' },
  { id: 'employee', label: 'Employee Summary', icon: Users,     desc: 'Employee attendance and shift analysis' },
];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('daily');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', route: 'All', shift: 'All' });

  const { data: routeUtil = [] } = useQuery({ queryKey: ['routeUtil'], queryFn: dashboardService.getRouteUtilization });
  const { data: trend = [] } = useQuery({ queryKey: ['trend'], queryFn: dashboardService.getEmployeeTrend });

  const chartData = activeReport === 'route' ? routeUtil : trend;

  const handleExportExcel = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(chartData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Report');
      writeFile(wb, `${activeReport}_report.xlsx`);
      toast.success('Report exported to Excel');
    });
  };

  const handleExportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`${reportTypes.find(r => r.id === activeReport)?.label} Report`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
      doc.save(`${activeReport}_report.pdf`);
      toast.success('Report exported to PDF');
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Analytics and insights for transport operations</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm"><FileText className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reportTypes.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => setActiveReport(id)}
            className={cn(
              'text-left p-5 rounded-xl border transition-all duration-200',
              activeReport === id
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-600 shadow-md'
                : 'border-secondary-100 dark:border-secondary-700 bg-white dark:bg-secondary-800 hover:border-primary-200 hover:shadow-sm'
            )}
          >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', activeReport === id ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-secondary-100 dark:bg-secondary-700')}>
              <Icon className={cn('w-5 h-5', activeReport === id ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-500')} />
            </div>
            <p className="font-semibold text-secondary-900 dark:text-white text-sm">{label}</p>
            <p className="text-xs text-secondary-400 mt-1">{desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
        <h3 className="font-semibold text-secondary-900 dark:text-white text-sm mb-4">Filters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="label-field">Start Date</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">End Date</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Route</label>
            <select value={filters.route} onChange={e => setFilters({ ...filters, route: e.target.value })} className="input-field">
              <option value="All">All Routes</option>
              {routeUtil.map(r => <option key={r.route}>{r.route}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Shift</label>
            <select value={filters.shift} onChange={e => setFilters({ ...filters, shift: e.target.value })} className="input-field">
              <option value="All">All Shifts</option>
              <option>Morning</option><option>Afternoon</option><option>Night</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-6 shadow-sm">
          <h3 className="font-semibold text-secondary-900 dark:text-white text-sm mb-4">
            {activeReport === 'route' ? 'Route Utilization' : 'Attendance Trend'}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            {activeReport === 'route' ? (
              <BarChart data={routeUtil} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="route" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="utilization" fill="#f97316" name="Utilization %" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={trend} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="wfo"   fill="#22c55e" name="WFO"   radius={[4, 4, 0, 0]} />
                <Bar dataKey="wfh"   fill="#f97316" name="WFH"   radius={[4, 4, 0, 0]} />
                <Bar dataKey="leave" fill="#f59e0b" name="Leave" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-secondary-100 dark:border-secondary-700">
            <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Summary Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  {activeReport === 'route'
                    ? ['Route','Capacity','Assigned','Utilization'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)
                    : ['Day','WFO','WFH','Leave'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)
                  }
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {activeReport === 'route'
                  ? routeUtil.map(r => (
                    <tr key={r.route} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                      <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400">{r.route}</td>
                      <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{r.capacity}</td>
                      <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{r.assigned}</td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', r.utilization >= 80 ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400' : 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400')}>
                          {r.utilization}%
                        </span>
                      </td>
                    </tr>
                  ))
                  : trend.map(t => (
                    <tr key={t.date} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                      <td className="px-4 py-3 font-medium text-secondary-800 dark:text-secondary-200">{t.date}</td>
                      <td className="px-4 py-3 text-success-600 dark:text-success-400">{t.wfo}</td>
                      <td className="px-4 py-3 text-primary-600 dark:text-primary-400">{t.wfh}</td>
                      <td className="px-4 py-3 text-warning-600 dark:text-warning-400">{t.leave}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
