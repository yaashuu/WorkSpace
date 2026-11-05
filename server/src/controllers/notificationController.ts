import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Notification, toNotificationResponse } from '../models/Notification';
import { listNotificationsQuerySchema } from '../validations/notification';
import { AppError } from '../errors/AppError';

/**
 * GET /api/v1/notifications
 * Retrieves notifications for the authenticated recipient with filtering and pagination.
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const query = listNotificationsQuerySchema.parse(req.query);

    const filter: Record<string, unknown> = {
      recipientId: user._id,
    };

    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications.map(toNotificationResponse),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/notifications/unread-count
 * Returns the unread notification count for the authenticated recipient.
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;
    const unreadCount = await Notification.countDocuments({
      recipientId: user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read.
 * Enforces ownership: users cannot modify another user's notifications.
 */
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid notification identifier format', 400, 'INVALID_ID');
    }

    const user = req.user!;
    const notification = await Notification.findById(id);

    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND');
    }

    // Ownership check: strictly isolated to the recipient
    if (!notification.recipientId.equals(user._id)) {
      throw new AppError('You are not authorized to modify this notification', 403, 'FORBIDDEN');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    res.status(200).json({
      success: true,
      data: toNotificationResponse(notification),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all unread notifications for the authenticated recipient as read.
 */
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;

    const result = await Notification.updateMany(
      { recipientId: user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      data: {
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
