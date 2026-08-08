import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
export const MainLayout = () => {
    return (_jsxs("div", { className: "flex flex-col h-screen w-screen bg-[#0F141C] text-[#F3F4F6] overflow-hidden", children: [_jsx(Header, {}), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-y-auto p-6 bg-[#0F141C]", children: _jsx(Outlet, {}) })] })] }));
};
