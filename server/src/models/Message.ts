import { Schema, model, Model, Types } from 'mongoose';

export interface IMessageReadReceipt {
  userId: Types.ObjectId;
  readAt: Date;
}

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  readBy: IMessageReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageResponse {
  _id: string;
  conversationId: string;
  senderId: string;
  sender?: {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  content: string;
  readBy: {
    userId: string;
    readAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export const toMessageResponse = (msg: any): MessageResponse => {
  const isPopulatedUser = (u: any) => u && typeof u === 'object' && u.fullName && u.email;

  const senderObj = isPopulatedUser(msg.senderId)
    ? {
        _id: msg.senderId._id.toString(),
        fullName: msg.senderId.fullName,
        email: msg.senderId.email,
        avatarUrl: msg.senderId.avatarUrl ?? null,
      }
    : null;

  const rawSenderId = isPopulatedUser(msg.senderId)
    ? msg.senderId._id.toString()
    : msg.senderId
    ? msg.senderId.toString()
    : '';

  return {
    _id: msg._id.toString(),
    conversationId: msg.conversationId.toString(),
    senderId: rawSenderId,
    sender: senderObj,
    content: msg.content,
    readBy: Array.isArray(msg.readBy)
      ? msg.readBy.map((r: any) => ({
          userId: r.userId ? (r.userId._id ? r.userId._id.toString() : r.userId.toString()) : '',
          readAt: r.readAt instanceof Date ? r.readAt.toISOString() : String(r.readAt),
        }))
      : [],
    createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt),
    updatedAt: msg.updatedAt instanceof Date ? msg.updatedAt.toISOString() : String(msg.updatedAt),
  };
};

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    readBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for reverse-chronological chat pagination (docs/PROJECT_SPEC.md):
messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageModel = Model<IMessage>;
export const Message = model<IMessage, MessageModel>('Message', messageSchema);
