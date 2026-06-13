import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'WFO':            return 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-400';
    case 'WFH':            return 'bg-primary-50 text-primary-700 dark:bg-primary-700/20 dark:text-primary-400';
    case 'Leave':          return 'bg-warning-50 text-warning-600 dark:bg-warning-600/20 dark:text-warning-400';
    case 'Holiday':        return 'bg-orange-50 text-orange-700 dark:bg-orange-700/20 dark:text-orange-400';
    case 'WeekOff':        return 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300';
    case 'CompOff':        return 'bg-violet-50 text-violet-700 dark:bg-violet-700/20 dark:text-violet-400';
    case 'Training':       return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-700/20 dark:text-cyan-400';
    case 'BusinessTravel': return 'bg-blue-50 text-blue-700 dark:bg-blue-700/20 dark:text-blue-400';
    case 'Active':         return 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-400';
    case 'Inactive':       return 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-400';
    default:               return 'bg-secondary-100 text-secondary-600';
  }
}

export function getShiftColor(shift: string): string {
  switch (shift) {
    case 'Morning':   case 'S1': return 'bg-amber-50 text-amber-700 dark:bg-amber-700/20 dark:text-amber-400';
    case 'Afternoon': case 'S2': return 'bg-blue-50 text-blue-700 dark:bg-blue-700/20 dark:text-blue-400';
    case 'Night':     case 'S3': return 'bg-violet-50 text-violet-700 dark:bg-violet-700/20 dark:text-violet-400';
    default: return 'bg-secondary-100 text-secondary-600';
  }
}

export function getApprovalColor(status: string): string {
  switch (status) {
    case 'Draft':      return 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300';
    case 'Submitted':  return 'bg-primary-50 text-primary-700 dark:bg-primary-700/20 dark:text-primary-400';
    case 'Approved':   return 'bg-success-50 text-success-700 dark:bg-success-700/20 dark:text-success-400';
    case 'Finalized':  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-700/20 dark:text-emerald-400';
    default:           return 'bg-secondary-100 text-secondary-600';
  }
}

/** Calendar cell background (stronger fill for calendar grid) */
export function getCalendarCellColor(status: string): string {
  switch (status) {
    case 'WFO':            return 'bg-success-100 text-success-800 dark:bg-success-900/40 dark:text-success-300';
    case 'WFH':            return 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300';
    case 'Leave':          return 'bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300';
    case 'Holiday':        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
    case 'WeekOff':        return 'bg-secondary-200 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300';
    case 'CompOff':        return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300';
    case 'Training':       return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'BusinessTravel': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default:               return 'bg-secondary-100 text-secondary-500';
  }
}
