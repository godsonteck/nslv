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
      return 'glass-subtle text-[var(--ns-danger)] border-[var(--ns-danger)]';
    case 'HIGH':
      return 'glass-subtle text-[var(--ns-warning)] border-[var(--ns-warning)]';
    case 'MEDIUM':
      return 'glass-subtle text-[var(--ns-info)] border-[var(--ns-info)]';
    default:
      return 'glass-subtle text-[var(--ns-muted)] border-[var(--ns-glass-line)]';
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
      className={`border rounded-xl skeuo-card transition-all ${
        notification.isRead
          ? 'border-[var(--ns-glass-line-soft)] bg-[var(--ns-glass-1)]'
          : 'border-[var(--ns-glass-line)] bg-[var(--ns-glass-2)]'
      }`}
    >
      <button
        onClick={() => onOpen(notification)}
        className="group flex w-full items-start gap-3 rounded-t-lg p-3 text-left"
        title="Open notification"
      >
        <span className="mt-0.5 text-lg">{typeIcon(notification.type)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-xs font-black" style={{ color: 'var(--ns-ink)' }}>{notification.title}</h4>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold" style={{ color: 'var(--ns-muted)' }}>{notification.message}</p>
            </div>
            {!notification.isRead && (
              <span className={`inline-block whitespace-nowrap rounded px-2 py-1 text-[10px] font-black uppercase skeuo-badge border ${priorityColor(notification.priority)}`}>
                {notification.priority}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: 'var(--ns-muted)' }}>
            {new Date(notification.createdAt).toLocaleString()}
            <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100" />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5 border-t border-[var(--ns-glass-line-soft)] px-3 pb-2 pt-2">
        {!notification.isRead && (
          <button
            onClick={async () => await onMarkAsRead(notification.id)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors hover:bg-[var(--ns-glass-1)]"
            style={{ color: 'var(--ns-ink)' }}
            title="Mark as read"
          >
            <Check size={12} /> Mark read
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
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ns-glass-hover disabled:opacity-50"
          style={{ color: 'var(--ns-danger)' }}
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
    <div className="glass-strong skeuo-card absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] max-h-[min(600px,calc(100dvh-6rem))] rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-[var(--ns-glass-line)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ns-glass-line-soft)] p-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--ns-ink)' }}>Notifications</h2>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--ns-muted)' }}>{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={async () => {
                await markAllAsRead();
                showToast('success', 'All notifications marked as read');
              }}
              className="rounded-lg p-1.5 text-xs font-semibold transition-colors hover:bg-[var(--ns-glass-1)]"
              style={{ color: 'var(--ns-ink)' }}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--ns-glass-1)]"
            style={{ color: 'var(--ns-muted)' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--ns-muted)' }}>Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell size={24} className="mx-auto mb-2" style={{ color: 'var(--ns-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--ns-muted)' }}>No notifications yet</p>
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
