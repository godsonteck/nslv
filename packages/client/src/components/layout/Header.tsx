import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useThemeStore } from '../../stores/themeStore';
import { useUIStore } from '../../stores/uiStore';
import { villaAssets } from '../../assets';
import { Bell, ChevronDown, LogOut, Search, Settings2, Sun, Moon, PanelLeft, PanelLeftClose } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { unreadCount, getUnreadCount } = useNotificationStore();
  const { theme, themePreference, setThemePreference } = useThemeStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const notificationsRef = React.useRef<HTMLDivElement | null>(null);
  const [openDropdown, setOpenDropdown] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'NS';
  const canSettings = user?.permissions?.includes('settings.view') ?? false;
  const canSearchGuests = user?.permissions?.includes('guests.view') ?? false;

  const villaName = theme?.villaName || 'NS Luxury Villa';
  const villaTagline = theme?.villaTagline || 'Lokoe, Ho, Ghana';
  const villaLogo = theme?.logoUrl || villaAssets.logo;

  React.useEffect(() => {
    setShowNotifications(false);
  }, [location.pathname]);

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

  React.useEffect(() => {
    if (!showNotifications) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (notificationsRef.current && target && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showNotifications]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/guests?search=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header
      className="ns-glass-bar sticky top-0 z-50 border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.015)] backdrop-blur-[26px] backdrop-saturate-[160%]"
      style={{
        background: 'rgba(255,255,255,0.015)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.32), 0 10px 26px rgba(15,60,72,0.04)',
      }}
    >
      <div className="flex h-[70px] items-center gap-3 px-4 sm:px-6 lg:px-7">
        {/* Sidebar Toggle Button */}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar to icons' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar to icons' : 'Expand sidebar'}
          className="flex h-9 w-9 items-center justify-center clay-btn clay-btn-secondary rounded-xl text-[var(--ns-ink)] hover:text-[var(--ns-ink)] transition-all shrink-0"
        >
          {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
        </button>

        <button onClick={() => navigate('/dashboard')} className="flex shrink-0 items-center gap-3 text-left">
          <img src={villaLogo} alt={villaName} className="h-10 w-10 rounded-xl object-cover ring-1 ring-[var(--ns-teal)]/35 shadow-sm" />
          <div className="hidden sm:block">
            <div className="font-['Manrope'] text-[15px] font-black tracking-tight" style={{ color: 'var(--ns-ink)' }}>
              {villaName}
            </div>
            <div className="text-[9.5px] font-black uppercase tracking-wider text-[var(--ns-gold)]">
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
                className="ns-input h-9 w-full pl-9 pr-3 text-xs font-bold"
                style={{ color: 'var(--ns-ink)' }}
              />
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Theme Toggle - Simple Light/Dark Switch */}
          <button
            onClick={() => {
              const newTheme = themePreference === 'dark' ? 'light' : 'dark';
              setThemePreference(newTheme);
            }}
            className="flex h-9 w-9 items-center justify-center clay-btn clay-btn-secondary rounded-xl text-[var(--ns-ink)] transition-all hover:scale-110"
            aria-label={`Switch to ${themePreference === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${themePreference === 'dark' ? 'light' : 'dark'} mode`}
          >
            {themePreference === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => {
                setOpenDropdown(false);
                setShowNotifications(!showNotifications);
              }}
              aria-expanded={showNotifications}
              className="relative h-9 w-9 flex items-center justify-center clay-btn clay-btn-secondary rounded-xl text-[var(--ns-ink)] transition-colors"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full glass clay-badge text-[var(--ns-danger)] text-[9px] font-black border border-rose-400/70">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="pointer-events-none fixed inset-0 z-[80]">
                <div className="absolute inset-0 bg-[rgba(9,20,28,0.16)] backdrop-blur-[2px]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end pr-4 pt-[78px] sm:pr-6 lg:pr-8">
                  <div className="pointer-events-auto">
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {canSettings && (
            <button
              className="hidden h-9 w-9 items-center justify-center clay-btn clay-btn-secondary rounded-xl text-[var(--ns-ink)] sm:flex transition-colors"
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
              className="flex items-center gap-2 rounded-xl p-1 clay-btn clay-btn-secondary transition-colors"
            >
              <span className="glass flex h-9 w-9 items-center justify-center overflow-hidden rounded-full clay-badge text-[11px] font-black text-[var(--ns-teal)] ring-2 ring-[var(--ns-glass-line)]">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initials}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block max-w-[120px] truncate text-[11px] font-extrabold" style={{ color: 'var(--ns-ink)' }}>
                  {user ? `${user.firstName} ${user.lastName}` : 'Team member'}
                </span>
                <span className="block text-[9.5px] font-extrabold uppercase tracking-wider text-[var(--ns-gold)]">
                  {user?.roles?.[0]?.name ?? 'User'}
                </span>
              </span>
              <ChevronDown size={13} className="hidden text-[var(--ns-muted)] lg:block" />
            </button>
            {openDropdown && (
              <div
                className="glass-strong absolute right-0 top-12 z-50 w-52 rounded-2xl p-1.5 shadow-2xl border border-[var(--ns-glass-line)]"
              >
                <div className="border-b border-[var(--ns-glass-line)] px-3 py-2.5">
                  <div className="text-xs font-black" style={{ color: 'var(--ns-ink)' }}>
                    {user ? `${user.firstName} ${user.lastName}` : 'Team member'}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold" style={{ color: 'var(--ns-muted)' }}>
                    {user?.roles?.[0]?.name ?? 'User'} access
                  </div>
                </div>
                <button
                  onClick={() => { setOpenDropdown(false); navigate('/account'); }}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-[var(--ns-surface-2)] transition-colors"
                  style={{ color: 'var(--ns-ink)' }}
                >
                  My account
                </button>
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[var(--ns-danger)] ns-glass-hover transition-colors"
                >
                  <LogOut size={14} /> Log out
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
