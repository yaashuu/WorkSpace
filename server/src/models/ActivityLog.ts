import { Schema, model, Model, Types } from 'mongoose';

export type ActivityEntityType = 'PROJECT' | 'TASK' | 'MEMBERSHIP' | 'INVITATION';

export interface IActivityLog {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  entityType: ActivityEntityType;
  entityId: Types.ObjectId;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ActivityLogResponse {
  _id: string;
  projectId: string;
  actorId: string;
  actor?: {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  action: string;
  entityType: ActivityEntityType;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const toActivityLogResponse = (log: any): ActivityLogResponse => {
  const isPopulatedUser = (u: any) => u && typeof u === 'object' && u.fullName && u.email;

  const actorObj = isPopulatedUser(log.actorId)
    ? {
        _id: log.actorId._id.toString(),
        fullName: log.actorId.fullName,
        email: log.actorId.email,
        avatarUrl: log.actorId.avatarUrl ?? null,
      }
    : null;

  const rawActorId = isPopulatedUser(log.actorId)
    ? log.actorId._id.toString()
    : log.actorId
    ? log.actorId.toString()
    : '';

  return {
    _id: log._id.toString(),
    projectId: log.projectId.toString(),
    actorId: rawActorId,
    actor: actorObj,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId.toString(),
    metadata: log.metadata ?? {},
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
  };
};

const activityLogSchema = new Schema<IActivityLog>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['PROJECT', 'TASK', 'MEMBERSHIP', 'INVITATION'],
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // ActivityLog is append-only: no updatedAt
    timestamps: { createdAt: true, updatedAt: false },
  }
);

activityLogSchema.index({ projectId: 1, createdAt: -1 });

export type ActivityLogModel = Model<IActivityLog>;
export const ActivityLog = model<IActivityLog, ActivityLogModel>('ActivityLog', activityLogSchema);
