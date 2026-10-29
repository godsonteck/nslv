import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useThemeStore, type ThemePreference } from '../../stores/themeStore';
import { useUIStore } from '../../stores/uiStore';
import { villaAssets } from '../../assets';
import { Bell, ChevronDown, LogOut, Search, Settings2, Sun, Moon, Monitor, PanelLeft, PanelLeftClose } from 'lucide-react';
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
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [openDropdown, setOpenDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'NS';
  const canSettings = user?.permissions?.includes('settings.view') ?? false;
  const canSearchGuests = user?.permissions?.includes('guests.view') ?? false;

  const villaName = theme?.villaName || 'NS Luxury Villa';
  const villaTagline = theme?.villaTagline || 'Lokoe, Ho, Ghana';
  const villaLogo = theme?.logoUrl || villaAssets.logo;

  React.useEffect(() => {
    void getUnreadCount();
    if (typeof document === 'undefined') return;
    const tick = () => {
      if (document.hidden) return;
      void getUnreadCount();
    };
    const interval = setInterval(tick, 30000);
    const onVisible = () => {
      if (!document.hidden) void getUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [getUnreadCount]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/guests?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header
      className="ns-glass-bar sticky top-0 z-40 border-b border-[var(--ns-glass-line)]"
    >
      <div className="flex h-[70px] items-center gap-3 px-4 sm:px-6 lg:px-7">
        {/* Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar to icons' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar to icons' : 'Expand sidebar'}
          className="flex h-9 w-9 items-center justify-center glass-subtle rounded-xl text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-all shrink-0"
        >
          {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
        </button>

        <button onClick={() => navigate('/dashboard')} className="flex shrink-0 items-center gap-3 text-left">
          <img src={villaLogo} alt={villaName} className="h-10 w-10 rounded-xl object-cover ring-1 ring-[#c59a58]/30 shadow-xs" />
          <div className="hidden sm:block">
            <div className="font-['Manrope'] text-[15px] font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              {villaName}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--ns-gold)]">
              {villaTagline}
            </div>
          </div>
        </button>

        {canSearchGuests && (
          <form onSubmit={submitSearch} className="ml-2 hidden min-w-0 flex-1 md:block md:max-w-[340px] lg:ml-6">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ns-muted)]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search guests, reservations, rooms…"
                className="ns-input h-9 w-full pl-9 pr-3 text-xs"
                style={{ backgroundColor: 'var(--ns-surface-2)', color: 'var(--ns-ink)', borderColor: 'var(--ns-line)' }}
              />
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Theme Switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowThemeMenu(v => !v); setShowNotifications(false); }}
              className="flex h-9 w-9 items-center justify-center glass-subtle rounded-xl text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-colors"
              aria-label="Theme"
              title={`Theme: ${themePreference}`}
            >
              {themePreference === 'dark' ? <Moon size={16} /> : themePreference === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
            </button>
            {showThemeMenu && (
              <div
                className="glass-strong absolute right-0 top-12 z-50 w-44 rounded-2xl p-1.5"
              >
                <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--ns-muted)' }}>Theme</div>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setThemePreference(value); setShowThemeMenu(false); }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      themePreference === value ? 'ns-glass-selected text-[var(--ns-gold)]' : 'ns-glass-hover'
                    }`}
                    style={{ color: themePreference === value ? 'var(--ns-gold)' : 'var(--ns-ink)' }}
                  >
                    <Icon size={14} />
                    {label}
                    {themePreference === value && <span className="ml-auto text-[9px] font-extrabold uppercase">On</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative h-9 w-9 flex items-center justify-center glass-subtle rounded-xl text-[var(--ns-muted)] hover:text-[var(--ns-ink)] transition-colors"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full glass-subtle border border-[var(--ns-danger)] text-[var(--ns-danger)] text-[9px] font-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
          </div>

          {canSettings && (
            <button
              className="hidden h-9 w-9 items-center justify-center glass-subtle rounded-xl text-[var(--ns-muted)] hover:text-[var(--ns-ink)] sm:flex transition-colors"
              onClick={() => navigate('/admin/settings')}
              aria-label="Settings"
            >
              <Settings2 size={16} />
            </button>
          )}

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(v => !v)}
              className="flex items-center gap-2 rounded-xl p-1 hover:bg-[var(--ns-surface-2)] transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full glass-subtle text-[11px] font-black text-[var(--ns-teal)] ring-2 ring-[var(--ns-glass-line)]">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block max-w-[120px] truncate text-[11px] font-bold" style={{ color: 'var(--ns-ink)' }}>
                  {user ? `${user.firstName} ${user.lastName}` : 'Staff'}
                </span>
                <span className="block text-[9px] font-semibold uppercase tracking-wider text-[var(--ns-gold)]">
                  {user?.roles?.[0]?.name ?? 'User'}
                </span>
              </span>
              <ChevronDown size={13} className="hidden text-[var(--ns-muted)] lg:block" />
            </button>
            {openDropdown && (
              <div
                className="glass-strong absolute right-0 top-12 z-50 w-52 rounded-2xl p-1.5"
              >
                <div className="border-b border-[var(--ns-glass-line)] px-3 py-2.5">
                  <div className="text-xs font-bold" style={{ color: 'var(--ns-ink)' }}>
                    {user ? `${user.firstName} ${user.lastName}` : 'Staff'}
                  </div>
                  <div className="mt-0.5 text-[10px]" style={{ color: 'var(--ns-muted)' }}>
                    {user?.roles?.[0]?.name ?? 'User'} access
                  </div>
                </div>
                <button
                  onClick={() => { setOpenDropdown(false); navigate('/account'); }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-[var(--ns-surface-2)] transition-colors"
                  style={{ color: 'var(--ns-ink)' }}
                >
                  Account & Profile
                </button>
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--ns-danger)] ns-glass-hover transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Header;
