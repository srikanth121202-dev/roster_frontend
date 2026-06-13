import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Download, Pencil, ChevronUp, ChevronDown, ChevronsUpDown, Check } from 'lucide-react';
import { rosterService } from '../../services';
import type { RosterRecord, RosterStatus, ApprovalStatus } from '../../types';
import Modal from '../ui/Modal';
import { cn, getStatusColor, getShiftColor, getApprovalColor } from '../../utils/helpers';
import { toast } from 'sonner';

const PAGE_SIZE = 15;
const ALL_STATUSES: RosterStatus[] = ['WFO', 'WFH', 'Leave', 'Holiday', 'WeekOff', 'CompOff', 'Training', 'BusinessTravel'];
const ALL_APPROVALS: ApprovalStatus[] = ['Draft', 'Submitted', 'Approved', 'Finalized'];

type SortField = keyof RosterRecord | null;
type SortDir = 'asc' | 'desc';

function SortIcon({ field, active, dir }: { field: string; active: SortField; dir: SortDir }) {
  if (active !== field) return <ChevronsUpDown className="w-3 h-3 text-secondary-300" />;
  return dir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary-500" /> : <ChevronDown className="w-3 h-3 text-primary-500" />;
}

interface Props { selectedDate: string; }

export default function RosterGridTab({ selectedDate }: Props) {
  const queryClient = useQueryClient();
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['roster', selectedDate],
    queryFn: () => rosterService.getByDate(selectedDate),
  });

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterShift, setFilterShift] = useState('All');
  const [filterTeam, setFilterTeam] = useState('All');
  const [filterApproval, setFilterApproval] = useState('All');
  const [sortField, setSortField] = useState<SortField>('employee_id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [editRecord, setEditRecord] = useState<RosterRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<RosterRecord>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const teams = useMemo(() => [...new Set(records.map(r => r.team).filter(Boolean))].sort(), [records]);

  const updateMutation = useMutation({
    mutationFn: ({ rec, changes }: { rec: RosterRecord; changes: Partial<RosterRecord> }) =>
      rosterService.update(rec.employee_id, rec.date, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roster'] });
      queryClient.invalidateQueries({ queryKey: ['rosterDash'] });
      toast.success('Record updated');
      setEditRecord(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = [...records];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(r =>
      r.employee_id.toLowerCase().includes(q) || r.employee_name.toLowerCase().includes(q) ||
      r.team.toLowerCase().includes(q)
    );
    if (filterStatus !== 'All') list = list.filter(r => r.status === filterStatus);
    if (filterShift !== 'All') list = list.filter(r => r.shift === filterShift);
    if (filterTeam !== 'All') list = list.filter(r => r.team === filterTeam);
    if (filterApproval !== 'All') list = list.filter(r => r.approval_status === filterApproval);
    if (sortField) list.sort((a, b) => {
      const av = String(a[sortField] ?? '').toLowerCase();
      const bv = String(b[sortField] ?? '').toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [records, search, filterStatus, filterShift, filterTeam, filterApproval, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const allSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.employee_id));
  const toggleAll = () => {
    if (allSelected) setSelected(s => { const n = new Set(s); pageRows.forEach(r => n.delete(r.employee_id)); return n; });
    else setSelected(s => { const n = new Set(s); pageRows.forEach(r => n.add(r.employee_id)); return n; });
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    const targets = records.filter(r => selected.has(r.employee_id));
    for (const r of targets) {
      await rosterService.update(r.employee_id, r.date, { approval_status: 'Approved' });
    }
    queryClient.invalidateQueries({ queryKey: ['roster'] });
    toast.success(`Approved ${selected.size} records`);
    setSelected(new Set());
  };

  const handleExport = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.json_to_sheet(filtered.map(r => ({
        'Employee ID': r.employee_id, 'Name': r.employee_name, 'Team': r.team,
        'Date': r.date, 'Shift': r.shift, 'Status': r.status,
        'Cab Used': r.cab_used ? 'Yes' : 'No', 'Pickup': r.pickup_required ? 'Yes' : 'No',
        'Drop': r.drop_required ? 'Yes' : 'No', 'Transport': r.transport_required ? 'Yes' : 'No',
        'Approval': r.approval_status, 'Remarks': r.remarks,
      })));
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Roster');
      writeFile(wb, `roster_${selectedDate}.xlsx`);
      toast.success('Exported');
    });
  };

  const columns: { key: SortField; label: string }[] = [
    { key: 'employee_id', label: 'Emp ID' },
    { key: 'employee_name', label: 'Name' },
    { key: 'team', label: 'Team' },
    { key: 'shift', label: 'Shift' },
    { key: 'status', label: 'Status' },
    { key: 'cab_used', label: 'Cab' },
    { key: 'transport_required', label: 'Transport' },
    { key: 'approval_status', label: 'Approval' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search employee..." className="input-field pl-9 w-full" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="All">All Status</option>
          {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterShift} onChange={e => { setFilterShift(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="All">All Shifts</option>
          <option>Morning</option><option>Afternoon</option><option>Night</option>
        </select>
        {teams.length > 0 && (
          <select value={filterTeam} onChange={e => { setFilterTeam(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="All">All Teams</option>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        )}
        <select value={filterApproval} onChange={e => { setFilterApproval(e.target.value); setPage(1); }} className="input-field w-auto">
          <option value="All">All Approval</option>
          {ALL_APPROVALS.map(a => <option key={a}>{a}</option>)}
        </select>
        {(search || filterStatus !== 'All' || filterShift !== 'All' || filterTeam !== 'All' || filterApproval !== 'All') && (
          <button onClick={() => { setSearch(''); setFilterStatus('All'); setFilterShift('All'); setFilterTeam('All'); setFilterApproval('All'); setPage(1); }} className="btn-secondary text-sm">Clear</button>
        )}
        <button onClick={handleExport} className="btn-secondary text-sm ml-auto">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-400">{selected.size} selected</span>
          <button onClick={bulkApprove} className="btn-primary text-xs py-1.5 px-3">
            <Check className="w-3.5 h-3.5" /> Approve All
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-secondary text-xs py-1.5 px-3">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-secondary-100 dark:border-secondary-700 flex items-center justify-between">
          <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">
            {isLoading ? 'Loading...' : `${filtered.length} records — ${selectedDate}`}
          </h3>
        </div>
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <div className="w-7 h-7 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr>
                    <th className="pl-4 py-3 w-10">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                    </th>
                    {columns.map(col => (
                      <th key={String(col.key)} onClick={() => handleSort(col.key)}
                        className="px-3 py-3 text-left cursor-pointer hover:bg-secondary-100 dark:hover:bg-secondary-700 select-none transition-colors">
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon field={String(col.key)} active={sortField} dir={sortDir} />
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-14 text-center text-secondary-400">No records found for {selectedDate}.</td></tr>
                  ) : pageRows.map(r => (
                    <tr key={r.employee_id} className={cn('hover:bg-secondary-50 dark:hover:bg-secondary-700/30 transition-colors', selected.has(r.employee_id) && 'bg-primary-50/50 dark:bg-primary-900/10')}>
                      <td className="pl-4 py-3">
                        <input type="checkbox" checked={selected.has(r.employee_id)} onChange={() => toggleSelect(r.employee_id)}
                          className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                      </td>
                      <td className="px-3 py-3 font-medium text-primary-600 dark:text-primary-400 font-mono text-xs">{r.employee_id}</td>
                      <td className="px-3 py-3 text-secondary-800 dark:text-secondary-200 font-medium">{r.employee_name}</td>
                      <td className="px-3 py-3 text-secondary-600 dark:text-secondary-300 text-xs">{r.team}</td>
                      <td className="px-3 py-3"><span className={cn('badge text-xs', getShiftColor(r.shift))}>{r.shift}</span></td>
                      <td className="px-3 py-3"><span className={cn('badge text-xs', getStatusColor(r.status))}>{r.status}</span></td>
                      <td className="px-3 py-3 text-center">
                        {r.cab_used ? <span className="text-success-600 dark:text-success-400 text-xs font-medium">Yes</span>
                          : <span className="text-secondary-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.transport_required ? <span className="text-success-600 dark:text-success-400 text-xs font-medium">Yes</span>
                          : <span className="text-secondary-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3"><span className={cn('badge text-xs', getApprovalColor(r.approval_status))}>{r.approval_status}</span></td>
                      <td className="px-3 py-3">
                        <button onClick={() => { setEditRecord(r); setEditForm({ status: r.status, shift: r.shift, cab_used: r.cab_used, approval_status: r.approval_status, remarks: r.remarks }); }}
                          className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 rounded-md transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-700">
                <span className="text-sm text-secondary-500 dark:text-secondary-400">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-3 py-1.5 text-sm rounded-lg border border-secondary-200 dark:border-secondary-600 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors">Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-secondary-200 dark:border-secondary-600 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={!!editRecord} onClose={() => setEditRecord(null)} title={`Edit — ${editRecord?.employee_name ?? ''}`}>
        {editRecord && (
          <form onSubmit={e => { e.preventDefault(); updateMutation.mutate({ rec: editRecord, changes: editForm }); }}
            className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Status</label>
                <select value={editForm.status ?? editRecord.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as RosterStatus }))} className="input-field">
                  {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label-field">Shift</label>
                <select value={editForm.shift ?? editRecord.shift} onChange={e => setEditForm(f => ({ ...f, shift: e.target.value }))} className="input-field">
                  <option>Morning</option><option>Afternoon</option><option>Night</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.cab_used ?? editRecord.cab_used}
                    onChange={e => setEditForm(f => ({ ...f, cab_used: e.target.checked }))}
                    className="rounded border-secondary-300 text-primary-600" />
                  <span className="text-sm text-secondary-700 dark:text-secondary-200">Cab Used</span>
                </label>
              </div>
              <div>
                <label className="label-field">Approval Status</label>
                <select value={editForm.approval_status ?? editRecord.approval_status} onChange={e => setEditForm(f => ({ ...f, approval_status: e.target.value as ApprovalStatus }))} className="input-field">
                  {ALL_APPROVALS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label-field">Remarks</label>
                <input value={editForm.remarks ?? editRecord.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} className="input-field" placeholder="Optional remarks" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditRecord(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-primary">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
