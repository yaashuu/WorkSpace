import { Schema, model, Model, Types } from 'mongoose';

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'JOIN_REQUEST_CREATED'
  | 'JOIN_REQUEST_RESOLVED'
  | 'INVITATION_RECEIVED';

export interface INotification {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
}

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

export const toNotificationResponse = (n: any): NotificationResponse => ({
  _id: n._id.toString(),
  recipientId: n.recipientId ? (n.recipientId._id ? n.recipientId._id.toString() : n.recipientId.toString()) : '',
  type: n.type,
  title: n.title,
  body: n.body,
  link: n.link ?? '',
  isRead: n.isRead ?? false,
  createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : String(n.createdAt),
});

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'TASK_ASSIGNED',
        'TASK_STATUS_CHANGED',
        'JOIN_REQUEST_CREATED',
        'JOIN_REQUEST_RESOLVED',
        'INVITATION_RECEIVED',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export type NotificationModel = Model<INotification>;
export const Notification = model<INotification, NotificationModel>('Notification', notificationSchema);
