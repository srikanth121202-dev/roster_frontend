import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { vendorService } from '../services';
import type { ThemeMode, User, Vendor } from '../types';

interface AppContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  user: User;
  isAuthenticated: boolean;
  userType: 'admin' | 'vendor' | null;
  vendor: Vendor | null;
  login: (usernameOrEmail: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USERNAME_TO_EMAIL: Record<string, string> = {
  admin: 'admin@routemaster.app',
};

function sessionToUser(session: Session | null, vendor: Vendor | null): User {
  if (!session) return { username: 'admin', name: 'Admin User', role: 'Fleet Manager' };
  if (vendor) return { username: vendor.email, name: vendor.company_name, role: 'Vendor' };
  const meta = session.user.raw_user_meta_data as Record<string, string> | null;
  return {
    username: session.user.email?.split('@')[0] ?? 'admin',
    name: meta?.name ?? 'Admin User',
    role: meta?.role ?? 'Fleet Manager',
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'light';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // undefined = not yet resolved; null = no session
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // undefined = not yet resolved; null = not a vendor
  const [vendor, setVendor] = useState<Vendor | null | undefined>(undefined);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Effect 1: subscribe to auth — NO Supabase data queries here (deadlock risk)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Effect 2: load vendor info whenever session resolves/changes
  useEffect(() => {
    if (session === undefined) return; // still waiting for getSession
    if (!session) {
      setVendor(null);
      return;
    }
    vendorService.getByUserId(session.user.id).then(v => setVendor(v ?? null));
  }, [session]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));
  const toggleSidebar = () => setSidebarCollapsed(c => !c);

  const login = async (usernameOrEmail: string, password: string): Promise<boolean> => {
    const email = usernameOrEmail.includes('@')
      ? usernameOrEmail
      : USERNAME_TO_EMAIL[usernameOrEmail.toLowerCase()] ?? `${usernameOrEmail}@routemaster.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Render nothing until both session and vendor state are fully resolved
  const authReady = session !== undefined && vendor !== undefined;
  if (!authReady) return null;

  const userType: 'admin' | 'vendor' | null = session ? (vendor ? 'vendor' : 'admin') : null;

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        sidebarCollapsed,
        toggleSidebar,
        user: sessionToUser(session, vendor),
        isAuthenticated: !!session,
        userType,
        vendor,
        login,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
