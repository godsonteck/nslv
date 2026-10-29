import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ToastContainer } from '../ui';
import { authApi } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { villaAssets } from '../../assets';
import { forceGlassMorphism } from './GlassMorph';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const synced = useRef(false);
  const glassRef = useRef<HTMLDivElement>(null);

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

  // Force every surface to translucent frosted glass, and keep watching for
  // dynamically added pages/modals/tables so nothing stays opaque.
  useEffect(() => {
    forceGlassMorphism(glassRef.current || document.body);
    return () => {
      // keep observer alive across page changes; do not disconnect
    };
  }, []);

  const { theme } = useThemeStore();
  const villaLogo = theme?.logoUrl || villaAssets.logo;

  return (
    <div
      ref={glassRef}
      className="flex h-[100dvh] min-h-screen flex-col overflow-hidden relative"
      style={{ backgroundColor: 'var(--ns-bg)', color: 'var(--ns-ink)' }}
    >
      {/* Full-bleed logo watermark behind every page */}
      <div className="ns-watermark" aria-hidden="true">
        <img src={villaLogo} alt="" />
      </div>
      <Header />
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain transition-all">
          <div key={location.pathname} className="ns-page mx-auto min-h-full w-full max-w-[1720px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
};

export default MainLayout;
