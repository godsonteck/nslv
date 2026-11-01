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
    case 'RESERVATION':
      return '/reservations';
    case 'PAYMENT':
      return '/payments';
    default:
      return '/dashboard';
  }
};

const priorityColor = (priority: string): string => {
  switch (priority) {
    case 'URGENT':
      return 'bg-rose-500/15 text-[var(--ns-danger)] border-rose-500/30';
    case 'HIGH':
      return 'bg-amber-500/15 text-[var(--ns-warning)] border-amber-500/30';
    case 'MEDIUM':
      return 'bg-sky-500/15 text-[var(--ns-info)] border-sky-500/30';
    default:
      return 'bg-[var(--ns-glass-1)] text-[var(--ns-muted)] border-[var(--ns-glass-line)]';
  }
};

const typeIcon = (type: string): string => {
  switch (type) {
    case 'RESERVATION':
      return '📅';
    case 'PAYMENT':
      return '💳';
    case 'ALERT':
      return '⚠️';
    case 'SYSTEM':
      return '⚙️';
    case 'INFO':
      return 'ℹ️';
    default:
      return '🔔';
  }
};

const NotificationItem: React.FC<{
  notification: NotificationRecord;
  onDelete: (id: string) => Promise<void>;
  onMarkAsRead: (id: string) => Promise<void>;
  onOpen: (notification: NotificationRecord) => void;
}> = ({ notification, onDelete, onMarkAsRead, onOpen }) => {
  const [deleting, setDeleting] = useState(false);

  return (
    <div
      className={`rounded-2xl transition-all border ${
        notification.isRead
          ? 'glass-subtle border-[var(--ns-glass-line-soft)] opacity-85'
          : 'glass border-[var(--ns-teal)]/40 shadow-sm'
      }`}
    >
      <button
        onClick={() => onOpen(notification)}
        className="group flex w-full items-start gap-3 rounded-t-2xl p-3.5 text-left transition hover:bg-[var(--ns-glass-1)]"
        title="Open notification"
      >
        <span className="mt-0.5 text-lg select-none">{typeIcon(notification.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-xs font-black leading-snug text-[var(--ns-ink)]">{notification.title}</h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-relaxed text-[var(--ns-muted)]">
                {notification.message}
              </p>
            </div>
            {!notification.isRead && (
              <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide border ${priorityColor(notification.priority)}`}>
                {notification.priority}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--ns-muted)] font-medium">
            <span>{new Date(notification.createdAt).toLocaleString()}</span>
            <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100 text-[var(--ns-teal)]" />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-2 border-t border-[var(--ns-glass-line-soft)] px-3.5 py-2">
        {!notification.isRead && (
          <button
            onClick={async () => await onMarkAsRead(notification.id)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[var(--ns-ink)] transition-colors hover:bg-[var(--ns-glass-1)]"
            title="Mark as read"
          >
            <Check size={12} className="text-[var(--ns-teal)]" /> Mark read
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
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[var(--ns-danger)] transition-colors hover:bg-rose-500/10 disabled:opacity-50"
          title="Delete notification"
        >
          <Trash2 size={12} /> {deleting ? 'Deleting...' : 'Delete'}
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

  return (
    <div className="relative z-50 w-[26rem] max-w-[calc(100vw-2rem)] max-h-[min(620px,calc(100dvh-6rem))] flex flex-col origin-top-right overflow-hidden rounded-[24px] glass-strong border border-[var(--ns-glass-line)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ns-glass-line)] ns-glass-band px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-black text-[var(--ns-ink)]">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full border border-[var(--ns-gold)]/40 bg-[var(--ns-gold)]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--ns-gold)]">
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
              className="rounded-lg border border-[var(--ns-glass-line)] bg-[var(--ns-glass-1)] px-2.5 py-1 text-[10px] font-bold text-[var(--ns-ink)] transition-colors hover:bg-[var(--ns-glass-2)]"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ns-muted)] transition-colors hover:bg-[var(--ns-glass-1)] hover:text-[var(--ns-ink)]"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 overscroll-contain">
        {isLoading ? (
          <div className="py-10 text-center text-xs text-[var(--ns-muted)]">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl glass border border-[var(--ns-glass-line)] text-[var(--ns-muted)]">
              <Bell size={20} />
            </div>
            <p className="text-xs font-bold text-[var(--ns-ink)]">No notifications</p>
            <p className="mt-0.5 text-[11px] text-[var(--ns-muted)]">You're completely caught up.</p>
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
