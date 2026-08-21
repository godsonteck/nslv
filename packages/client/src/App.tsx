// ============================================
// NS LUXURY VILLA — React Application Root & Workstation Router
// React Router v7 with Role Guards & Phased Lazy Loading
// ============================================

import React, { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { MainLayout } from './components/layout/MainLayout';
import Login from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Spinner } from './components/ui';
import { PortalGuard, portalPathFor } from './components/auth/PortalGuard';
import { RequirePermission } from './components/auth/RequirePermission';

// Lazy-Loaded Hospitality Pages
const ManagerPortalPage = lazy(() => import('./pages/operations/ManagerPortalPage'));
const ReservationsPage = lazy(() => import('./pages/frontoffice/ReservationsPage'));
const GuestsPage = lazy(() => import('./pages/frontoffice/GuestsPage'));
const RoomsPage = lazy(() => import('./pages/frontoffice/RoomsPage'));
const FrontDeskPage = lazy(() => import('./pages/frontoffice/FrontDeskPage'));
const GuestBillsPage = lazy(() => import('./pages/frontoffice/GuestBillsPage'));

const RestaurantPOSPage = lazy(() => import('./pages/pos/RestaurantPOSPage'));
const BarPOSPage = lazy(() => import('./pages/pos/BarPOSPage'));
const PoolPortalPage = lazy(() => import('./pages/pos/PoolPortalPage'));
const RestaurantPortalPage = lazy(() => import('./pages/operations/RestaurantPortalPage'));
const BarPortalPage = lazy(() => import('./pages/operations/BarPortalPage'));
const EventsPage = lazy(() => import('./pages/operations/EventsPage'));

const PaymentsPage = lazy(() => import('./pages/finance/PaymentsPage'));
const ExpensesPage = lazy(() => import('./pages/finance/ExpensesPage'));
const CashRegisterPage = lazy(() => import('./pages/finance/CashRegisterPage'));
const InventoryPage = lazy(() => import('./pages/operations/InventoryPage'));
const ReportsPage = lazy(() => import('./pages/operations/ReportsPage'));

const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));
const BrandingSettingsPage = lazy(() => import('./pages/admin/BrandingSettingsPage'));
const MenuManagementPage = lazy(() => import('./pages/admin/MenuManagementPage'));
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'));
const AdminConsolePage = lazy(() => import('./pages/admin/AdminConsolePage'));
const RoomConfigPage = lazy(() => import('./pages/admin/RoomConfigPage'));
const EventSpacesPage = lazy(() => import('./pages/admin/EventSpacesPage'));
const LateCheckoutsPage = lazy(() => import('./pages/admin/LateCheckoutsPage'));

const NotFoundPage = lazy(() => import('./pages/error/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('./pages/error/UnauthorizedPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

// Initialize theme on app startup (for all pages including login)
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    void useThemeStore.getState().loadTheme();
  }, []);

  return <>{children}</>;
};

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-full py-24 text-xs text-slate-500">
    <Spinner size={24} />
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

/** Send authenticated users to their role's portal on visiting "/". */
const HomeRedirect: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={portalPathFor(user?.roles ?? [])} replace />;
};

export const App: React.FC = () => {
  return (
    <AppInitializer>
      <HashRouter>
        <Routes>
        {/* Public Authentication Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Hospitality Management Workspace */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          
          {/* Main Role Workstation Entry Points (Consolidated Roles) */}
          <Route path="admin" element={<PortalGuard role="Admin"><Suspense fallback={<PageLoader />}><AdminConsolePage /></Suspense></PortalGuard>} />
          <Route path="manager" element={<PortalGuard role="Manager"><Suspense fallback={<PageLoader />}><ManagerPortalPage /></Suspense></PortalGuard>} />
          <Route path="reception" element={<PortalGuard role="Reception"><Suspense fallback={<PageLoader />}><FrontDeskPage /></Suspense></PortalGuard>} />
          <Route path="restaurant" element={<PortalGuard role="Restaurant"><Suspense fallback={<PageLoader />}><RestaurantPortalPage /></Suspense></PortalGuard>} />
          <Route path="bar" element={<PortalGuard role="Bar"><Suspense fallback={<PageLoader />}><BarPortalPage /></Suspense></PortalGuard>} />
          <Route path="dashboard" element={<RequirePermission any={['dashboard.view']}><Dashboard /></RequirePermission>} />
          <Route path="account" element={<Suspense fallback={<PageLoader />}><AccountPage /></Suspense>} />

          {/* Front Office Routes */}
          <Route path="reservations" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['reservations.view']}><ReservationsPage /></RequirePermission></Suspense>} />
          <Route path="guests" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['guests.view']}><GuestsPage /></RequirePermission></Suspense>} />
          <Route path="rooms" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['rooms.view']}><RoomsPage /></RequirePermission></Suspense>} />
          <Route path="frontdesk" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['checkin.perform', 'checkout.perform']}><FrontDeskPage /></RequirePermission></Suspense>} />
          <Route path="bills" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['folios.view']}><GuestBillsPage /></RequirePermission></Suspense>} />

          {/* Department POS Routes */}
          <Route path="restaurant/pos" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['restaurant.view']}><RestaurantPOSPage /></RequirePermission></Suspense>} />
          <Route path="bar/pos" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['bar.view']}><BarPOSPage /></RequirePermission></Suspense>} />
          <Route path="pool/services" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['pool.view']}><PoolPortalPage /></RequirePermission></Suspense>} />

          {/* Finance & Operations Routes */}
          <Route path="payments" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['payments.view']}><PaymentsPage /></RequirePermission></Suspense>} />
          <Route path="cash-at-hand" element={<Suspense fallback={<PageLoader />}><CashRegisterPage /></Suspense>} />
          <Route path="expenses" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['expenses.view']}><ExpensesPage /></RequirePermission></Suspense>} />
          <Route path="inventory" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['inventory.view']}><InventoryPage /></RequirePermission></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['reports.view']}><ReportsPage /></RequirePermission></Suspense>} />
          <Route path="events" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['events.view']}><EventsPage /></RequirePermission></Suspense>} />

          {/* Administration Routes */}
          <Route path="admin/users" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['users.view']}><UsersPage /></RequirePermission></Suspense>} />
          <Route path="admin/roles" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['roles.view']}><RolesPage /></RequirePermission></Suspense>} />
          <Route path="admin/audit" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['audit.view']}><AuditLogsPage /></RequirePermission></Suspense>} />
          <Route path="admin/settings" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['settings.view']}><SettingsPage /></RequirePermission></Suspense>} />
          <Route path="admin/branding" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['settings.edit']}><BrandingSettingsPage /></RequirePermission></Suspense>} />
          <Route path="admin/menus" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['restaurant.menu', 'bar.menu', 'pool.manage']}><MenuManagementPage /></RequirePermission></Suspense>} />
          <Route path="admin/categories" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['categories.view']}><CategoriesPage /></RequirePermission></Suspense>} />
          <Route path="admin/rooms" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['rooms.manage']}><RoomConfigPage /></RequirePermission></Suspense>} />
          <Route path="admin/event-spaces" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['events.edit']}><EventSpacesPage /></RequirePermission></Suspense>} />
          <Route path="admin/late-checkouts" element={<Suspense fallback={<PageLoader />}><RequirePermission any={['reports.view']}><LateCheckoutsPage /></RequirePermission></Suspense>} />

          {/* Error pages */}
          <Route path="unauthorized" element={<Suspense fallback={<PageLoader />}><UnauthorizedPage /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense>} />
        </Route>
      </Routes>
    </HashRouter>
    </AppInitializer>
  );
};

export default App;
