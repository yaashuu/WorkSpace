import { Schema, model, Model, Types } from 'mongoose';

export type ProjectVisibility = 'PUBLIC' | 'PRIVATE';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export interface IProject {
  _id: Types.ObjectId;
  name: string;
  key: string;
  description: string;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  createdBy: Types.ObjectId;
  primaryManagerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetailedProjectResponse {
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
    email: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PublicProjectMetadataResponse {
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

export const toProjectResponse = (project: any): DetailedProjectResponse => {
  const pmId = project.primaryManagerId?._id
    ? project.primaryManagerId._id.toString()
    : project.primaryManagerId?.toString() ?? (project.populated?.('primaryManagerId')?.toString() || '');

  const createdById = project.createdBy?._id
    ? project.createdBy._id.toString()
    : project.createdBy?.toString() ?? (project.populated?.('createdBy')?.toString() || '');

  return {
    _id: project._id ? project._id.toString() : '',
    name: project.name,
    key: project.key,
    description: project.description ?? '',
    visibility: project.visibility,
    status: project.status,
    createdBy: createdById,
    primaryManagerId: pmId,
    ...(project.primaryManagerId &&
    typeof project.primaryManagerId === 'object' &&
    project.primaryManagerId.fullName
      ? {
          primaryManager: {
            _id: project.primaryManagerId._id ? project.primaryManagerId._id.toString() : pmId,
            fullName: project.primaryManagerId.fullName,
            email: project.primaryManagerId.email,
            avatarUrl: project.primaryManagerId.avatarUrl ?? null,
          },
        }
      : {}),
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : String(project.updatedAt),
  };
};

export const toPublicProjectMetadata = (
  project: any,
  activeMemberCount: number
): PublicProjectMetadataResponse => {
  const pmId = project.primaryManagerId?._id
    ? project.primaryManagerId._id.toString()
    : project.primaryManagerId?.toString() ?? (project.populated?.('primaryManagerId')?.toString() || '');

  return {
    _id: project._id ? project._id.toString() : '',
    name: project.name,
    key: project.key,
    description: project.description ?? '',
    visibility: 'PUBLIC',
    primaryManager: {
      _id: pmId,
      fullName:
        project.primaryManagerId &&
        typeof project.primaryManagerId === 'object' &&
        project.primaryManagerId.fullName
          ? project.primaryManagerId.fullName
          : 'Assigned Manager',
      avatarUrl:
        project.primaryManagerId && typeof project.primaryManagerId === 'object'
          ? (project.primaryManagerId.avatarUrl ?? null)
          : null,
    },
    activeMemberCount,
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : String(project.createdAt),
  };
};

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      default: 'PRIVATE',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    primaryManagerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
// Note: key index is created via { unique: true } in field definition
projectSchema.index({ primaryManagerId: 1 });
projectSchema.index({ visibility: 1, status: 1 });

export type ProjectModel = Model<IProject>;
export const Project = model<IProject, ProjectModel>('Project', projectSchema);
