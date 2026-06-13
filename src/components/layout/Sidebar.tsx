import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList,
  Map, GitBranch, Zap, FileText, FileDown,
  BarChart3, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { cn } from '../../utils/helpers';

const LOGO = '/logo copy.png';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employee Management', icon: Users },
  { path: '/roster-upload', label: 'Roster', icon: ClipboardList },
  { path: '/route-master', label: 'Route Master', icon: Map },
  { path: '/route-assignment', label: 'Route Assignment', icon: GitBranch },
  { path: '/route-optimization', label: 'Route Optimization', icon: Zap },
  { path: '/pickup-sheets', label: 'Pickup Sheets', icon: FileText },
  { path: '/drop-sheets', label: 'Drop Sheets', icon: FileDown },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useApp();
  const location = useLocation();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white dark:bg-secondary-900 border-r border-secondary-200 dark:border-secondary-700 flex flex-col transition-all duration-300 z-30',
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-secondary-200 dark:border-secondary-700 min-h-[64px]">
        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
          <img src={LOGO} alt="Route Master" className="w-9 h-9 object-contain" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 animate-fade-in">
            <p className="text-sm font-bold text-secondary-900 dark:text-white leading-tight">Route Master</p>
            <p className="text-[10px] text-secondary-400 truncate">Transport Management</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path || location.pathname.startsWith(path + '/');
          return (
            <Link
              key={path}
              to={path}
              title={sidebarCollapsed ? label : undefined}
              className={cn(
                'sidebar-item group',
                active && 'sidebar-item-active',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-secondary-200 dark:border-secondary-700">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors text-sm"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
