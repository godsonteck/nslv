import { create } from 'zustand';
import { notificationsApi, type NotificationRecord } from '../services/apiService';

interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadNotifications: (params?: { page?: number; pageSize?: number; isRead?: boolean }) => Promise<void>;
  getUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await notificationsApi.list({
        pageSize: params?.pageSize || 50,
        isRead: params?.isRead,
        ...params,
      });
      set({ notifications: result.data.items || [], error: null });
    } catch (error) {
      console.error('Failed to load notifications:', error);
      set({ notifications: [], error: 'Unable to load notifications. Check your connection and try again.' });
    } finally {
      set({ isLoading: false });
    }
  },

  getUnreadCount: async () => {
    try {
      const result = await notificationsApi.getUnreadCount();
      set({ unreadCount: result.data.unreadCount });
    } catch (error) {
      console.error('Failed to get unread count:', error);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      await get().getUnreadCount();
      await get().loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
      set({ error: 'Unable to mark that notification as read. Try again.' });
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsApi.markAllAsRead();
      set({ unreadCount: 0 });
      await get().loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      set({ error: 'Unable to mark notifications as read. Try again.' });
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await notificationsApi.delete(id);
      await get().getUnreadCount();
      await get().loadNotifications();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      set({ error: 'Unable to delete that notification. Try again.' });
    }
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0, error: null });
  },
}));
