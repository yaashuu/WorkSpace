import { apiClient } from './api';
import {
  ListActivityLogsQuery,
  ListActivityLogsData,
} from '../types/activity';

export const activityApi = {
  /**
   * Retrieves the activity history feed for a project.
   * Authorized for Admin, Primary PM, and active project members.
   * GET /api/v1/projects/:id/activity
   */
  async getProjectActivity(
    projectId: string,
    query: ListActivityLogsQuery = {}
  ): Promise<ListActivityLogsData> {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.entityType) params.set('entityType', query.entityType);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient<{ success: boolean; data: ListActivityLogsData }>(
      `/projects/${projectId}/activity${queryString}`
    );
    return res.data;
  },
};
