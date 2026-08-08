import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ============================================
// NS LUXURY VILLA — Header Component
// Top bar with live Accra clock, connection status & user menu
// ============================================
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { ConnectionBadge } from '../common/ConnectionBadge';
import { getDisplayName, getInitials } from '@nslv/shared';
import { Bell, LogOut, Shield, User as UserIcon } from 'lucide-react';
export const Header = () => {
    const { user, logout } = useAuthStore();
    const [timeString, setTimeString] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setTimeString(now.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZone: 'Africa/Accra',
            }) + ' (GMT)');
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);
    const displayName = getDisplayName(user);
    const initials = getInitials(displayName);
    const userRoles = user?.roles?.map((r) => r.name).join(', ') || 'Staff';
    return (_jsxs("header", { className: "h-16 border-b border-[#2D3748] bg-[#151C28] px-6 flex items-center justify-between select-none", children: [_jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-[#F3F4F6] tracking-wide font-['Outfit']", children: "NS LUXURY VILLA" }), _jsx("p", { className: "text-xs text-[#E2B768] font-medium", children: "Ho, Ghana \u00B7 Management Platform" })] }) }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "text-center hidden md:block", children: [_jsx("div", { className: "text-xs text-[#9CA3AF]", children: "Local Time (Ho)" }), _jsx("div", { className: "text-sm font-mono font-semibold text-[#F3F4F6]", children: timeString })] }), _jsx(ConnectionBadge, {})] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("button", { className: "p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C2536] rounded-lg transition-colors relative", title: "Notifications", children: [_jsx(Bell, { size: 18 }), _jsx("span", { className: "absolute top-1.5 right-1.5 w-2 h-2 bg-[#C49A45] rounded-full" })] }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setMenuOpen(!menuOpen), className: "flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#1C2536] transition-colors text-left outline-none", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-[#8C2D19] text-white flex items-center justify-center font-bold text-xs border border-[#C49A45]/30", children: initials }), _jsxs("div", { className: "hidden sm:block", children: [_jsx("div", { className: "text-xs font-semibold text-[#F3F4F6]", children: displayName }), _jsx("div", { className: "text-[11px] text-[#C49A45] font-medium", children: userRoles })] })] }), menuOpen && (_jsxs("div", { className: "absolute right-0 mt-2 w-56 bg-[#1C2536] border border-[#2D3748] rounded-xl shadow-xl py-2 z-50", children: [_jsxs("div", { className: "px-4 py-2 border-b border-[#2D3748]", children: [_jsx("p", { className: "text-xs font-semibold text-[#F3F4F6]", children: displayName }), _jsx("p", { className: "text-[11px] text-[#9CA3AF]", children: user?.email })] }), _jsxs("div", { className: "py-1", children: [_jsxs("a", { href: "#profile", className: "flex items-center gap-2.5 px-4 py-2 text-xs text-[#F3F4F6] hover:bg-[#242F44] transition-colors", children: [_jsx(UserIcon, { size: 14 }), " My Profile"] }), _jsxs("a", { href: "#security", className: "flex items-center gap-2.5 px-4 py-2 text-xs text-[#F3F4F6] hover:bg-[#242F44] transition-colors", children: [_jsx(Shield, { size: 14 }), " 2FA & Security"] })] }), _jsx("div", { className: "border-t border-[#2D3748] pt-1", children: _jsxs("button", { onClick: () => logout(), className: "w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#EF4444] hover:bg-[#8C2D19]/20 transition-colors text-left", children: [_jsx(LogOut, { size: 14 }), " Sign Out"] }) })] }))] })] })] }));
};
