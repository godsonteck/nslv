import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Bell, Trash2, Check, ArrowUpRight } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { showToast } from '../ui';
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

const typeIcon = (type: string): string => {
  switch (type) {
    case 'RESERVATION': return '\u{1F4C5}';
    case 'PAYMENT': return '\u{1F4B3}';
    case 'ALERT': return '\u26A0\uFE0F';
    case 'SYSTEM': return '\u2699\uFE0F';
    case 'INFO': return '\u2139\uFE0F';
    default: return '\u{1F514}';
  }
};

const NotificationItem: React.FC<{
  notification: NotificationRecord;
  onDelete: (id: string) => Promise<void>;
  onMarkAsRead: (id: string) => Promise<void>;
  onOpen: (notification: NotificationRecord) => void;
}> = ({ notification, onDelete, onMarkAsRead, onOpen }) => {
  const [deleting, setDeleting] = useState(false);

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
    <div className={itemClassName} style={itemStyle}>
      <button
        onClick={() => onOpen(notification)}
        className="group flex w-full items-start gap-3 p-3.5 text-left transition"
        style={{ background: 'transparent' }}
        title="Open notification"
      >
        <span className="mt-0.5 text-lg select-none shrink-0">{typeIcon(notification.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black leading-snug truncate" style={{ color: 'var(--ns-ink)' }}>
                {notification.title}
              </h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-relaxed" style={{ color: 'var(--ns-muted)' }}>
                {notification.message}
              </p>
            </div>
            {!notification.isRead && (
              <span
                className="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide whitespace-nowrap"
                data-accent=""
                style={priorityBadgeStyle(notification.priority)}
              >
                {notification.priority}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--ns-muted)' }}>
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
            <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100" data-accent="" style={{ color: 'var(--ns-teal)' }} />
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 px-3.5 py-2" style={{ borderTop: '1px solid var(--ns-glass-line-soft)' }}>
        {!notification.isRead && (
          <button
            onClick={async () => await onMarkAsRead(notification.id)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ns-glass-hover"
            style={{ color: 'var(--ns-ink)' }}
            title="Mark as read"
          >
            <Check size={12} data-accent="" style={{ color: 'var(--ns-teal)' }} /> Mark read
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
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50"
          data-accent=""
          style={{ color: 'var(--ns-danger)' }}
          title="Delete notification"
        >
          <Trash2 size={12} /> {deleting ? 'Deleting…' : 'Delete'}
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
    loadNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    void loadNotifications();
    void getUnreadCount();
  }, []);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.isRead) await markAsRead(notification.id);
    onClose();
    navigate(notificationTarget(notification));
  };

  // Inline styles throughout to bypass global glass class color overrides
  const panelStyle: React.CSSProperties = {
    background: 'color-mix(in srgb, var(--ns-bg) 22%, transparent)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: '1px solid var(--ns-glass-line)',
    boxShadow: '0 24px 64px -16px rgba(0,0,0,0.32), inset 0 1px 0 var(--ns-glass-line)',
  };

  return (
    <div
      className="relative z-50 w-[26rem] max-w-[calc(100vw-2rem)] max-h-[min(620px,calc(100dvh-6rem))] flex flex-col origin-top-right overflow-hidden rounded-[24px]"
      style={panelStyle}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--ns-glass-line-soft)', background: 'var(--ns-glass-1)' }}
      >
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-black" style={{ color: 'var(--ns-ink)' }}>
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
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

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={async () => {
                await markAllAsRead();
                showToast('success', 'All notifications marked as read');
              }}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ns-glass-hover"
              style={{
                border: '1px solid var(--ns-glass-line-soft)',
                background: 'var(--ns-glass-1)',
                color: 'var(--ns-ink)',
              }}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors ns-glass-hover"
            style={{ color: 'var(--ns-muted)' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 overscroll-contain">
        {isLoading ? (
          <div className="py-10 text-center text-xs" style={{ color: 'var(--ns-muted)' }}>
            Loading notifications…
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div
              className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--ns-glass-1)',
                border: '1px solid var(--ns-glass-line-soft)',
                color: 'var(--ns-muted)',
              }}
            >
              <Bell size={20} />
            </div>
            <p className="text-xs font-bold" style={{ color: 'var(--ns-ink)' }}>
              No notifications
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ns-muted)' }}>
              You're completely caught up.
            </p>
          </div>
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
