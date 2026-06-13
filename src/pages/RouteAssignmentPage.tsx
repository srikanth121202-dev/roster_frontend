import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, FileText } from 'lucide-react';
import { routeService, assignmentService } from '../services';
import { cn, getShiftColor } from '../utils/helpers';
import { toast } from 'sonner';

export default function RouteAssignmentPage() {
  const queryClient = useQueryClient();
  const { data: routes = [] } = useQuery({ queryKey: ['routes'], queryFn: routeService.getAll });
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterShift, setFilterShift] = useState('All');
  const [filterRoute, setFilterRoute] = useState('All');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments', filterDate, filterShift, filterRoute],
    queryFn: () => assignmentService.getByDate(filterDate, filterShift, filterRoute),
  });

  const generateMutation = useMutation({
    mutationFn: () => assignmentService.generate(filterDate),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['routeUtil'] });
      toast.success(`Generated ${count} route assignments`);
    },
    onError: (err: Error) => toast.error('Generation failed: ' + err.message),
  });

  const handleExportExcel = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(assignments.map(a => ({
        'Employee ID': a.employee_id, 'Employee Name': a.employee_name,
        'Route Number': a.route_number, 'Pickup Order': a.pickup_order,
        'Location': a.pickup_location, 'Shift': a.shift,
      })));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Route Assignment');
      writeFile(wb, `route_assignment_${filterDate}.xlsx`);
      toast.success('Exported to Excel');
    });
  };

  const handleExportPDF = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Route Assignment Report', 14, 20);
      doc.setFontSize(10); doc.text(`Date: ${filterDate}`, 14, 30);
      let y = 45;
      doc.setFontSize(9);
      assignments.slice(0, 40).forEach(a => {
        doc.text(`${a.employee_id}  ${a.employee_name}  ${a.route_number}  ${a.pickup_location}  ${a.shift}`, 14, y);
        y += 7;
      });
      doc.save(`route_assignment_${filterDate}.pdf`);
      toast.success('Exported to PDF');
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Route Assignment</h1>
          <p className="page-subtitle">Assign employees to transport routes for a given date</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-primary text-sm">
            <RefreshCw className={cn('w-4 h-4', generateMutation.isPending && 'animate-spin')} />
            {generateMutation.isPending ? 'Generating...' : 'Generate Routes'}
          </button>
          <button onClick={handleExportExcel} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-sm">
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-field">Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-field">Shift</label>
            <select value={filterShift} onChange={e => setFilterShift(e.target.value)} className="input-field">
              <option value="All">All Shifts</option>
              <option>Morning</option><option>Afternoon</option><option>Night</option>
            </select>
          </div>
          <div>
            <label className="label-field">Route</label>
            <select value={filterRoute} onChange={e => setFilterRoute(e.target.value)} className="input-field">
              <option value="All">All Routes</option>
              {routes.map(r => <option key={r.id} value={r.route_number}>{r.route_number} — {r.route_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-secondary-100 dark:border-secondary-700 flex items-center justify-between">
          <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">{assignments.length} employees assigned</h3>
          {assignments.length === 0 && !isLoading && (
            <span className="text-xs text-warning-600 dark:text-warning-400 bg-warning-50 dark:bg-warning-900/20 px-2 py-1 rounded-full">
              Click "Generate Routes" to auto-assign
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  {['Employee ID', 'Employee Name', 'Route Number', 'Pickup Order', 'Location', 'Shift', 'Pickup Time'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400">{a.employee_id}</td>
                    <td className="px-4 py-3 text-secondary-800 dark:text-secondary-200">{a.employee_name}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400">{a.route_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="w-6 h-6 bg-secondary-100 dark:bg-secondary-700 rounded-full text-xs font-semibold text-secondary-700 dark:text-secondary-300 flex items-center justify-center">
                        {a.pickup_order}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{a.pickup_location}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', getShiftColor(a.shift))}>{a.shift}</span>
                    </td>
                    <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400 text-xs">{a.pickup_time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
