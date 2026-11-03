import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationPanel } from './NotificationPanel';
import { useNotificationStore } from '../../stores/notificationStore';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../stores/notificationStore', () => ({
  useNotificationStore: vi.fn(),
}));

describe('NotificationPanel', () => {
  beforeEach(() => {
    vi.mocked(useNotificationStore).mockReturnValue({
      notifications: [
        {
          id: 'notice-1',
          userId: 'user-1',
          type: 'ALERT',
          title: 'Maintenance window',
          message: 'Pool systems will be offline overnight.',
          priority: 'HIGH',
          data: null,
          isRead: false,
          readAt: null,
          createdAt: '2026-11-03T09:00:00.000Z',
          expiresAt: null,
        },
      ],
      unreadCount: 1,
      isLoading: false,
      loadNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteNotification: vi.fn(),
    } as any);
  });

  it('applies the theme-aware notification row classes for unread items', () => {
    const html = renderToStaticMarkup(<NotificationPanel onClose={vi.fn()} />);

    expect(html).toContain('ns-notif-item');
    expect(html).toContain('ns-notif-item--unread');
  });
});
