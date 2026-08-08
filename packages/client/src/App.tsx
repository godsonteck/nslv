// ============================================
// NS LUXURY VILLA — React App Root & Router
// React Router v7 with Protected Route Guards
// ============================================

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Spinner } from './components/ui';

// ── Phase 2: Admin & Configuration pages (lazy loaded) ──
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const StaffDirectoryPage = lazy(() => import('./pages/admin/StaffDirectoryPage'));

// ── Fallback for lazy-loaded routes ──
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full py-20">
    <Spinner size={32} />
  </div>
);

// ── Coming Soon placeholder for future phases ──
const ComingSoon: React.FC<{ phase: string; module: string }> = ({ phase, module }) => (
  <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
    <div className="w-12 h-12 rounded-2xl bg-[#1C2536] border border-[#2D3748] flex items-center justify-center text-2xl">🏗️</div>
    <div className="text-sm font-semibold text-[#F3F4F6]">{module}</div>
    <div className="text-xs text-[#9CA3AF]">This module is scheduled for {phase}</div>
  </div>
);

/** Protected Route Guard */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Management Workspace */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* ── Phase 2: Admin & System Configuration ── */}
          <Route
            path="users"
            element={
              <Suspense fallback={<PageLoader />}>
                <UsersPage />
              </Suspense>
            }
          />
          <Route
            path="roles"
            element={
              <Suspense fallback={<PageLoader />}>
                <RolesPage />
              </Suspense>
            }
          />
          <Route
            path="audit"
            element={
              <Suspense fallback={<PageLoader />}>
                <AuditLogsPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="staff"
            element={
              <Suspense fallback={<PageLoader />}>
                <StaffDirectoryPage />
              </Suspense>
            }
          />

          {/* ── Phase 3: Reservations, Guests, Rooms, Front Desk ── */}
          <Route path="reservations" element={<ComingSoon phase="Phase 3" module="Reservations" />} />
          <Route path="guests" element={<ComingSoon phase="Phase 3" module="Guests" />} />
          <Route path="rooms" element={<ComingSoon phase="Phase 3" module="Rooms" />} />
          <Route path="frontdesk" element={<ComingSoon phase="Phase 3" module="Front Desk" />} />

          {/* ── Phase 4: Payments & Folios ── */}
          <Route path="payments" element={<ComingSoon phase="Phase 4" module="Payments & Folios" />} />

          {/* ── Phase 5–7: POS Modules ── */}
          <Route path="restaurant" element={<ComingSoon phase="Phase 5" module="Restaurant POS" />} />
          <Route path="bar" element={<ComingSoon phase="Phase 6" module="Bar POS" />} />
          <Route path="pool" element={<ComingSoon phase="Phase 7" module="Pool Workspace" />} />

          {/* ── Phase 8: Operations ── */}
          <Route path="expenses" element={<ComingSoon phase="Phase 8" module="Expenses" />} />
          <Route path="inventory" element={<ComingSoon phase="Phase 8" module="Inventory" />} />

          {/* ── Phase 9: Reports ── */}
          <Route path="reports" element={<ComingSoon phase="Phase 9" module="Reports" />} />
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
