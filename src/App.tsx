import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './store/AppContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import VendorLoginPage from './pages/VendorLoginPage';
import VendorTripsPage from './pages/VendorTripsPage';
import DashboardPage from './pages/DashboardPage';
import EmployeeManagementPage from './pages/EmployeeManagementPage';
import RosterPage from './pages/RosterPage';
import RouteMasterPage from './pages/RouteMasterPage';
import RouteAssignmentPage from './pages/RouteAssignmentPage';
import RouteOptimizationPage from './pages/RouteOptimizationPage';
import PickupSheetsPage from './pages/PickupSheetsPage';
import DropSheetsPage from './pages/DropSheetsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000 } },
});

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userType } = useApp();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (userType === 'vendor') return <Navigate to="/vendor/trips" replace />;
  return <>{children}</>;
}

function VendorRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userType } = useApp();
  if (!isAuthenticated) return <Navigate to="/vendor/login" replace />;
  if (userType === 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, userType } = useApp();
  const defaultRedirect = isAuthenticated
    ? (userType === 'vendor' ? '/vendor/trips' : '/dashboard')
    : '/login';

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to={userType === 'vendor' ? '/vendor/trips' : '/dashboard'} replace />
            : <LoginPage />
        }
      />
      <Route
        path="/vendor/login"
        element={
          isAuthenticated
            ? <Navigate to={userType === 'vendor' ? '/vendor/trips' : '/dashboard'} replace />
            : <VendorLoginPage />
        }
      />

      {/* Vendor portal */}
      <Route path="/vendor/trips" element={<VendorRoute><VendorTripsPage /></VendorRoute>} />

      {/* Admin app */}
      <Route element={<AdminRoute><AppLayout /></AdminRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeeManagementPage />} />
        <Route path="/roster-upload" element={<RosterPage />} />
        <Route path="/route-master" element={<RouteMasterPage />} />
        <Route path="/route-assignment" element={<RouteAssignmentPage />} />
        <Route path="/route-optimization" element={<RouteOptimizationPage />} />
        <Route path="/pickup-sheets" element={<PickupSheetsPage />} />
        <Route path="/drop-sheets" element={<DropSheetsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { borderRadius: '10px', fontSize: '13px' },
            }}
          />
        </BrowserRouter>
      </AppProvider>
    </QueryClientProvider>
  );
}
