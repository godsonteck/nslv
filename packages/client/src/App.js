import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
/** Protected Route Guard */
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
export const App = () => {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { path: "/", element: _jsx(ProtectedRoute, { children: _jsx(MainLayout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "dashboard", element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "reservations", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Reservations Module (Phase 3)" }) }), _jsx(Route, { path: "guests", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Guests Module (Phase 3)" }) }), _jsx(Route, { path: "rooms", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Rooms Module (Phase 3)" }) }), _jsx(Route, { path: "frontdesk", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Front Desk Check-in/out (Phase 3)" }) }), _jsx(Route, { path: "restaurant", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Restaurant Module (Phase 5)" }) }), _jsx(Route, { path: "bar", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Bar Module (Phase 6)" }) }), _jsx(Route, { path: "pool", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Pool Workspace (Phase 7)" }) }), _jsx(Route, { path: "payments", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Payments & Folios (Phase 4)" }) }), _jsx(Route, { path: "expenses", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Expenses Module (Phase 8)" }) }), _jsx(Route, { path: "inventory", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Inventory Module (Phase 8)" }) }), _jsx(Route, { path: "reports", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Reporting Module (Phase 9)" }) }), _jsx(Route, { path: "staff", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Staff Directory (Phase 2)" }) }), _jsx(Route, { path: "users", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "Users & RBAC Management (Phase 2)" }) }), _jsx(Route, { path: "audit", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "System Audit Logs (Phase 1)" }) }), _jsx(Route, { path: "settings", element: _jsx("div", { className: "text-sm p-4 text-[#9CA3AF]", children: "System Configuration (Phase 2)" }) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/dashboard", replace: true }) })] }) }));
};
export default App;
