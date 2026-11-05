import { Schema, model, Model, Types } from 'mongoose';

export type ConversationType = 'PROJECT_GROUP' | 'ADMIN_PM_DM';

export interface IConversation {
  _id: Types.ObjectId;
  type: ConversationType;
  projectId: Types.ObjectId | null;
  participants: Types.ObjectId[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationResponse {
  _id: string;
  type: ConversationType;
  projectId: string | null;
  participants: string[];
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export const toConversationResponse = (conv: any): ConversationResponse => ({
  _id: conv._id.toString(),
  type: conv.type,
  projectId: conv.projectId ? conv.projectId.toString() : null,
  participants: Array.isArray(conv.participants)
    ? conv.participants.map((p: any) => (p ? (p._id ? p._id.toString() : p.toString()) : ''))
    : [],
  lastMessageAt:
    conv.lastMessageAt instanceof Date ? conv.lastMessageAt.toISOString() : String(conv.lastMessageAt),
  createdAt: conv.createdAt instanceof Date ? conv.createdAt.toISOString() : String(conv.createdAt),
  updatedAt: conv.updatedAt instanceof Date ? conv.updatedAt.toISOString() : String(conv.updatedAt),
});

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ['PROJECT_GROUP', 'ADMIN_PM_DM'],
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
conversationSchema.index({ type: 1, projectId: 1 });
conversationSchema.index({ participants: 1 });

export type ConversationModel = Model<IConversation>;
export const Conversation = model<IConversation, ConversationModel>('Conversation', conversationSchema);
