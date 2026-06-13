import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Plus, Download, Pencil, Trash2, Search, Users,
  ChevronUp, ChevronDown, ChevronsUpDown,
  Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { employeeService } from '../services';
import type { Employee, UploadResult } from '../types';
import Modal from '../components/ui/Modal';
import { cn, getStatusColor, getShiftColor } from '../utils/helpers';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

type SortField = keyof Employee | null;
type SortDir = 'asc' | 'desc';
type Tab = 'manage' | 'upload';

const emptyEmployee: Omit<Employee, 'id'> = {
  employee_id: '', name: '', team: '', tower: '', location: '',
  shift: 'Morning', status: 'WFO', address: '', lat: 17.44, lng: 78.35,
};

const REQUIRED_FIELDS = ['employee_id', 'employee_name', 'team', 'tower'];
const SHIFT_MAP: Record<string, Employee['shift']> = {
  morning: 'Morning', afternoon: 'Afternoon', night: 'Night',
};
const STATUS_MAP: Record<string, Employee['status']> = {
  wfo: 'WFO', wfh: 'WFH', leave: 'Leave', 'work from office': 'WFO', 'work from home': 'WFH',
};
function normalizeShift(raw: string): Employee['shift'] {
  return SHIFT_MAP[raw.toLowerCase().trim()] ?? 'Morning';
}
function normalizeStatus(raw: string): Employee['status'] {
  return STATUS_MAP[raw.toLowerCase().trim()] ?? 'WFO';
}
function validateRow(row: Record<string, string>, rowNum: number) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === '')
      errors.push({ row: rowNum, field, message: `Missing required field: ${field}`, value: '' });
  }
  return errors;
}

