import { Schema, model, Model, Types } from 'mongoose';

export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IJoinRequest {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  userId: Types.ObjectId;
  status: JoinRequestStatus;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const joinRequestSchema = new Schema<IJoinRequest>(
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
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
joinRequestSchema.index({ projectId: 1, userId: 1, status: 1 });
joinRequestSchema.index({ projectId: 1, status: 1 });

export type JoinRequestModel = Model<IJoinRequest>;
export const JoinRequest = model<IJoinRequest, JoinRequestModel>('JoinRequest', joinRequestSchema);
