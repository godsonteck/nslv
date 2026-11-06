import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, Trash2, Check, ArrowUpRight, CalendarDays, CreditCard, AlertTriangle, Settings, Info } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import type { NotificationRecord } from '../../services/apiService';

const notificationTarget = (notification: NotificationRecord): string => {
  const d = notification.data || {};
  if (d.checkInId || d.checkOutId) return '/frontdesk';
  switch (notification.type) {
    case 'RESERVATION': return '/reservations';
    case 'PAYMENT': return '/payments';
    default: return '/dashboard';
  }
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

// Use inline style objects for badge colours so they
// survive the global bg-* Tailwind class override in globals.css
const priorityBadgeStyle = (priority: string): React.CSSProperties => {
  switch (priority) {
    case 'URGENT':
      return {
        background: 'rgba(239,68,68,0.15)',
        borderColor: 'rgba(239,68,68,0.40)',
        color: 'var(--ns-danger)',
      };
    case 'HIGH':
      return {
        background: 'rgba(245,158,11,0.15)',
        borderColor: 'rgba(245,158,11,0.40)',
        color: 'var(--ns-warning)',
      };
    case 'MEDIUM':
      return {
        background: 'rgba(14,165,233,0.15)',
        borderColor: 'rgba(14,165,233,0.40)',
        color: 'var(--ns-info)',
      };
    default:
      return {
        background: 'var(--ns-glass-1)',
        borderColor: 'var(--ns-glass-line-soft)',
        color: 'var(--ns-muted)',
      };
  }
};

const typeIcon = (type: string): React.ReactNode => {
  const className = 'h-5 w-5';
  switch (type) {
    case 'RESERVATION':
      return <CalendarDays size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-gold)' }} />;
    case 'PAYMENT':
      return <CreditCard size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-teal)' }} />;
    case 'ALERT':
      return <AlertTriangle size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-warning)' }} />;
    case 'SYSTEM':
      return <Settings size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-muted)' }} />;
    case 'INFO':
      return <Info size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-info)' }} />;
    default:
      return <Bell size={18} className={className} aria-hidden="true" style={{ color: 'var(--ns-teal)' }} />;
  }
};

