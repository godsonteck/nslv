// ============================================
// NS LUXURY VILLA — Header Component
// Top bar with live Accra clock, connection status & user menu
// ============================================

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { ConnectionBadge } from '../common/ConnectionBadge';
import { getDisplayName, getInitials } from '@nslv/shared';
import { Bell, LogOut, Shield, User as UserIcon } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [timeString, setTimeString] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'Africa/Accra',
        }) + ' (GMT)',
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);
  const userRoles = user?.roles?.map((r) => r.name).join(', ') || 'Staff';

  return (
    <header className="h-16 border-b border-[#2D3748] bg-[#151C28] px-6 flex items-center justify-between select-none">
      {/* Left: Branding & Tagline */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#F3F4F6] tracking-wide font-['Outfit']">
            NS LUXURY VILLA
          </h1>
          <p className="text-xs text-[#E2B768] font-medium">Ho, Ghana · Management Platform</p>
        </div>
      </div>

      {/* Center: Live Clock & Network Status */}
      <div className="flex items-center gap-6">
        <div className="text-center hidden md:block">
          <div className="text-xs text-[#9CA3AF]">Local Time (Ho)</div>
          <div className="text-sm font-mono font-semibold text-[#F3F4F6]">{timeString}</div>
        </div>

        <ConnectionBadge />
      </div>

      {/* Right: Notifications & User Profile Menu */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          className="p-2 text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C2536] rounded-lg transition-colors relative"
          title="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C49A45] rounded-full"></span>
        </button>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#1C2536] transition-colors text-left outline-none"
          >
            <div className="w-9 h-9 rounded-full bg-[#8C2D19] text-white flex items-center justify-center font-bold text-xs border border-[#C49A45]/30">
              {initials}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-[#F3F4F6]">{displayName}</div>
              <div className="text-[11px] text-[#C49A45] font-medium">{userRoles}</div>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#1C2536] border border-[#2D3748] rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-[#2D3748]">
                <p className="text-xs font-semibold text-[#F3F4F6]">{displayName}</p>
                <p className="text-[11px] text-[#9CA3AF]">{user?.email}</p>
              </div>

              <div className="py-1">
                <a
                  href="#profile"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#F3F4F6] hover:bg-[#242F44] transition-colors"
                >
                  <UserIcon size={14} /> My Profile
                </a>
                <a
                  href="#security"
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-[#F3F4F6] hover:bg-[#242F44] transition-colors"
                >
                  <Shield size={14} /> 2FA & Security
                </a>
              </div>

              <div className="border-t border-[#2D3748] pt-1">
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#EF4444] hover:bg-[#8C2D19]/20 transition-colors text-left"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
