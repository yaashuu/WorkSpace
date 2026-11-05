import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  ArrowRight,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { notificationApi } from '../lib/notificationApi';
import { subscribeToNotification } from '../lib/socket';
import { NotificationResponse, NotificationType } from '../types/notification';
import { ApiClientError } from '../lib/api';

export interface NotificationsPageProps {
  onNavigateToLink?: (link: string) => void;
  onTriggerToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message?: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

const getNotificationBadgeVariant = (type: NotificationType) => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return 'primary';
    case 'TASK_STATUS_CHANGED':
      return 'warning';
    case 'JOIN_REQUEST_CREATED':
      return 'info';
    case 'JOIN_REQUEST_RESOLVED':
      return 'primary';
    case 'INVITATION_RECEIVED':
      return 'primary';
    default:
      return 'neutral';
  }
};

const formatNotificationType = (type: NotificationType): string => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return 'Task Assignment';
    case 'TASK_STATUS_CHANGED':
      return 'Status Update';
    case 'JOIN_REQUEST_CREATED':
      return 'Join Request';
    case 'JOIN_REQUEST_RESOLVED':
      return 'Membership Decision';
    case 'INVITATION_RECEIVED':
      return 'Project Invitation';
    default:
      return type;
  }
};

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onNavigateToLink,
  onTriggerToast,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNREAD'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationApi.getNotifications({
        limit: 50,
        isRead: filterMode === 'UNREAD' ? false : undefined,
      });
      setNotifications(data.notifications);
      if (onUnreadCountChange) {
        onUnreadCountChange(data.unreadCount);
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to fetch notifications';
      onTriggerToast('error', 'Notification Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [filterMode]);

  // Real-time listener for incoming notifications
  useEffect(() => {
    const unsub = subscribeToNotification((incoming) => {
      setNotifications((prev) => {
        // Prevent duplicate
        if (prev.some((n) => n._id === incoming._id)) return prev;
        return [incoming, ...prev];
      });
    });

    return () => {
      unsub();
    };
  }, []);

  const handleMarkAsRead = async (notif: NotificationResponse, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (notif.isRead) return;

    setMarkingReadId(notif._id);
    try {
      await notificationApi.markAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      // Decrement unread count
      const newCount = await notificationApi.getUnreadCount();
      if (onUnreadCountChange) onUnreadCountChange(newCount);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to mark as read';
      onTriggerToast('error', 'Error', msg);
    } finally {
      setMarkingReadId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
      onTriggerToast('success', 'All Read', 'All notifications marked as read.');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to mark all as read';
      onTriggerToast('error', 'Error', msg);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notif: NotificationResponse) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif);
    }
    if (notif.link && onNavigateToLink) {
      onNavigateToLink(notif.link);
    }
  };

  const unreadTotal = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center font-bold">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Notification Center
              {unreadTotal > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadTotal} unread
                </Badge>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Live updates on task assignments, workflow moves, and membership events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadNotifications}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {unreadTotal > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              isLoading={isMarkingAll}
              leftIcon={<CheckCheck className="w-3.5 h-3.5 text-primary" />}
            >
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterMode('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterMode === 'ALL'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          All Activity
        </button>

        <button
          onClick={() => setFilterMode('UNREAD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterMode === 'UNREAD'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          Unread Only {unreadTotal > 0 ? `(${unreadTotal})` : ''}
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-2 bg-white rounded-xl border border-slate-200/80">
          <Spinner size="lg" />
          <span className="text-xs">Fetching notification feed...</span>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-8 h-8" />}
          title={filterMode === 'UNREAD' ? 'All caught up!' : 'No notifications'}
          description={
            filterMode === 'UNREAD'
              ? 'You have addressed all unread alerts. Check back later for new task or project updates.'
              : 'You have not received any notifications yet.'
          }
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isClickable = Boolean(notif.link);
            const timeAgo = new Date(notif.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card
                key={notif._id}
                hoverable={isClickable}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer ${
                  !notif.isRead
                    ? 'border-primary-200 bg-primary-50/20 shadow-xs'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      !notif.isRead
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        {notif.title}
                      </span>
                      <Badge variant={getNotificationBadgeVariant(notif.type)} size="sm">
                        {formatNotificationType(notif.type)}
                      </Badge>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo}
                      </span>
                      {notif.link && (
                        <span className="text-primary font-semibold flex items-center gap-0.5">
                          Follow reference <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!notif.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleMarkAsRead(notif, e)}
                      isLoading={markingReadId === notif._id}
                      className="text-xs text-primary hover:bg-primary-50"
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
