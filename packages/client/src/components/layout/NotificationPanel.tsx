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
      return 'text-red-600 bg-red-50 border-red-200';
    case 'HIGH':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'MEDIUM':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-slate-600 bg-slate-50 border-slate-200';
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
    <div className={`border rounded-lg transition-all ${notification.isRead ? 'bg-slate-50 border-slate-200' : 'bg-white border-blue-300'}`}>
      <button
        onClick={() => onOpen(notification)}
        className="group flex w-full items-start gap-3 rounded-t-lg p-3 text-left"
        title="Open notification"
      >
        <span className="text-lg mt-0.5">{typeIcon(notification.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="text-xs font-semibold text-slate-800">{notification.title}</h4>
              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
            </div>
            {!notification.isRead && (
              <span className={`inline-block px-2 py-1 rounded text-[10px] font-semibold uppercase whitespace-nowrap ${priorityColor(notification.priority)}`}>
                {notification.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5">
            {new Date(notification.createdAt).toLocaleString()}
            <ArrowUpRight size={11} className="opacity-0 transition group-hover:opacity-100" />
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5 px-3 pb-2 border-t border-slate-200">
        {!notification.isRead && (
          <button
            onClick={async () => await onMarkAsRead(notification.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-600 hover:bg-slate-100"
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
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-600 hover:bg-red-50 disabled:opacity-50"
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
    <div className="absolute right-0 top-12 w-96 max-h-[600px] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-[11px] text-slate-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={async () => {
                await markAllAsRead();
                showToast('success', 'All notifications marked as read');
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell size={24} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">No notifications yet</p>
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
