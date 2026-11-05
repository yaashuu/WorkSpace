import { Schema, model, Model, Types } from 'mongoose';

export interface ITaskComment {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  projectId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentResponse {
  _id: string;
  taskId: string;
  projectId: string;
  authorId: string;
  author?: {
    _id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const toCommentResponse = (comment: any): CommentResponse => {
  const isPopulatedUser = (u: any) => u && typeof u === 'object' && u.fullName && u.email;

  const authorObj = isPopulatedUser(comment.authorId)
    ? {
        _id: comment.authorId._id.toString(),
        fullName: comment.authorId.fullName,
        email: comment.authorId.email,
        avatarUrl: comment.authorId.avatarUrl ?? null,
      }
    : null;

  const rawAuthorId = isPopulatedUser(comment.authorId)
    ? comment.authorId._id.toString()
    : comment.authorId
    ? comment.authorId.toString()
    : (comment.populated?.('authorId')?.toString() || '');

  return {
    _id: comment._id.toString(),
    taskId: comment.taskId.toString(),
    projectId: comment.projectId.toString(),
    authorId: rawAuthorId,
    author: authorObj,
    content: comment.content,
    createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : String(comment.createdAt),
    updatedAt: comment.updatedAt instanceof Date ? comment.updatedAt.toISOString() : String(comment.updatedAt),
  };
};

const taskCommentSchema = new Schema<ITaskComment>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index specified in docs/PROJECT_SPEC.md:
taskCommentSchema.index({ taskId: 1, createdAt: 1 });

export type TaskCommentModel = Model<ITaskComment>;
export const TaskComment = model<ITaskComment, TaskCommentModel>('TaskComment', taskCommentSchema);