function SortIcon({ field, active, dir }: { field: string; active: SortField; dir: SortDir }) {
  if (active !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-secondary-300" />;
  return dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />;
}

export default function EmployeeManagementPage() {
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const [tab, setTab] = useState<Tab>('manage');

  // --- manage tab state ---
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('employee_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Omit<Employee, 'id'>>(emptyEmployee);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);

  // --- upload tab state ---
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // mutations
  const createMutation = useMutation({
    mutationFn: (emp: Omit<Employee, 'id'>) => employeeService.create(emp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Employee added');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, emp }: { id: string; emp: Partial<Employee> }) => employeeService.update(id, emp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Employee updated');
      setModalOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeeService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Employee deleted');
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // manage tab handlers
  const onEdit = useCallback((emp: Employee) => {
    setEditEmployee(emp);
    setForm({ employee_id: emp.employee_id, name: emp.name, team: emp.team, tower: emp.tower, location: emp.location, shift: emp.shift, status: emp.status, address: emp.address, lat: emp.lat, lng: emp.lng });
    setModalOpen(true);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = [...employees];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(e =>
      e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q) ||
      e.team.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.tower.toLowerCase().includes(q)
    );
    if (statusFilter !== 'All') list = list.filter(e => e.status === statusFilter);
    if (shiftFilter !== 'All') list = list.filter(e => e.shift === shiftFilter);
    if (sortField) list.sort((a, b) => {
      const av = String(a[sortField] ?? '').toLowerCase();
      const bv = String(b[sortField] ?? '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [employees, search, statusFilter, shiftFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editEmployee) updateMutation.mutate({ id: editEmployee.id, emp: form });
    else createMutation.mutate(form);
  };

  const handleExport = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(employees.map(e => ({
        'Employee ID': e.employee_id, 'Name': e.name, 'Team': e.team, 'Tower': e.tower,
        'Location': e.location, 'Shift': e.shift, 'Status': e.status,
      })));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Employees');
      writeFile(wb, 'employees.xlsx');
      toast.success('Exported successfully');
    });
  };

  // upload tab handlers
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) { setUploadFile(accepted[0]); setUploadResult(null); setUploaded(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      const { read, utils } = await import('xlsx');
      const buffer = await uploadFile.arrayBuffer();
      const wb = read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = utils.sheet_to_json(ws, { defval: '' });
      setUploadProgress(40);

      const allErrors: UploadResult['errors'] = [];
      const valid: Omit<Employee, 'id'>[] = [];

      rows.forEach((row, i) => {
        const errs = validateRow(row, i + 2);
        if (errs.length > 0) { allErrors.push(...errs); }
        else {
          valid.push({
            employee_id: String(row.employee_id ?? row['Employee ID'] ?? '').trim(),
            name: String(row.employee_name ?? row['Employee Name'] ?? '').trim(),
            team: String(row.team ?? row['Team'] ?? '').trim(),
            tower: String(row.tower ?? row['Tower'] ?? '').trim(),
            location: String(row.location ?? row['Location'] ?? '').trim(),
            shift: normalizeShift(String(row.shift ?? row['Shift'] ?? 'Morning')),
            status: normalizeStatus(String(row.status ?? row['Status'] ?? 'WFO')),
            address: String(row.address ?? row['Address'] ?? '').trim(),
            lat: Number(row.lat ?? 17.4152),
            lng: Number(row.lng ?? 78.3516),
          });
        }
      });

      setUploadProgress(70);
      if (valid.length > 0) {
        await employeeService.bulkUpsert(valid);
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      }
      setUploadProgress(100);
      setUploadResult({ total: rows.length, valid: valid.length, invalid: allErrors.length, errors: allErrors });
      setUploaded(true);

      if (allErrors.length === 0) toast.success(`Uploaded ${valid.length} employees successfully`);
      else toast.warning(`Uploaded ${valid.length} employees with ${allErrors.length} validation errors`);
    } catch (err) {
      toast.error('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => { setUploadFile(null); setUploadResult(null); setUploaded(false); setUploadProgress(0); };

  const downloadTemplate = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.aoa_to_sheet([
        ['employee_id', 'employee_name', 'team', 'tower', 'location', 'shift', 'status', 'address', 'lat', 'lng'],
        ['EMP001', 'Arjun Sharma', 'Engineering', 'Tower A', 'Gachibowli', 'Morning', 'WFO', 'Gachibowli, Hyderabad', 17.4401, 78.3489],
        ['EMP002', 'Priya Reddy', 'Operations', 'Tower B', 'Madhapur', 'Afternoon', 'WFH', 'Madhapur, Hyderabad', 17.4486, 78.3908],
      ]);
      ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 10 }, { wch: 10 }];
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Template');
      writeFile(wb, 'employee_template.xlsx');
      toast.success('Template downloaded');
    });
  };

  const columns: { key: SortField; label: string }[] = [
    { key: 'employee_id', label: 'Employee ID' },
    { key: 'name',        label: 'Name' },
    { key: 'team',        label: 'Team' },
    { key: 'tower',       label: 'Tower' },
    { key: 'location',    label: 'Location' },
    { key: 'shift',       label: 'Shift' },
    { key: 'status',      label: 'Status' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">
            {isLoading ? 'Loading...' : `${employees.length} total employees`}
          </p>
        </div>
        {tab === 'manage' && (
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="btn-secondary text-sm">
              <Download className="w-4 h-4" /> Export
            </button>
            <button onClick={() => { setEditEmployee(null); setForm(emptyEmployee); setModalOpen(true); }} className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        )}
        {tab === 'upload' && (
          <button onClick={downloadTemplate} className="btn-secondary text-sm">
            <Download className="w-4 h-4" /> Download Template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary-100 dark:bg-secondary-800 rounded-xl w-fit">
        {([
          { key: 'manage', label: 'Manage', Icon: Users },
          { key: 'upload', label: 'Bulk Upload', Icon: Upload },
        ] as { key: Tab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
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

      {/* ── MANAGE TAB ── */}
      {tab === 'manage' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, ID, team, location..."
                className="input-field pl-9 w-full"
              />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
              <option value="All">All Status</option>
              <option>WFO</option><option>WFH</option><option>Leave</option>
            </select>
            <select value={shiftFilter} onChange={e => { setShiftFilter(e.target.value); setPage(1); }} className="input-field w-auto">
              <option value="All">All Shifts</option>
              <option>Morning</option><option>Afternoon</option><option>Night</option>
            </select>
            {(search || statusFilter !== 'All' || shiftFilter !== 'All') && (
              <button onClick={() => { setSearch(''); setStatusFilter('All'); setShiftFilter('All'); setPage(1); }} className="btn-secondary text-sm">
                Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-secondary-400">Loading employees...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="table-header">
                      <tr>
                        {columns.map(col => (
                          <th
                            key={String(col.key)}
                            className="px-4 py-3 text-left cursor-pointer select-none hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors"
                            onClick={() => handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1.5">
                              {col.label}
                              <SortIcon field={String(col.key)} active={sortField} dir={sortDir} />
                            </div>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center text-secondary-400">
                            {search || statusFilter !== 'All' || shiftFilter !== 'All'
                              ? 'No employees match your filters.'
                              : 'No employees found. Add your first employee or use Bulk Upload.'}
                          </td>
                        </tr>
                      ) : (
                        pageRows.map(emp => (
                          <tr key={emp.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-primary-600 dark:text-primary-400">{emp.employee_id}</td>
                            <td className="px-4 py-3 font-medium text-secondary-900 dark:text-white">{emp.name}</td>
                            <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{emp.team}</td>
                            <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{emp.tower}</td>
                            <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{emp.location}</td>
                            <td className="px-4 py-3"><span className={cn('badge', getShiftColor(emp.shift))}>{emp.shift}</span></td>
                            <td className="px-4 py-3"><span className={cn('badge', getStatusColor(emp.status))}>{emp.status}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => onEdit(emp)} className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 rounded-md transition-colors" title="Edit">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteConfirm(emp)} className="p-1.5 hover:bg-error-50 dark:hover:bg-error-900/20 text-error-500 rounded-md transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {filtered.length > PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-700">
                    <span className="text-sm text-secondary-500 dark:text-secondary-400">
                      {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-3 py-1.5 text-sm rounded-lg border border-secondary-200 dark:border-secondary-600 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors">Prev</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                        .reduce<(number | '...')[]>((acc, n, i, arr) => {
                          if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push('...');
                          acc.push(n); return acc;
                        }, [])
                        .map((item, i) =>
                          item === '...'
                            ? <span key={`e-${i}`} className="px-2 text-secondary-400">…</span>
                            : (
                              <button key={item} onClick={() => setPage(item as number)}
                                className={cn('px-3 py-1.5 text-sm rounded-lg border transition-colors', safePage === item ? 'bg-primary-500 text-white border-primary-500' : 'border-secondary-200 dark:border-secondary-600 hover:bg-secondary-50 dark:hover:bg-secondary-700')}>
                                {item}
                              </button>
                            )
                        )}
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-secondary-200 dark:border-secondary-600 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === 'upload' && (
        <div className="max-w-2xl space-y-5">
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            Bulk import employees via Excel. Existing records are updated by <code className="bg-secondary-100 dark:bg-secondary-700 px-1 rounded">employee_id</code>; new ones are inserted.
          </p>

          {!uploaded && (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200',
                isDragActive ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : uploadFile ? 'border-success-400 bg-success-50 dark:bg-success-900/10'
                  : 'border-secondary-200 dark:border-secondary-700 hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                {uploadFile ? (
                  <>
                    <div className="w-14 h-14 bg-success-100 dark:bg-success-900/30 rounded-2xl flex items-center justify-center">
                      <FileSpreadsheet className="w-7 h-7 text-success-600 dark:text-success-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-secondary-900 dark:text-white">{uploadFile.name}</p>
                      <p className="text-sm text-secondary-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 bg-secondary-100 dark:bg-secondary-800 rounded-2xl flex items-center justify-center">
                      <Upload className="w-7 h-7 text-secondary-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-secondary-700 dark:text-secondary-200">
                        {isDragActive ? 'Drop your file here' : 'Drag & drop your Excel file'}
                      </p>
                      <p className="text-sm text-secondary-400 mt-1">or click to browse — .xlsx, .xls supported</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {uploading && (
            <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-200">Uploading & saving to database...</span>
                <span className="text-sm text-secondary-400">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {uploadFile && !uploaded && !uploading && (
            <div className="flex gap-2">
              <button onClick={resetUpload} className="btn-secondary">Remove</button>
              <button onClick={handleUpload} className="btn-primary">
                <Upload className="w-4 h-4" /> Upload & Save
              </button>
            </div>
          )}

          {uploadResult && (
            <div className="space-y-4 animate-slide-up">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Records',   value: uploadResult.total,   Icon: FileSpreadsheet, color: 'text-primary-600 dark:text-primary-400', bg: 'bg-primary-50 dark:bg-primary-900/20' },
                  { label: 'Valid Records',   value: uploadResult.valid,   Icon: CheckCircle,     color: 'text-success-600 dark:text-success-400', bg: 'bg-success-50 dark:bg-success-900/20' },
                  { label: 'Invalid Records', value: uploadResult.invalid, Icon: XCircle,         color: 'text-error-500',                         bg: 'bg-error-50 dark:bg-error-900/20' },
                ].map(({ label, value, Icon, color, bg }) => (
                  <div key={label} className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', bg)}>
                      <Icon className={cn('w-5 h-5', color)} />
                    </div>
                    <p className="text-2xl font-bold text-secondary-900 dark:text-white">{value}</p>
                    <p className="text-xs text-secondary-400">{label}</p>
                  </div>
                ))}
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden">
                  <div className="p-4 border-b border-secondary-100 dark:border-secondary-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-error-500" />
                    <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Validation Errors</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="table-header">
                        <tr>{['Row', 'Field', 'Error Message'].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                        {uploadResult.errors.map((e, i) => (
                          <tr key={i} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/30">
                            <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">{e.row}</td>
                            <td className="px-4 py-3 font-medium text-secondary-800 dark:text-secondary-200">{e.field}</td>
                            <td className="px-4 py-3 text-error-600 dark:text-error-400">{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={resetUpload} className="btn-secondary">Upload Another File</button>
                <button onClick={() => setTab('manage')} className="btn-primary">
                  <Users className="w-4 h-4" /> View Employees
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editEmployee ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Employee ID</label>
              <input className="input-field" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required disabled={!!editEmployee} placeholder="EMP001" />
            </div>
            <div>
              <label className="label-field">Employee Name</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Full name" />
            </div>
            <div>
              <label className="label-field">Team</label>
              <input className="input-field" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} required placeholder="e.g. Engineering" />
            </div>
            <div>
              <label className="label-field">Tower</label>
              <input className="input-field" value={form.tower} onChange={e => setForm({ ...form, tower: e.target.value })} required placeholder="e.g. Tower A" />
            </div>
            <div>
              <label className="label-field">Location</label>
              <input className="input-field" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required placeholder="e.g. Gachibowli" />
            </div>
            <div>
              <label className="label-field">Shift</label>
              <select className="input-field" value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value as Employee['shift'] })}>
                <option>Morning</option><option>Afternoon</option><option>Night</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-field">Status</label>
              <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Employee['status'] })}>
                <option>WFO</option><option>WFH</option><option>Leave</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary">
              <Users className="w-4 h-4" />
              {editEmployee ? 'Update' : 'Add'} Employee
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Employee">
        <p className="text-sm text-secondary-600 dark:text-secondary-300 mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.employee_id})? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending} className="btn-danger">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
