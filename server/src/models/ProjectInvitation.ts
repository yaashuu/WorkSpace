import { Schema, model, Model, Types } from 'mongoose';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface IProjectInvitation {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  tokenHash: string;
  invitedEmail: string | null;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  maxUses: number;
  usedCount: number;
  usedBy: Types.ObjectId[];
  status: InvitationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectInvitationSchema = new Schema<IProjectInvitation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    invitedEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    maxUses: {
      type: Number,
      default: 1,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedBy: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
// Note: tokenHash index is created via { unique: true } in field definition
projectInvitationSchema.index({ projectId: 1, status: 1 });
projectInvitationSchema.index({ expiresAt: 1 });

export type ProjectInvitationModel = Model<IProjectInvitation>;
export const ProjectInvitation = model<IProjectInvitation, ProjectInvitationModel>(
  'ProjectInvitation',
  projectInvitationSchema
);
