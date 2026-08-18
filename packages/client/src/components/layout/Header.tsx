import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useThemeStore, type ThemePreference } from '../../stores/themeStore';
import { villaAssets } from '../../assets';
import { Bell, ChevronDown, LogOut, Search, Settings2, Sun, Moon, Monitor } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { unreadCount, getUnreadCount } = useNotificationStore();
  const { theme, themePreference, setThemePreference } = useThemeStore();
  const [openDropdown, setOpenDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'NS';
  const canSettings = user?.permissions?.includes('settings.view') ?? false;
  const canSearchGuests = user?.permissions?.includes('guests.view') ?? false;

  const villaName = theme?.villaName || 'NSVilla';
  const villaTagline = theme?.villaTagline || 'Property Operations';
  const villaLogo = theme?.logoUrl || villaAssets.logo;

  React.useEffect(() => {
    const interval = setInterval(() => void getUnreadCount(), 30000);
    void getUnreadCount();
    return () => clearInterval(interval);
  }, [getUnreadCount]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/guests?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e8e5] bg-white/95 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-7">
        <button onClick={() => navigate('/dashboard')} className="flex shrink-0 items-center gap-3 text-left">
          <img src={villaLogo} alt={villaName} className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/5" />
          <div className="hidden sm:block">
            <div className="font-['Manrope'] text-[16px] font-extrabold tracking-[-0.03em] text-[#14232b]">{villaName}</div>
            <div className="text-[9px] font-bold uppercase tracking-[.18em] text-[#a8761e]">{villaTagline}</div>
          </div>
        </button>

        {canSearchGuests && (
          <form onSubmit={submitSearch} className="ml-2 hidden min-w-0 flex-1 md:block md:max-w-[360px] lg:ml-7">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guests, reservations, rooms…" className="ns-input h-10 w-full pl-10 pr-3 text-xs text-slate-700 placeholder:text-slate-400" />
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => { setShowThemeMenu(v => !v); setShowNotifications(false); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              aria-label="Theme"
              title={`Theme: ${themePreference}`}
            >
              {themePreference === 'dark' ? <Moon size={17} /> : themePreference === 'light' ? <Sun size={17} /> : <Monitor size={17} />}
            </button>
            {showThemeMenu && (
              <div className="absolute right-0 top-12 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(20,35,43,.14)]">
                <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-400">Theme</div>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setThemePreference(value); setShowThemeMenu(false); }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                      themePreference === value ? 'bg-[#f1a83f]/15 text-[#a8761e]' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                    {themePreference === value && <span className="ml-auto text-[9px] font-extrabold uppercase">On</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 sm:flex"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
          </div>
          {canSettings && <button className="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 sm:flex" onClick={() => navigate('/admin/settings')} aria-label="Settings"><Settings2 size={17} /></button>}
          <div className="relative">
            <button onClick={() => setOpenDropdown(v => !v)} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-slate-50">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#16a4d4] text-[11px] font-extrabold text-white ring-2 ring-[#e8f2f4]">{user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}</span>
              <span className="hidden text-left lg:block"><span className="block max-w-[120px] truncate text-[11px] font-extrabold text-slate-800">{user ? `${user.firstName} ${user.lastName}` : 'Staff'}</span><span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">{user?.roles?.[0]?.name ?? 'User'}</span></span>
              <ChevronDown size={13} className="hidden text-slate-400 lg:block" />
            </button>
            {openDropdown && <div className="absolute right-0 top-12 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(20,35,43,.14)]">
              <div className="border-b border-slate-100 px-3 py-2.5"><div className="text-xs font-bold text-slate-800">{user ? `${user.firstName} ${user.lastName}` : 'Staff'}</div><div className="mt-0.5 text-[10px] text-slate-400">{user?.roles?.[0]?.name ?? 'User'} access</div></div>
              <button onClick={() => navigate('/account')} className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">Account & settings</button>
              <button onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"><LogOut size={14} /> Sign out</button>
            </div>}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Header;
