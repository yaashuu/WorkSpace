export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'JOIN_REQUEST_CREATED'
  | 'JOIN_REQUEST_RESOLVED'
  | 'INVITATION_RECEIVED';

export interface NotificationResponse {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface ListNotificationsQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export interface ListNotificationsData {
  notifications: NotificationResponse[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnreadCountData {
  unreadCount: number;
}
