import { Request, Response, NextFunction } from 'express';
import { TaskComment, toCommentResponse } from '../models/TaskComment';
import { ActivityLog } from '../models/ActivityLog';
import { createCommentSchema } from '../validations/comment';

/**
 * GET /api/v1/tasks/:id/comments
 * Fetches all comments for a task ordered chronologically.
 * Authorized for active project members, PM, and Admin.
 */
export const listTaskComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = req.task!;

    const comments = await TaskComment.find({ taskId: task._id })
      .populate('authorId', 'fullName email avatarUrl')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: comments.map(toCommentResponse),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/tasks/:id/comments
 * Creates a comment on a task.
 * Authorized for active project members, PM, and Admin.
 */
export const createTaskComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = req.task!;
    const project = req.project!;
    const validated = createCommentSchema.parse(req.body);

    const comment = await TaskComment.create({
      taskId: task._id,
      projectId: project._id,
      authorId: req.user!._id,
      content: validated.content,
    });

    await comment.populate('authorId', 'fullName email avatarUrl');

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'COMMENT_ADDED',
      entityType: 'TASK',
      entityId: task._id,
      metadata: {
        commentId: comment._id.toString(),
        taskId: task._id.toString(),
      },
    });

    res.status(201).json({
      success: true,
      data: toCommentResponse(comment),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
