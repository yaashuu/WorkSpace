import { apiClient } from './api';
import {
  ConversationResponse,
  MessageResponse,
  GetMessagesQuery,
} from '../types/chat';

export const chatApi = {
  /**
   * Fetches or lazily initializes the project group conversation for authorized members.
   * GET /api/v1/conversations/project/:projectId
   */
  async getProjectConversation(projectId: string): Promise<ConversationResponse> {
    const res = await apiClient<{ success: boolean; data: ConversationResponse }>(
      `/conversations/project/${projectId}`
    );
    return res.data;
  },

  /**
   * Fetches or initializes a private 1-on-1 direct conversation between Admin and Project Manager.
   * GET /api/v1/conversations/admin-pm/:managerId
   */
  async getAdminPmConversation(managerId: string): Promise<ConversationResponse> {
    const res = await apiClient<{ success: boolean; data: ConversationResponse }>(
      `/conversations/admin-pm/${managerId}`
    );
    return res.data;
  },

  /**
   * Retrieves reverse-chronological message history for a conversation.
   * GET /api/v1/conversations/:id/messages
   */
  async getMessages(
    conversationId: string,
    query: GetMessagesQuery = {}
  ): Promise<MessageResponse[]> {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.before) params.set('before', query.before);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient<{ success: boolean; data: MessageResponse[] }>(
      `/conversations/${conversationId}/messages${queryString}`
    );
    return res.data;
  },

  /**
   * Sends a message in a conversation via HTTP API.
   * POST /api/v1/conversations/:id/messages
   */
  async sendMessage(conversationId: string, content: string): Promise<MessageResponse> {
    const res = await apiClient<{ success: boolean; data: MessageResponse }>(
      `/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
    return res.data;
  },
};
