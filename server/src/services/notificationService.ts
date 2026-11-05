import { Types } from 'mongoose';
import {
  Notification,
  NotificationType,
  toNotificationResponse,
  INotification,
} from '../models/Notification';
import { emitNotificationToUser } from '../sockets';

export interface CreateNotificationParams {
  recipientId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

/**
 * Creates and persists a notification in MongoDB, then dispatches a real-time event
 * to the recipient's private user socket room (user:{recipientId}).
 * Guarantees persistence before broadcast.
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<INotification> => {
  const notification = await Notification.create({
    recipientId: new Types.ObjectId(params.recipientId),
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? '',
    isRead: false,
    createdAt: new Date(),
  });

  const formatted = toNotificationResponse(notification);
  emitNotificationToUser(params.recipientId.toString(), formatted);

  return notification;
};