const NotificationItem: React.FC<{
  notification: NotificationRecord;
  onDelete: (id: string) => Promise<void>;
  onMarkAsRead: (id: string) => Promise<void>;
  onOpen: (notification: NotificationRecord) => void;
}> = ({ notification, onDelete, onMarkAsRead, onOpen }) => {
  const [deleting, setDeleting] = React.useState(false);

  const itemStyle: React.CSSProperties = notification.isRead
    ? {
        background: 'var(--ns-glass-1)',
        border: '1px solid var(--ns-glass-line-soft)',
        opacity: 0.88,
      }
    : {
        background: 'var(--ns-glass-2)',
        border: '1px solid color-mix(in srgb, var(--ns-teal) 60%, transparent)',
        boxShadow: '0 2px 10px -4px color-mix(in srgb, var(--ns-teal) 40%, transparent)',
      };

  const itemClassName = [
    'ns-notif-item',
    'rounded-2xl',
    'transition-all',
    'overflow-hidden',
    notification.isRead ? '' : 'ns-notif-item--unread',
  ].filter(Boolean).join(' ');

  return (
    <div className={itemClassName} style={itemStyle} role="listitem">
      <button
        onClick={() => onOpen(notification)}
        className="group flex w-full items-start gap-3 p-3.5 text-left transition"
        style={{ background: 'transparent' }}
        title={`Open ${notification.title}`}
        aria-label={`Open ${notification.title}`}
      >
        <span className="mt-0.5 shrink-0" aria-hidden="true">{typeIcon(notification.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-[12px] font-black leading-snug" style={{ color: 'var(--ns-ink)' }}>
                {notification.title}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--ns-muted)' }}>
                {notification.message}
              </p>
            </div>
            {!notification.isRead && (
              <span
                className="shrink-0 whitespace-nowrap rounded border px-1.5 py-0.5 text-[12px] font-black uppercase tracking-wide"
                data-accent=""
                style={priorityBadgeStyle(notification.priority)}
              >
                {notification.priority}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--ns-muted)' }}>
            <time dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
            <ArrowUpRight size={12} className="opacity-0 transition group-hover:opacity-100" data-accent="" style={{ color: 'var(--ns-teal)' }} aria-hidden="true" />
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 px-3.5 py-2" style={{ borderTop: '1px solid var(--ns-glass-line-soft)' }}>
        {!notification.isRead && (
          <button
            onClick={async () => await onMarkAsRead(notification.id)}
            className="ns-glass-hover flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors"
            style={{ color: 'var(--ns-ink)' }}
            title="Mark as read"
            aria-label={`Mark "${notification.title}" as read`}
          >
            <Check size={12} data-accent="" style={{ color: 'var(--ns-teal)' }} aria-hidden="true" /> Mark read
          </button>
        )}
        <button
          onClick={async () => {
            setDeleting(true);
            try {
              await onDelete(notification.id);
            } finally {
              setDeleting(false);
            }
          }}
          disabled={deleting}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors disabled:opacity-60"
          data-accent=""
          style={{ color: 'var(--ns-danger)' }}
          title="Delete notification"
          aria-label={`Delete notification "${notification.title}"`}
        >
          <Trash2 size={12} aria-hidden="true" /> {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export const NotificationPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = 'notifications-title';

  useEffect(() => {
    void loadNotifications();
    void getUnreadCount();
  }, [getUnreadCount, loadNotifications]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.isRead) await markAsRead(notification.id);
    onClose();
    navigate(notificationTarget(notification));
  };

  // Strongly opaque, theme-aware panel so the dashboard behind never bleeds
  // through and text stays crisp in both light and dark themes.
  const panelStyle: React.CSSProperties = {
    background: 'var(--ns-notif-bg)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: '1px solid var(--ns-notif-border)',
    boxShadow: 'var(--ns-notif-shadow)',
  };

  const retry = () => {
    void loadNotifications();
    void getUnreadCount();
  };

  return (
    <div
      id="notifications-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="relative z-50 flex max-h-[min(620px,calc(100dvh-6rem))] w-[26rem] max-w-[calc(100vw-2rem)] origin-top-right flex-col overflow-hidden rounded-[24px]"
      style={panelStyle}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--ns-glass-line-soft)', background: 'var(--ns-glass-1)' }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 id={titleId} className="truncate text-[12px] font-black" style={{ color: 'var(--ns-ink)' }}>
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-black uppercase tracking-wide"
              data-accent=""
              style={{
                border: '1px solid var(--ns-gold)',
                background: 'var(--ns-gold-soft)',
                color: 'var(--ns-gold)',
              }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={async () => await markAllAsRead()}
              className="ns-glass-hover rounded-lg px-2.5 py-1 text-[12px] font-bold transition-colors"
              style={{
                border: '1px solid var(--ns-glass-line-soft)',
                background: 'var(--ns-glass-1)',
                color: 'var(--ns-ink)',
              }}
              title="Mark all as read"
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            className="ns-glass-hover rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--ns-muted)' }}
            title="Close notifications"
            aria-label="Close notifications"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="shrink-0 px-4 py-2 text-[12px] font-semibold leading-snug"
          style={{
            borderBottom: '1px solid var(--ns-glass-line-soft)',
            background: 'color-mix(in srgb, var(--ns-danger) 10%, transparent)',
            color: 'var(--ns-danger)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={retry}
              className="shrink-0 whitespace-nowrap font-black underline underline-offset-2"
              style={{ color: 'var(--ns-danger)' }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 overscroll-contain" role="list" aria-label="Notifications" aria-busy={isLoading}>
        {isLoading ? (
          <div className="py-10 text-center text-[12px]" role="status" style={{ color: 'var(--ns-muted)' }}>
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          error ? null : (
            <div className="py-12 text-center" role="listitem">
              <div
                className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{
                  background: 'var(--ns-glass-1)',
                  border: '1px solid var(--ns-glass-line-soft)',
                  color: 'var(--ns-muted)',
                }}
              >
                <Bell size={20} aria-hidden="true" />
              </div>
              <p className="text-[12px] font-bold" style={{ color: 'var(--ns-ink)' }}>
                No notifications
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ns-muted)' }}>
                You're completely caught up.
              </p>
            </div>
          )
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onDelete={deleteNotification}
              onMarkAsRead={markAsRead}
              onOpen={openNotification}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;
