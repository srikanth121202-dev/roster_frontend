import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { rosterService } from '../../services';
import { cn, getCalendarCellColor } from '../../utils/helpers';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STATUS_SHORT: Record<string, string> = {
  WFO: 'WFO', WFH: 'WFH', Leave: 'LVE', Holiday: 'HOL',
  WeekOff: 'WOF', CompOff: 'COF', Training: 'TRN', BusinessTravel: 'BTV',
};
const PAGE_SIZE = 20;

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toISO(d: Date) { return d.toISOString().split('T')[0]; }
function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Props { selectedDate: string; }

export default function RosterCalendarTab({ selectedDate }: Props) {
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date(selectedDate)));
  const [page, setPage] = useState(1);
  const [filterTeam, setFilterTeam] = useState('All');

  const weekEnd = addDays(weekStart, 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['rosterRange', toISO(weekStart), toISO(weekEnd)],
    queryFn: () => rosterService.getByDateRange(toISO(weekStart), toISO(weekEnd)),
  });

  // Build employee list from records
  const allTeams = useMemo(
    () => [...new Set(records.map(r => r.team).filter(Boolean))].sort(),
    [records],
  );

  const employees = useMemo(
    () => [...new Map(records.map(r => [r.employee_id, { id: r.employee_id, name: r.employee_name, team: r.team }])).values()]
      .filter(e => filterTeam === 'All' || e.team === filterTeam)
      .sort((a, b) => a.id.localeCompare(b.id)),
    [records, filterTeam],
  );

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEmps = employees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Map: employee_id → date → status
  const statusMap = new Map<string, Map<string, string>>();
  for (const r of records) {
    if (!statusMap.has(r.employee_id)) statusMap.set(r.employee_id, new Map());
    statusMap.get(r.employee_id)!.set(r.date, r.status);
  }

  const prevWeek = () => { setWeekStart(w => addDays(w, -7)); setPage(1); };
  const nextWeek = () => { setWeekStart(w => addDays(w, 7)); setPage(1); };
  const goToday  = () => { setWeekStart(getMondayOfWeek(new Date())); setPage(1); };

  const today = toISO(new Date());

  return (
    <div className="space-y-4">
      {/* Team filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 whitespace-nowrap">Team</label>
        <select
          value={filterTeam}
          onChange={e => { setFilterTeam(e.target.value); setPage(1); }}
          className="input-field w-auto"
          disabled={allTeams.length === 0}
        >
          <option value="All">All Teams</option>
          {allTeams.map(t => <option key={t}>{t}</option>)}
        </select>
        {filterTeam !== 'All' && (
          <button onClick={() => { setFilterTeam('All'); setPage(1); }} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-secondary-900 dark:text-white px-2">
            {fmt(weekStart)} — {fmt(weekEnd)}
          </span>
          <button onClick={nextWeek} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={goToday} className="btn-secondary text-sm">Today</button>
        </div>
        <span className="text-sm text-secondary-500 dark:text-secondary-400">
          {employees.length} employee{employees.length !== 1 ? 's' : ''}
          {filterTeam !== 'All' ? ` · ${filterTeam}` : ''}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries({ WFO: 'WFO', WFH: 'WFH', Leave: 'Leave', Holiday: 'Holiday', WeekOff: 'Week Off', CompOff: 'Comp Off', Training: 'Training', BusinessTravel: 'Business Travel' }).map(([k, label]) => (
          <span key={k} className={cn('text-xs px-2 py-0.5 rounded font-medium', getCalendarCellColor(k))}>{label}</span>
        ))}
      </div>

      {/* Calendar table */}
      <div className="bg-white dark:bg-secondary-800 rounded-xl border border-secondary-100 dark:border-secondary-700 overflow-hidden shadow-sm">
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
                    <th className="px-4 py-3 text-left min-w-[180px] sticky left-0 bg-secondary-50 dark:bg-secondary-800 z-10">Employee</th>
                    <th className="px-2 py-3 text-left min-w-[80px] text-xs text-secondary-400">Team</th>
                    {weekDates.map((d, i) => {
                      const iso = toISO(d);
                      return (
                        <th key={iso} className={cn('px-3 py-3 text-center min-w-[80px]', iso === today && 'bg-primary-50 dark:bg-primary-900/20')}>
                          <div className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">{DAYS[i]}</div>
                          <div className={cn('text-xs mt-0.5', iso === today ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-secondary-400')}>{fmt(d)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-700">
                  {pageEmps.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-14 text-center text-secondary-400">No roster data for this week. Upload a roster first.</td></tr>
                  ) : pageEmps.map(emp => (
                    <tr key={emp.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-700/20 transition-colors">
                      <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-700/20">
                        <div className="font-medium text-secondary-900 dark:text-white text-sm">{emp.name}</div>
                        <div className="text-xs text-secondary-400 font-mono">{emp.id}</div>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-secondary-500 dark:text-secondary-400">{emp.team}</td>
                      {weekDates.map(d => {
                        const iso = toISO(d);
                        const status = statusMap.get(emp.id)?.get(iso);
                        return (
                          <td key={iso} className={cn('px-1 py-2 text-center', iso === today && 'bg-primary-50/50 dark:bg-primary-900/10')}>
                            {status ? (
                              <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded', getCalendarCellColor(status))}>
                                {STATUS_SHORT[status] ?? status.slice(0, 3)}
                              </span>
                            ) : (
                              <span className="text-secondary-300 dark:text-secondary-600 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {employees.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-700">
                <span className="text-sm text-secondary-500 dark:text-secondary-400">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, employees.length)} of {employees.length}
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
    </div>
  );
}
