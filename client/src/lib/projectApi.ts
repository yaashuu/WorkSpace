import { apiClient } from './api';
import {
  ProjectItem,
  DetailedProject,
  PublicProjectMetadata,
  EligibleManager,
  ProjectMember,
  CreateInvitationInput,
  CreateInvitationResponseData,
  JoinRequest,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectVisibility,
} from '../types/project';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export const projectApi = {
  /**
   * Fetch all projects visible to the authenticated user.
   * Admins receive all projects. Members/PMs receive joined projects and discoverable public metadata.
   */
  async getProjects(): Promise<ProjectItem[]> {
    const res = await apiClient<ApiResponse<{ projects: ProjectItem[] }>>('/projects');
    return res.data.projects;
  },

  /**
   * Fetch project details by ID.
   * Members and Admins receive detailed project data; non-members receive public metadata (or 404 if private).
   */
  async getProjectById(id: string): Promise<DetailedProject | PublicProjectMetadata> {
    const res = await apiClient<ApiResponse<{ project: DetailedProject | PublicProjectMetadata }>>(
      `/projects/${id}`
    );
    return res.data.project;
  },

  /**
   * Create a new project workstream (Organization Administrator exclusive).
   */
  async createProject(input: CreateProjectInput): Promise<DetailedProject> {
    const res = await apiClient<ApiResponse<{ project: DetailedProject }>>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data.project;
  },

  /**
   * Update general project details (Organization Administrator exclusive).
   */
  async updateProject(id: string, input: UpdateProjectInput): Promise<DetailedProject> {
    const res = await apiClient<ApiResponse<{ project: DetailedProject }>>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return res.data.project;
  },

  /**
   * Update project visibility scope (Organization Administrator exclusive).
   */
  async updateVisibility(id: string, visibility: ProjectVisibility): Promise<DetailedProject> {
    const res = await apiClient<ApiResponse<{ project: DetailedProject }>>(
      `/projects/${id}/visibility`,
      {
        method: 'PATCH',
        body: JSON.stringify({ visibility }),
      }
    );
    return res.data.project;
  },

  /**
   * Reassign project's primary manager (Organization Administrator exclusive).
   * Automatically retains outgoing manager as an active regular member.
   */
  async replacePrimaryManager(id: string, primaryManagerId: string): Promise<DetailedProject> {
    const res = await apiClient<ApiResponse<{ project: DetailedProject }>>(
      `/projects/${id}/primary-manager`,
      {
        method: 'PATCH',
        body: JSON.stringify({ primaryManagerId }),
      }
    );
    return res.data.project;
  },

  /**
   * Fetch eligible standard user accounts for Primary Project Manager designation (Admin only).
   */
  async getEligibleManagers(): Promise<EligibleManager[]> {
    const res = await apiClient<ApiResponse<{ managers: EligibleManager[]; total: number }>>(
      '/users/eligible-managers'
    );
    return res.data.managers;
  },

  /**
   * Fetch active project members (Admin, Primary PM, or Project Member).
   */
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const res = await apiClient<ApiResponse<{ members: ProjectMember[]; total: number }>>(
      `/projects/${projectId}/members`
    );
    return res.data.members;
  },

  /**
   * Remove an active member from the project (Admin or Primary PM).
   */
  async removeProjectMember(projectId: string, userId: string): Promise<{ message: string }> {
    const res = await apiClient<ApiResponse<{ message: string }>>(
      `/projects/${projectId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    );
    return res.data;
  },

  /**
   * Generate an invitation token / link (Admin or Primary PM).
   */
  async createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResponseData> {
    const res = await apiClient<ApiResponse<CreateInvitationResponseData>>('/invitations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return res.data;
  },

  /**
   * Accept an invitation token for authenticated user.
   */
  async acceptInvitation(token: string): Promise<{
    message: string;
    project: DetailedProject;
    membership: { _id: string; role: string; status: string; joinedAt: string };
  }> {
    const res = await apiClient<
      ApiResponse<{
        message: string;
        project: DetailedProject;
        membership: { _id: string; role: string; status: string; joinedAt: string };
      }>
    >('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    return res.data;
  },

  /**
   * Submit a join request for a public project (Standard User non-member).
   */
  async submitJoinRequest(projectId: string): Promise<JoinRequest> {
    const res = await apiClient<ApiResponse<{ joinRequest: JoinRequest }>>(
      `/projects/${projectId}/join-requests`,
      {
        method: 'POST',
      }
    );
    return res.data.joinRequest;
  },

  /**
   * List pending join requests for a project (Admin or Primary PM).
   */
  async getProjectJoinRequests(projectId: string): Promise<JoinRequest[]> {
    const res = await apiClient<ApiResponse<{ joinRequests: JoinRequest[] }>>(
      `/projects/${projectId}/join-requests`
    );
    return res.data.joinRequests;
  },

  /**
   * Approve a pending join request (Admin or Primary PM).
   */
  async approveJoinRequest(requestId: string): Promise<{ message: string; joinRequest: JoinRequest }> {
    const res = await apiClient<ApiResponse<{ message: string; joinRequest: JoinRequest }>>(
      `/join-requests/${requestId}/approve`,
      {
        method: 'PATCH',
      }
    );
    return res.data;
  },

  /**
   * Reject a pending join request (Admin or Primary PM).
   */
  async rejectJoinRequest(
    requestId: string,
    rejectionReason?: string
  ): Promise<{ message: string; joinRequest: JoinRequest }> {
    const res = await apiClient<ApiResponse<{ message: string; joinRequest: JoinRequest }>>(
      `/join-requests/${requestId}/reject`,
      {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason: rejectionReason || null }),
      }
    );
    return res.data;
  },
};
