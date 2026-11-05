import { GlobalRole } from './auth';

export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface DetailedProject {
  _id: string;
  name: string;
  key: string;
  description: string;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  createdBy: string;
  primaryManagerId: string;
  primaryManager?: {
    _id: string;
    fullName: string;
    email?: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PublicProjectMetadata {
  _id: string;
  name: string;
  key: string;
  description: string;
  visibility: 'PUBLIC';
  primaryManager: {
    _id: string;
    fullName: string;
    avatarUrl: string | null;
  };
  activeMemberCount: number;
  createdAt: string;
}

export type ProjectItem = DetailedProject | PublicProjectMetadata;

export const isDetailedProject = (project: ProjectItem): project is DetailedProject => {
  return 'primaryManagerId' in project || 'status' in project;
};

export interface EligibleManager {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProjectMemberUser {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
}

export interface ProjectMember {
  _id: string;
  user: ProjectMemberUser | null;
  role: 'MEMBER';
  status: 'ACTIVE' | 'REVOKED';
  isPrimaryManager: boolean;
  joinedAt: string;
}

export interface ProjectInvitation {
  _id: string;
  projectId: string;
  invitedEmail: string | null;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
}

export interface CreateInvitationInput {
  projectId: string;
  invitedEmail?: string | null;
  maxUses?: number;
  expiresInDays?: number;
}

export interface CreateInvitationResponseData {
  invitation: ProjectInvitation;
  token: string;
  inviteLink: string;
}

export interface JoinRequestUser {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface JoinRequest {
  _id: string;
  projectId: string;
  userId: string | JoinRequestUser;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  primaryManagerId: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
