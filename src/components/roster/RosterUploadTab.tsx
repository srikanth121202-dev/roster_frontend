import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle, ArrowRight, Bus,
  CalendarDays, Calendar, ChevronLeft, ChevronRight,
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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

/** Returns the Monday of the ISO week containing `dateStr`. */
function getWeekMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Returns 7 ISO date strings [Mon … Sun] for the week containing `dateStr`. */
function getWeekDates(dateStr: string): string[] {
  const mon = getWeekMonday(dateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtWeekRange(weekDates: string[]): string {
  return `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}, ${weekDates[0].slice(0, 4)}`;
}

/** Detect if spreadsheet rows use wide (7-column-per-day) format. */
function detectDateColumn(key: string): string | null {
  const m = key.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

interface UploadSummary {
  total: number; valid: number; invalid: number;
  wfo: number; wfh: number; leave: number; other: number;
  dates: string[];
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
  const [rosterType, setRosterType] = useState<'daily' | 'weekly'>('daily');

  // For weekly mode, derive Mon-Sun from selectedDate
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const weekMonday = weekDates[0];

  const shiftWeek = (dir: 1 | -1) => {
    const mon = getWeekMonday(selectedDate);
    mon.setDate(mon.getDate() + dir * 7);
    onDateChange(mon.toISOString().split('T')[0]);
  };

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

  // ── PARSE ROWS ─────────────────────────────────────────────────────────────
  function parseRows(
    rows: Record<string, string>[],
    empMap: Record<string, { name: string; shift: string; team: string; tower: string }>,
    fallbackDate: string,
  ): { valid: RosterRecord[]; errors: UploadValidation[] } {
    const errors: UploadValidation[] = [];
    const valid: RosterRecord[] = [];

    // Detect wide weekly format: any column key containing an ISO date
    const dateCols: string[] = rows.length > 0
      ? Object.keys(rows[0]).filter(k => detectDateColumn(k) !== null)
      : [];
    const isWide = dateCols.length >= 2;

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const empId = String(row.employee_id ?? row['Employee ID'] ?? row['emp_id'] ?? '').trim();
      if (!empId) {
        errors.push({ row: rowNum, field: 'employee_id', message: 'Missing employee_id' });
        return;
      }

      const emp = empMap[empId];
      const rawShift = String(row.shift ?? row['Shift'] ?? emp?.shift ?? 'Morning');
      const shift = normalizeShift(rawShift);

      if (isWide) {
        // Wide format: one row per employee, day-columns contain status
        dateCols.forEach(col => {
          const workDate = detectDateColumn(col)!;
          const rawStatus = String(row[col] ?? '').trim();
          if (!rawStatus) return; // empty cell = skip day
          const normalizedStatus = normalizeStatus(rawStatus);

          valid.push({
            employee_id: empId,
            employee_name: String(row.employee_name ?? row['Employee Name'] ?? emp?.name ?? '').trim(),
            date: workDate,
            status: normalizedStatus,
            shift,
            team: String(row.team ?? row['Team'] ?? emp?.team ?? '').trim(),
            tower: String(row.tower ?? row['Tower'] ?? emp?.tower ?? '').trim(),
            cab_used: false,
            pickup_required: normalizedStatus === 'WFO',
            drop_required: normalizedStatus === 'WFO',
            transport_required: normalizedStatus === 'WFO',
            gender: String(row.gender ?? row['Gender'] ?? '').trim(),
            manager_name: String(row.manager_name ?? row['Manager Name'] ?? '').trim(),
            remarks: String(row.remarks ?? row['Remarks'] ?? '').trim(),
            approval_status: 'Draft',
          });
        });
      } else {
        // Standard format: one row per employee per day
        const rawStatus = String(row.status ?? row['Status'] ?? 'WFO').trim();
        const normalizedStatus = normalizeStatus(rawStatus);
        if (rawStatus && !ROSTER_STATUSES.has(rawStatus.toUpperCase().replace(' ', '')) && !STATUS_MAP[rawStatus.toLowerCase()]) {
          errors.push({ row: rowNum, field: 'status', message: `Invalid status: "${rawStatus}"` });
        }

        const rawDate = String(row.work_date ?? row['Work Date'] ?? row.date ?? row['Date'] ?? '').trim();
        const workDate = rawDate ? (parseDate(rawDate) ?? fallbackDate) : fallbackDate;
        if (rawDate && !parseDate(rawDate))
          errors.push({ row: rowNum, field: 'work_date', message: `Invalid date: "${rawDate}"` });

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
          gender: String(row.gender ?? row['Gender'] ?? '').trim(),
          manager_name: String(row.manager_name ?? row['Manager Name'] ?? '').trim(),
          remarks: String(row.remarks ?? row['Remarks'] ?? '').trim(),
          approval_status: 'Draft',
        });
      }
    });

    return { valid, errors };
  }

  // ── UPLOAD ─────────────────────────────────────────────────────────────────
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
      const empMap = Object.fromEntries(employees.map(e => [e.employee_id, {
        name: e.name, shift: e.shift, team: e.team, tower: e.tower,
      }]));
      setProgress(55);

      const fallback = rosterType === 'weekly' ? weekMonday : selectedDate;
      const { valid, errors } = parseRows(rows, empMap, fallback);

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
      const dates = [...new Set(valid.map(r => r.date))].sort();
      setSummary({ total: rows.length, valid: valid.length, invalid: errors.length, wfo, wfh, leave, other: valid.length - wfo - wfh - leave, dates, errors });
      if (errors.length === 0) toast.success(`Uploaded ${valid.length} roster records across ${dates.length} day(s)`);
      else toast.warning(`Uploaded ${valid.length} records with ${errors.length} validation issues`);
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally { setUploading(false); }
  };

  const reset = () => { setFile(null); setSummary(null); setProgress(0); };

  // ── TEMPLATE DOWNLOAD ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      if (rosterType === 'weekly') {
        // Wide format: one row per employee, 7 day-columns
        const dayHeaders = weekDates.map((d, i) => `${DAY_LABELS[i]} ${d}`);
        const headers = ['employee_id', 'employee_name', 'team', 'shift', ...dayHeaders];

        const sampleEmployees = [
          { id: 'EMP001', name: 'Arjun Sharma',   team: 'Engineering', shift: 'Morning'   },
          { id: 'EMP002', name: 'Priya Reddy',     team: 'Operations',  shift: 'Afternoon' },
          { id: 'EMP003', name: 'Rahul Kumar',     team: 'Engineering', shift: 'Morning'   },
          { id: 'EMP004', name: 'Sneha Patel',     team: 'Finance',     shift: 'Night'     },
          { id: 'EMP005', name: 'Vikram Singh',    team: 'HR',          shift: 'Morning'   },
        ];

        const sampleStatuses = [
          ['WFO',   'WFO',   'WFH',    'WFO',   'WFO',   'WeekOff', 'WeekOff'],
          ['WFH',   'WFH',   'WFO',    'WFH',   'WFO',   'WeekOff', 'WeekOff'],
          ['WFO',   'Leave', 'Leave',  'WFO',   'WFO',   'WeekOff', 'WeekOff'],
          ['WFO',   'WFO',   'WFO',    'WFO',   'Holiday','WeekOff','WeekOff'],
          ['Training','WFO', 'WFO',    'WFO',   'WFO',   'WeekOff', 'WeekOff'],
        ];

        const dataRows = sampleEmployees.map((e, ri) => [
          e.id, e.name, e.team, e.shift, ...sampleStatuses[ri],
        ]);

        const ws = utils.aoa_to_sheet([headers, ...dataRows]);
        ws['!cols'] = [
          { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 },
          ...Array(7).fill({ wch: 16 }),
        ];
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Weekly Roster');

        // Instructions sheet
        const instructions = utils.aoa_to_sheet([
          ['Weekly Roster Upload — Instructions'],
          [''],
          ['Column', 'Description', 'Required'],
          ['employee_id', 'Unique employee identifier', 'Yes'],
          ['employee_name', 'Full name', 'Optional'],
          ['team', 'Team / department', 'Optional'],
          ['shift', 'Morning / Afternoon / Night', 'Optional'],
          [`${DAY_LABELS[0]} ${weekDates[0]} … ${DAY_LABELS[6]} ${weekDates[6]}`, 'Status for each day', 'Yes'],
          [''],
          ['Valid Status Values'],
          ['WFO', 'Work from Office'],
          ['WFH', 'Work from Home'],
          ['Leave', 'Leave'],
          ['Holiday', 'Public holiday'],
          ['WeekOff', 'Weekly off'],
          ['CompOff', 'Compensatory off'],
          ['Training', 'Training day'],
          ['BusinessTravel', 'Business travel'],
          [''],
          ['Tip: Leave a day cell empty to skip that day for that employee.'],
        ]);
        instructions['!cols'] = [{ wch: 38 }, { wch: 28 }, { wch: 10 }];
        utils.book_append_sheet(wb, instructions, 'Instructions');

        writeFile(wb, `weekly_roster_template_${weekMonday}.xlsx`);
        toast.success('Weekly template downloaded');
      } else {
        // Daily template
        const ws = utils.aoa_to_sheet([
          ['employee_id', 'employee_name', 'team', 'work_date', 'shift', 'status', 'cab_used', 'pickup_required', 'drop_required', 'gender', 'manager_name', 'remarks'],
          ['EMP001', 'Arjun Sharma',  'Engineering', selectedDate, 'Morning',   'WFO',    'Yes', 'Yes', 'Yes', 'Male',   'Ramesh Kumar', ''],
          ['EMP002', 'Priya Reddy',   'Operations',  selectedDate, 'Afternoon', 'WFH',    'No',  'No',  'No',  'Female', 'Sunita Rao',   ''],
          ['EMP003', 'Rahul Kumar',   'Engineering', selectedDate, 'Morning',   'Leave',  'No',  'No',  'No',  'Male',   'Ramesh Kumar', 'PL'],
          ['EMP004', 'Sneha Patel',   'Finance',     selectedDate, 'Night',     'WFO',    'Yes', 'No',  'Yes', 'Female', 'Anita Sharma', ''],
          ['EMP005', 'Vikram Singh',  'HR',          selectedDate, 'Morning',   'WeekOff','No',  'No',  'No',  'Male',   'Deepak Gupta', ''],
        ]);
        ws['!cols'] = Array(12).fill({ wch: 16 });
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, 'Roster');
        writeFile(wb, 'roster_template_daily.xlsx');
        toast.success('Daily template downloaded');
      }
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Mode toggle ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-secondary-100 dark:bg-secondary-800 rounded-xl w-fit">
        {(['daily', 'weekly'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => { setRosterType(mode); reset(); }}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              rosterType === mode
                ? 'bg-white dark:bg-secondary-700 text-secondary-900 dark:text-white shadow-sm'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
            )}
          >
            {mode === 'daily' ? <Calendar className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
            {mode === 'daily' ? 'Daily Upload' : 'Weekly Upload'}
          </button>
        ))}
      </div>

      {/* ── Date / week selector ────────────────────────────────────────────── */}
      {rosterType === 'daily' ? (
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label-field">Roster Date</label>
            <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)} className="input-field" />
          </div>
          <div className="ml-auto">
            <button onClick={downloadTemplate} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-0">
            <label className="label-field">Select Week</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftWeek(-1)}
                className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-secondary-500" />
              </button>
              <input
                type="date"
                value={weekMonday}
                onChange={e => onDateChange(e.target.value)}
                className="input-field"
              />
              <button
                onClick={() => shiftWeek(1)}
                className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-secondary-500" />
              </button>
            </div>
          </div>
          <div className="ml-auto">
            <button onClick={downloadTemplate} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Download Template
            </button>
          </div>
        </div>
      )}

      {/* ── Week range preview ──────────────────────────────────────────────── */}
      {rosterType === 'weekly' && (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">
              Week: {fmtWeekRange(weekDates)}
            </p>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((d, i) => {
              const isWeekend = i >= 5;
              return (
                <div
                  key={d}
                  className={cn(
                    'flex flex-col items-center py-2 px-1 rounded-lg text-center',
                    isWeekend
                      ? 'bg-secondary-100 dark:bg-secondary-800 text-secondary-400'
                      : 'bg-white dark:bg-secondary-700 text-secondary-700 dark:text-secondary-200'
                  )}
                >
                  <span className="text-xs font-semibold">{DAY_LABELS[i]}</span>
                  <span className="text-xs mt-0.5 text-secondary-400 dark:text-secondary-500">{fmtDate(d)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-3">
            The template contains one row per employee with 7 status columns (Mon–Sun). Leave a cell empty to skip that day.
          </p>
        </div>
      )}

      {/* ── Required columns reference ──────────────────────────────────────── */}
      {!summary && (
        <div className="bg-secondary-50 dark:bg-secondary-800/50 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
          <p className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-2">
            {rosterType === 'weekly' ? 'Weekly Format Columns' : 'Required Columns'}
          </p>
          {rosterType === 'weekly' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {['employee_id', 'shift'].map(c => (
                  <span key={c} className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-800 dark:text-primary-300 px-2 py-0.5 rounded font-mono">{c}</span>
                ))}
                {weekDates.map((d, i) => (
                  <span key={d} className="text-xs bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 px-2 py-0.5 rounded font-mono">
                    {DAY_LABELS[i]} {d}
                  </span>
                ))}
              </div>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">
                Each day column should contain a status value. You can also use the standard row-per-day format with a <code className="font-mono">work_date</code> column.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {['employee_id', 'status', 'shift'].map(c => (
                <span key={c} className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-800 dark:text-primary-300 px-2 py-0.5 rounded font-mono">{c}</span>
              ))}
            </div>
          )}
          <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 mt-2 mb-1">Status Values</p>
          <div className="flex flex-wrap gap-1.5">
            {['WFO', 'WFH', 'Leave', 'Holiday', 'WeekOff', 'CompOff', 'Training', 'BusinessTravel'].map(s => (
              <span key={s} className="text-xs bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 px-2 py-0.5 rounded font-mono">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
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
                    {isDragActive ? 'Drop the roster file here'
                      : rosterType === 'weekly' ? `Drag & drop weekly roster for ${fmtWeekRange(weekDates)}`
                      : 'Drag & drop roster file'}
                  </p>
                  <p className="text-sm text-secondary-400 mt-1">.xlsx, .xls, .csv supported</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      {uploading && (
        <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-secondary-700 dark:text-secondary-200">
              {rosterType === 'weekly' ? 'Processing weekly roster...' : 'Validating & saving roster...'}
            </span>
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
            <Upload className="w-4 h-4" />
            {rosterType === 'weekly' ? 'Upload Weekly Roster' : 'Upload Roster'}
          </button>
        </div>
      )}

      {/* ── Upload result ──────────────────────────────────────────────────── */}
      {summary && (
        <div className="space-y-4 animate-slide-up">

          {/* Date coverage badge for weekly */}
          {summary.dates.length > 1 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-medium text-secondary-500 dark:text-secondary-400">Dates covered:</span>
              {summary.dates.map(d => (
                <span key={d} className="text-xs bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded font-mono">
                  {fmtDate(d)} ({DAY_LABELS[new Date(d + 'T12:00:00').getDay() === 0 ? 6 : new Date(d + 'T12:00:00').getDay() - 1]})
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Rows',    value: summary.total,   Icon: FileSpreadsheet, cls: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
              { label: 'Valid Records', value: summary.valid,   Icon: CheckCircle,     cls: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
              { label: 'Invalid Rows',  value: summary.invalid, Icon: XCircle,         cls: 'text-error-500',                         bg: 'bg-error-50 dark:bg-error-900/20' },
              { label: 'WFO Records',   value: summary.wfo,     Icon: CheckCircle,     cls: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
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
                    <strong>{summary.wfo}</strong> WFO records uploaded
                    {summary.dates.length > 1 ? ` across ${summary.dates.length} days` : ` for ${fmtDate(summary.dates[0] ?? selectedDate)}`}
                    {' '}— go to the <strong>Transport</strong> tab and click <strong>Generate Routes</strong>.
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
