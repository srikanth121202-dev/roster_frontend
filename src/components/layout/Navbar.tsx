import { Bell, Sun, Moon, LogOut, User, Menu } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { cn } from '../../utils/helpers';
import { useState } from 'react';

const notifications = [
  { id: 1, text: 'Route RT003 has 2 unassigned employees', time: '5m ago', read: false },
  { id: 2, text: 'Roster upload completed successfully', time: '1h ago', read: false },
  { id: 3, text: 'Vehicle breakdown reported on RT005', time: '2h ago', read: true },
];

export default function Navbar() {
  const { theme, toggleTheme, sidebarCollapsed, toggleSidebar, user, logout } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between px-6 z-20 transition-all duration-300',
        sidebarCollapsed ? 'left-[72px]' : 'left-[260px]'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 text-secondary-500 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-secondary-900 dark:text-white hidden sm:block">Route Master</h1>
          <p className="text-xs text-secondary-400 hidden sm:block">Employee Transport Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 text-secondary-500 dark:text-secondary-400 transition-colors"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
            className="p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 text-secondary-500 dark:text-secondary-400 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error-500 rounded-full" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-secondary-800 rounded-xl shadow-xl border border-secondary-200 dark:border-secondary-700 z-50 animate-fade-in">
              <div className="p-4 border-b border-secondary-100 dark:border-secondary-700 flex items-center justify-between">
                <h3 className="font-semibold text-secondary-900 dark:text-white text-sm">Notifications</h3>
                <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">{unread} new</span>
              </div>
              <div className="divide-y divide-secondary-100 dark:divide-secondary-700">
                {notifications.map(n => (
                  <div key={n.id} className={cn('p-4 hover:bg-secondary-50 dark:hover:bg-secondary-700/50 transition-colors', !n.read && 'bg-primary-50/50 dark:bg-primary-900/10')}>
                    <p className="text-sm text-secondary-700 dark:text-secondary-200">{n.text}</p>
                    <p className="text-xs text-secondary-400 mt-1">{n.time}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative">
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          >
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center overflow-hidden">
              <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-secondary-900 dark:text-white leading-tight">{user.name}</p>
              <p className="text-xs text-secondary-400">{user.role}</p>
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-48 bg-white dark:bg-secondary-800 rounded-xl shadow-xl border border-secondary-200 dark:border-secondary-700 z-50 animate-fade-in overflow-hidden">
              <div className="p-3 border-b border-secondary-100 dark:border-secondary-700">
                <p className="font-semibold text-secondary-900 dark:text-white text-sm">{user.name}</p>
                <p className="text-xs text-secondary-400">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-error-600 hover:bg-error-50 dark:hover:bg-error-600/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop for dropdowns */}
      {(showNotifications || showProfile) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowNotifications(false); setShowProfile(false); }}
        />
      )}
    </header>
  );
}
