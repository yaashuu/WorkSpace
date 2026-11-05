import { Schema, model, Model, Types } from 'mongoose';

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'TESTING' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ITask {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: Types.ObjectId | null;
  creatorId: Types.ObjectId;
  dueDate: Date | null;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResponse {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee?: {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  creatorId: string;
  creator?: {
    _id: string;
    fullName: string;
    email: string;
  } | null;
  dueDate: string | null;
  position: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const toTaskResponse = (task: any): TaskResponse => {
  const isPopulatedUser = (u: any) => u && typeof u === 'object' && u.fullName && u.email;

  const assigneeObj = isPopulatedUser(task.assigneeId)
    ? {
        _id: task.assigneeId._id.toString(),
        fullName: task.assigneeId.fullName,
        email: task.assigneeId.email,
        avatarUrl: task.assigneeId.avatarUrl ?? null,
      }
    : null;

  const creatorObj = isPopulatedUser(task.creatorId)
    ? {
        _id: task.creatorId._id.toString(),
        fullName: task.creatorId.fullName,
        email: task.creatorId.email,
      }
    : null;

  const rawAssigneeId = isPopulatedUser(task.assigneeId)
    ? task.assigneeId._id.toString()
    : task.assigneeId
    ? task.assigneeId.toString()
    : (task.populated?.('assigneeId')?.toString() || null);

  const rawCreatorId = isPopulatedUser(task.creatorId)
    ? task.creatorId._id.toString()
    : task.creatorId
    ? task.creatorId.toString()
    : (task.populated?.('creatorId')?.toString() || '');

  return {
    _id: task._id.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    assigneeId: rawAssigneeId,
    assignee: assigneeObj,
    creatorId: rawCreatorId,
    creator: creatorObj,
    dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate ?? null,
    position: task.position,
    version: task.version ?? 0,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : String(task.createdAt),
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : String(task.updatedAt),
  };
};

const taskSchema = new Schema<ITask>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'TESTING', 'DONE'],
      default: 'BACKLOG',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    position: {
      type: Number,
      required: true,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in docs/PROJECT_SPEC.md:
taskSchema.index({ projectId: 1, status: 1, position: 1 });
taskSchema.index({ assigneeId: 1, status: 1 });

export type TaskModel = Model<ITask>;
export const Task = model<ITask, TaskModel>('Task', taskSchema);
