import { Schema, model, Model, Types } from 'mongoose';

export type MembershipRole = 'MEMBER';
export type MembershipStatus = 'ACTIVE' | 'REVOKED';

export interface IProjectMembership {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectMembershipSchema = new Schema<IProjectMembership>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['MEMBER'],
      default: 'MEMBER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED'],
      default: 'ACTIVE',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
projectMembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMembershipSchema.index({ userId: 1, status: 1 });

export type ProjectMembershipModel = Model<IProjectMembership>;
export const ProjectMembership = model<IProjectMembership, ProjectMembershipModel>(
  'ProjectMembership',
  projectMembershipSchema
);
