import { apiClient } from './api';
import {
  NotificationResponse,
  ListNotificationsQuery,
  ListNotificationsData,
  UnreadCountData,
} from '../types/notification';

export const notificationApi = {
  /**
   * Retrieves notifications for the authenticated recipient with filtering and pagination.
   * GET /api/v1/notifications
   */
  async getNotifications(query: ListNotificationsQuery = {}): Promise<ListNotificationsData> {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.isRead !== undefined) params.set('isRead', String(query.isRead));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient<{ success: boolean; data: ListNotificationsData }>(
      `/notifications${queryString}`
    );
    return res.data;
  },

  /**
   * Returns the unread notification count for the authenticated recipient.
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(): Promise<number> {
    const res = await apiClient<{ success: boolean; data: UnreadCountData }>(
      '/notifications/unread-count'
    );
    return res.data.unreadCount;
  },

  /**
   * Marks a single notification as read.
   * PATCH /api/v1/notifications/:id/read
   */
  async markAsRead(id: string): Promise<NotificationResponse> {
    const res = await apiClient<{ success: boolean; data: NotificationResponse }>(
      `/notifications/${id}/read`,
      {
        method: 'PATCH',
      }
    );
    return res.data;
  },

  /**
   * Marks all unread notifications for the authenticated recipient as read.
   * PATCH /api/v1/notifications/read-all
   */
  async markAllAsRead(): Promise<{ message: string; modifiedCount: number }> {
    const res = await apiClient<{
      success: boolean;
      data: { message: string; modifiedCount: number };
    }>('/notifications/read-all', {
      method: 'PATCH',
    });
    return res.data;
  },
};
