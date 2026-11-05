export type ActivityEntityType = 'PROJECT' | 'TASK' | 'MEMBERSHIP' | 'INVITATION';

export interface ActivityActor {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ActivityLogResponse {
  _id: string;
  projectId: string;
  actorId: string;
  actor?: ActivityActor | null;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ListActivityLogsQuery {
  page?: number;
  limit?: number;
  entityType?: ActivityEntityType;
}

export interface ListActivityLogsData {
  activityLogs: ActivityLogResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
