import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle, ArrowRight, Bus,
} from 'lucide-react';
import { cn } from '../../utils/helpers';
import { toast } from 'sonner';
import { rosterService, employeeService } from '../../services';
import type { RosterRecord, UploadValidation } from '../../types';

const ROSTER_STATUSES = new Set([
  'WFO', 'WFH', 'Leave', 'Holiday', 'WeekOff', 'CompOff', 'Training', 'BusinessTravel',
]);
const SHIFT_MAP: Record<string, string> = {
  morning: 'Morning', afternoon: 'Afternoon', night: 'Night',
  s1: 'Morning', s2: 'Afternoon', s3: 'Night',
};
const STATUS_MAP: Record<string, RosterRecord['status']> = {
  wfo: 'WFO', wfh: 'WFH', leave: 'Leave', holiday: 'Holiday',
  weekoff: 'WeekOff', 'week off': 'WeekOff',
  compoff: 'CompOff', 'comp off': 'CompOff',
  training: 'Training', businesstravel: 'BusinessTravel', 'business travel': 'BusinessTravel',
  'work from office': 'WFO', 'work from home': 'WFH',
};

function normalizeStatus(raw: string): RosterRecord['status'] {
  const key = raw.toLowerCase().trim();
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  const upper = raw.toUpperCase().trim();
  if (ROSTER_STATUSES.has(upper)) return upper as RosterRecord['status'];
  return 'WFO';
}
function normalizeShift(raw: string): string {
  return SHIFT_MAP[raw.toLowerCase().trim()]
    ?? (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
}
function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

interface UploadSummary {
  total: number; valid: number; invalid: number;
  wfo: number; wfh: number; leave: number; other: number;
  errors: UploadValidation[];
}

interface Props {
  selectedDate: string;
  onDateChange: (d: string) => void;
  onGoToTransport: () => void;
}

export default function RosterUploadTab({ selectedDate, onDateChange, onGoToTransport }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [rosterType, setRosterType] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) { setFile(accepted[0]); setSummary(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setProgress(10);
    try {
      const { read, utils } = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = utils.sheet_to_json(ws, { defval: '' });

      setProgress(35);
      const employees = await employeeService.getAll();
      const empMap = Object.fromEntries(employees.map(e => [e.employee_id, e]));
      setProgress(55);

      const errors: UploadValidation[] = [];
      const valid: RosterRecord[] = [];

      rows.forEach((row, i) => {
        const rowNum = i + 2;
        const empId = String(row.employee_id ?? row['Employee ID'] ?? row['emp_id'] ?? '').trim();
        if (!empId) {
          errors.push({ row: rowNum, field: 'employee_id', message: 'Missing employee_id' });
          return;
        }
        const rawStatus = String(row.status ?? row['Status'] ?? 'WFO').trim();
        const normalizedStatus = normalizeStatus(rawStatus);
        if (rawStatus && !ROSTER_STATUSES.has(rawStatus.toUpperCase().replace(' ', '')) && !STATUS_MAP[rawStatus.toLowerCase()]) {
          errors.push({ row: rowNum, field: 'status', message: `Invalid status: "${rawStatus}". Use: WFO, WFH, Leave, Holiday, WeekOff, CompOff, Training, BusinessTravel` });
        }

        const rawDate = String(row.work_date ?? row['Work Date'] ?? row.date ?? row['Date'] ?? '').trim();
        const workDate = rawDate ? (parseDate(rawDate) ?? selectedDate) : selectedDate;
        if (rawDate && !parseDate(rawDate))
          errors.push({ row: rowNum, field: 'work_date', message: `Invalid date: "${rawDate}"` });

        const emp = empMap[empId];
        const rawShift = String(row.shift ?? row['Shift'] ?? emp?.shift ?? 'Morning');
        const shift = normalizeShift(rawShift);
        const cabUsed = String(row.cab_used ?? row['Cab Used'] ?? '').toLowerCase();
        const pickupReq = String(row.pickup_required ?? row['Pickup Required'] ?? '').toLowerCase();
        const dropReq = String(row.drop_required ?? row['Drop Required'] ?? '').toLowerCase();

        valid.push({
          employee_id: empId,
          employee_name: String(row.employee_name ?? row['Employee Name'] ?? emp?.name ?? '').trim(),
          date: workDate,
          status: normalizedStatus,
          shift,
          team: String(row.team ?? row['Team'] ?? emp?.team ?? '').trim(),
          tower: String(row.tower ?? row['Tower'] ?? emp?.tower ?? '').trim(),
          cab_used: ['yes', 'true', '1', 'y'].includes(cabUsed),
          pickup_required: pickupReq ? ['yes', 'true', '1', 'y'].includes(pickupReq) : normalizedStatus === 'WFO',
          drop_required: dropReq ? ['yes', 'true', '1', 'y'].includes(dropReq) : normalizedStatus === 'WFO',
          transport_required: normalizedStatus === 'WFO',
          gender: String(row.gender ?? row['Gender'] ?? emp?.team ?? '').trim(),
          manager_name: String(row.manager_name ?? row['Manager Name'] ?? '').trim(),
          remarks: String(row.remarks ?? row['Remarks'] ?? '').trim(),
          approval_status: 'Draft',
        });
      });

      setProgress(80);
      if (valid.length > 0) {
        await rosterService.bulkUpsert(valid);
        queryClient.invalidateQueries({ queryKey: ['roster'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['rosterDash'] });
      }
      setProgress(100);

      const wfo = valid.filter(r => r.status === 'WFO').length;
      const wfh = valid.filter(r => r.status === 'WFH').length;
      const leave = valid.filter(r => r.status === 'Leave').length;
      setSummary({ total: rows.length, valid: valid.length, invalid: errors.length, wfo, wfh, leave, other: valid.length - wfo - wfh - leave, errors });
      if (errors.length === 0) toast.success(`Uploaded ${valid.length} roster records`);
      else toast.warning(`Uploaded ${valid.length} records with ${errors.length} validation issues`);
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally { setUploading(false); }
  };

  const reset = () => { setFile(null); setSummary(null); setProgress(0); };

  const downloadTemplate = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.aoa_to_sheet([
        ['employee_id', 'employee_name', 'team', 'tower', 'work_date', 'shift', 'status', 'cab_used', 'pickup_required', 'drop_required', 'gender', 'manager_name', 'remarks'],
        ['EMP001', 'Arjun Sharma', 'Engineering', 'Tower A', selectedDate, 'Morning', 'WFO', 'Yes', 'Yes', 'Yes', 'Male', 'Ramesh Kumar', ''],
        ['EMP002', 'Priya Reddy', 'Operations', 'Tower B', selectedDate, 'Afternoon', 'WFH', 'No', 'No', 'No', 'Female', 'Sunita Rao', ''],
        ['EMP003', 'Rahul Kumar', 'Engineering', 'Tower A', selectedDate, 'Morning', 'Leave', 'No', 'No', 'No', 'Male', 'Ramesh Kumar', 'PL'],
        ['EMP004', 'Sneha Patel', 'Finance', 'Tower C', selectedDate, 'Night', 'WFO', 'Yes', 'No', 'Yes', 'Female', 'Anita Sharma', ''],
        ['EMP005', 'Vikram Singh', 'HR', 'Tower B', selectedDate, 'Morning', 'WeekOff', 'No', 'No', 'No', 'Male', 'Deepak Gupta', ''],
      ]);
      ws['!cols'] = Array(13).fill({ wch: 16 });
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Roster');
      writeFile(wb, 'roster_template.xlsx');
      toast.success('Template downloaded');
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Controls row */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-field">Roster Date</label>
          <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-field">Roster Type</label>
          <select value={rosterType} onChange={e => setRosterType(e.target.value as typeof rosterType)} className="input-field">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="ml-auto">
          <button onClick={downloadTemplate} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Download Template
          </button>
        </div>
      </div>

      {/* Required columns reference */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-4">
        <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 mb-2">Required Columns</p>
        <div className="flex flex-wrap gap-2">
          {['employee_id', 'status', 'shift'].map(c => (
            <span key={c} className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-800 dark:text-primary-300 px-2 py-0.5 rounded font-mono">{c}</span>
          ))}
        </div>
        <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mt-2 mb-1">Status Values</p>
        <div className="flex flex-wrap gap-1.5">
          {['WFO', 'WFH', 'Leave', 'Holiday', 'WeekOff', 'CompOff', 'Training', 'BusinessTravel'].map(s => (
            <span key={s} className="text-xs bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 px-2 py-0.5 rounded font-mono">{s}</span>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!summary && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
            isDragActive ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : file ? 'border-success-400 bg-success-50 dark:bg-success-900/10'
              : 'border-secondary-200 dark:border-secondary-700 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            {file ? (
              <>
                <div className="w-14 h-14 bg-success-100 dark:bg-success-900/30 rounded-2xl flex items-center justify-center">
                  <FileSpreadsheet className="w-7 h-7 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <p className="font-semibold text-secondary-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-secondary-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-secondary-100 dark:bg-secondary-800 rounded-2xl flex items-center justify-center">
                  <Upload className="w-7 h-7 text-secondary-400" />
                </div>
                <div>
                  <p className="font-semibold text-secondary-700 dark:text-secondary-200">
                    {isDragActive ? 'Drop the roster file here' : 'Drag & drop roster file'}
                  </p>
                  <p className="text-sm text-secondary-400 mt-1">.xlsx, .xls, .csv supported</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-200">Validating & saving roster...</span>
            <span className="text-sm text-secondary-400">{progress}%</span>
          </div>
          <div className="h-2 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {file && !summary && !uploading && (
        <div className="flex gap-2">
          <button onClick={reset} className="btn-secondary">Remove</button>
          <button onClick={handleUpload} className="btn-primary">
            <Upload className="w-4 h-4" /> Upload Roster
          </button>
        </div>
      )}

      {/* Upload result */}
      {summary && (
        <div className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Rows',     value: summary.total,   Icon: FileSpreadsheet, cls: 'text-primary-600 dark:text-primary-400',   bg: 'bg-primary-50 dark:bg-primary-900/20' },
              { label: 'Valid Records',  value: summary.valid,   Icon: CheckCircle,     cls: 'text-success-600 dark:text-success-400',   bg: 'bg-success-50 dark:bg-success-900/20' },
              { label: 'Invalid Rows',   value: summary.invalid, Icon: XCircle,         cls: 'text-error-500',                           bg: 'bg-error-50 dark:bg-error-900/20' },
              { label: 'WFO Employees',  value: summary.wfo,     Icon: CheckCircle,     cls: 'text-success-600 dark:text-success-400',   bg: 'bg-success-50 dark:bg-success-900/20' },
            ].map(({ label, value, Icon, cls, bg }) => (
              <div key={label} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', bg)}>
                  <Icon className={cn('w-5 h-5', cls)} />
                </div>
                <p className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</p>
                <p className="text-xs text-secondary-400">{label}</p>
              </div>
            ))}
          </div>

          {summary.errors.length > 0 && (
            <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden">
              <div className="p-4 border-b border-secondary-100 dark:border-secondary-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-error-500" />
                <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Validation Errors ({summary.errors.length})</h3>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="table-header sticky top-0">
                    <tr>{['Row', 'Field', 'Error'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                    {summary.errors.map((e, i) => (
                      <tr key={i} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                        <td className="px-4 py-2.5 text-secondary-500">{e.row}</td>
                        <td className="px-4 py-2.5 font-medium text-secondary-800 dark:text-secondary-200 font-mono text-xs">{e.field}</td>
                        <td className="px-4 py-2.5 text-error-600 dark:text-error-400 text-xs">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={reset} className="btn-secondary">Upload Another File</button>

          {summary.wfo > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-semibold text-primary-800 dark:text-primary-300 text-sm">Next Step: Generate Route Assignments</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
                    <strong>{summary.wfo}</strong> WFO employees uploaded for {selectedDate} — go to the <strong>Transport</strong> tab and click <strong>Generate Routes</strong>.
                  </p>
                </div>
              </div>
              <button onClick={onGoToTransport} className="btn-primary text-sm flex-shrink-0">
                Transport &amp; Routes <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
