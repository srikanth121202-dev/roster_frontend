import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText } from 'lucide-react';
import { sheetService } from '../services';
import { cn, getShiftColor } from '../utils/helpers';
import { toast } from 'sonner';

export default function DropSheetsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['dropSheets', date],
    queryFn: () => sheetService.getDropSheets(date),
  });

  const handleExcelExport = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(sheets.map(s => ({
        'Route Number': s.route_number, 'Employee ID': s.employee_id,
        'Employee Name': s.employee_name, 'Drop Location': s.drop_location,
        'Shift': s.shift, 'Drop Time': s.drop_time,
      })));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Drop Sheet');
      writeFile(wb, `drop_sheet_${date}.xlsx`);
      toast.success('Drop sheet exported to Excel');
    });
  };

  const handlePDFExport = () => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text('Drop Sheet', 14, 20);
      doc.setFontSize(10); doc.text(`Date: ${date}`, 14, 30);
      doc.setFontSize(9); let y = 42;
      sheets.slice(0, 35).forEach(s => {
        doc.text(`${s.route_number}  ${s.employee_id}  ${s.employee_name}  ${s.drop_location}  ${s.shift}`, 14, y);
        y += 6;
      });
      doc.save(`drop_sheet_${date}.pdf`);
      toast.success('Drop sheet exported to PDF');
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Drop Sheets</h1>
          <p className="page-subtitle">Employee drop schedule by route and shift</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExcelExport} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={handlePDFExport} className="btn-secondary text-sm"><FileText className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
        <label className="label-field">Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-field max-w-xs" />
      </div>

      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-secondary-100 dark:border-secondary-700">
          <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">{sheets.length} drop entries</span>
        </div>
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>{['Route Number','Employee ID','Employee Name','Drop Location','Shift','Drop Time'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {sheets.map((s, i) => (
                  <tr key={i} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                    <td className="px-4 py-3"><span className="badge bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400">{s.route_number}</span></td>
                    <td className="px-4 py-3 font-medium text-secondary-700 dark:text-secondary-200">{s.employee_id}</td>
                    <td className="px-4 py-3 text-secondary-800 dark:text-secondary-100">{s.employee_name}</td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{s.drop_location}</td>
                    <td className="px-4 py-3"><span className={cn('badge', getShiftColor(s.shift))}>{s.shift}</span></td>
                    <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{s.drop_time}</td>
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
