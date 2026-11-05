export type ConversationType = 'PROJECT_GROUP' | 'ADMIN_PM_DM';

export interface ConversationResponse {
  _id: string;
  type: ConversationType;
  projectId: string | null;
  participants: string[];
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageSender {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface MessageReadBy {
  userId: string;
  readAt: string;
}

export interface MessageResponse {
  _id: string;
  conversationId: string;
  senderId: string;
  sender?: MessageSender | null;
  content: string;
  readBy: MessageReadBy[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageInput {
  content: string;
}

export interface GetMessagesQuery {
  limit?: number;
  before?: string;
}

export interface EnrichedConversationItem {
  conversationId: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  projectId?: string | null;
  projectKey?: string;
  partnerUser?: {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
  lastMessageAt: string;
  unreadCount?: number;
}
