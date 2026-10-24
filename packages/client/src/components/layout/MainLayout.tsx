import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui';
import { authApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useUIStore } from '../../stores/uiStore';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const synced = useRef(false);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  // Re-issue the access token and re-sync the cached profile on startup so role
  // / permission changes take effect without forcing a manual log out / log in.
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const { tokens, user, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !tokens?.refreshToken || !user) return;
    void authApi
      .refresh(tokens.refreshToken)
      .then((newTokens) => {
        useAuthStore.getState().setAuth(user, newTokens);
        return authApi
          .me()
          .then((me) => useAuthStore.getState().setAuth(me, newTokens))
          .catch(() => {
            // Profile refresh failed; keep the cached user with the fresh token.
          });
      })
      .catch(() => {
        // Invalid or expired refresh session — return to the login screen.
        void useAuthStore.getState().logout();
      });
  }, []);

  // Load theme on startup
  useEffect(() => {
    void useThemeStore.getState().loadTheme();
  }, []);

  return (
    <div
      className="flex h-[100dvh] min-h-screen flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--ns-bg)', color: 'var(--ns-ink)' }}
    >
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        <aside
          className={`h-full shrink-0 transition-all duration-200 overflow-hidden ${
            sidebarOpen ? 'w-[246px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-[246px] h-full">
            <Sidebar />
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain transition-all">
          <div key={location.pathname} className="ns-page mx-auto min-h-full w-full max-w-[1720px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export default MainLayout;
