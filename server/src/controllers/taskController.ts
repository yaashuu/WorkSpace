import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Task, TaskStatus, toTaskResponse } from '../models/Task';
import { TaskComment } from '../models/TaskComment';
import { User } from '../models/User';
import { ProjectMembership } from '../models/ProjectMembership';
import { ActivityLog } from '../models/ActivityLog';
import {
  createTaskSchema,
  updateTaskSchema,
  moveTaskStatusSchema,
  taskStatuses,
} from '../validations/task';
import { broadcastTaskEvent } from '../sockets';
import { createNotification } from '../services/notificationService';
import { AppError } from '../errors/AppError';

/**
 * Rebalances task positions within a specific column to evenly spaced integers (1000, 2000, 3000, ...)
 * Triggered when position gap falls below 1e-6 to prevent floating-point precision loss.
 */
export const rebalanceColumn = async (
  projectId: Types.ObjectId | string,
  status: TaskStatus
): Promise<void> => {
  const tasks = await Task.find({ projectId, status })
    .sort({ position: 1, createdAt: 1, _id: 1 })
    .select('_id position');

  if (tasks.length === 0) return;

  const bulkOps = tasks.map((t, idx) => ({
    updateOne: {
      filter: { _id: t._id },
      update: { $set: { position: (idx + 1) * 1000 } },
    },
  }));

  await Task.bulkWrite(bulkOps);
};

/**
 * Validates that an assignee exists, is active, and is either the Primary PM or an active member of this project.
 */
const validateAssignee = async (
  assigneeId: string,
  projectId: Types.ObjectId,
  primaryManagerId: Types.ObjectId
): Promise<void> => {
  const assigneeUser = await User.findById(assigneeId);
  if (!assigneeUser || !assigneeUser.isActive) {
    throw new AppError('Assigned user not found or inactive', 400, 'INVALID_ASSIGNEE');
  }

  // Admin or Primary PM can always be assigned
  if (assigneeUser.globalRole === 'ADMIN' || primaryManagerId.equals(assigneeUser._id)) {
    return;
  }

  // Otherwise must have active project membership
  const membership = await ProjectMembership.exists({
    projectId,
    userId: assigneeUser._id,
    status: 'ACTIVE',
  });

  if (!membership) {
    throw new AppError('Assignee must be an active member of this project', 400, 'INVALID_ASSIGNEE');
  }
};

/**
 * POST /api/v1/projects/:id/tasks
 * Admin or PM creates a new task. Placed at the bottom of the target column.
 */
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = req.project!;
    const validated = createTaskSchema.parse(req.body);

    if (validated.assigneeId) {
      await validateAssignee(validated.assigneeId, project._id, project.primaryManagerId);
    }

    // Default to the bottom of the target column: Plast + 1000, or 1000 if empty
    const lastTask = await Task.findOne({
      projectId: project._id,
      status: validated.status,
    })
      .sort({ position: -1 })
      .select('position')
      .lean();

    const position = lastTask ? lastTask.position + 1000 : 1000;

    const task = await Task.create({
      projectId: project._id,
      title: validated.title,
      description: validated.description,
      status: validated.status,
      priority: validated.priority,
      assigneeId: validated.assigneeId ? new Types.ObjectId(validated.assigneeId) : null,
      creatorId: req.user!._id,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      position,
      version: 0,
    });

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'TASK_CREATED',
      entityType: 'TASK',
      entityId: task._id,
      metadata: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId?.toString() ?? null,
      },
    });

    const formatted = toTaskResponse(task);
    broadcastTaskEvent(project._id, 'task:created', formatted);

    // Notify assigned user if assigned by another team member
    if (task.assigneeId && !task.assigneeId.equals(req.user!._id)) {
      await createNotification({
        recipientId: task.assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        body: `You have been assigned to task "${task.title}".`,
        link: `/projects/${project._id}/tasks/${task._id}`,
      });
    }

    res.status(201).json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/projects/:id/tasks
 * Lists tasks for a project ordered deterministically by position, createdAt, and _id.
 */
export const getProjectTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = req.project!;
    const filter: Record<string, unknown> = { projectId: project._id };

    if (req.query.status && typeof req.query.status === 'string') {
      const statusParam = req.query.status.toUpperCase() as TaskStatus;
      if (taskStatuses.includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    const tasks = await Task.find(filter)
      .populate('assigneeId', 'fullName email avatarUrl')
      .populate('creatorId', 'fullName email')
      .sort({ position: 1, createdAt: 1, _id: 1 });

    res.status(200).json({
      success: true,
      data: tasks.map(toTaskResponse),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/tasks/:id
 * Fetches a single task by ID.
 */
export const getTaskById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await Task.findById(req.task!._id)
      .populate('assigneeId', 'fullName email avatarUrl')
      .populate('creatorId', 'fullName email');

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: toTaskResponse(task),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/tasks/:id
 * Updates task metadata (title, description, priority, assignee, due date). Admin or PM only.
 */
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = req.task!;
    const project = req.project!;
    const validated = updateTaskSchema.parse(req.body);

    if (validated.assigneeId) {
      await validateAssignee(validated.assigneeId, project._id, project.primaryManagerId);
    }

    const updateFields: Record<string, unknown> = {};
    if (validated.title !== undefined) updateFields.title = validated.title;
    if (validated.description !== undefined) updateFields.description = validated.description;
    if (validated.priority !== undefined) updateFields.priority = validated.priority;
    if (validated.assigneeId !== undefined) {
      updateFields.assigneeId = validated.assigneeId ? new Types.ObjectId(validated.assigneeId) : null;
    }
    if (validated.dueDate !== undefined) {
      updateFields.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    }

    const updated = await Task.findByIdAndUpdate(
      task._id,
      {
        $set: updateFields,
        $inc: { version: 1 },
      },
      { returnDocument: 'after' }
    )
      .populate('assigneeId', 'fullName email avatarUrl')
      .populate('creatorId', 'fullName email');

    if (!updated) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'TASK_UPDATED',
      entityType: 'TASK',
      entityId: task._id,
      metadata: {
        updatedFields: Object.keys(updateFields),
      },
    });

    const formatted = toTaskResponse(updated);
    broadcastTaskEvent(project._id, 'task:updated', formatted);

    // Notify new assignee if task was reassigned
    if (
      validated.assigneeId &&
      (!task.assigneeId || !task.assigneeId.equals(validated.assigneeId)) &&
      validated.assigneeId !== req.user!._id.toString()
    ) {
      await createNotification({
        recipientId: validated.assigneeId,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        body: `You have been assigned to task "${updated.title}".`,
        link: `/projects/${project._id}/tasks/${updated._id}`,
      });
    }

    res.status(200).json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/tasks/:id/status
 * Moves a task to a new status and/or calculates its fractional position.
 * Authorized for Admin, PM, or the task's assigned employee.
 * Enforces optimistic concurrency control (version).
 */
export const moveTaskStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = req.task!;
    const project = req.project!;
    const validated = moveTaskStatusSchema.parse(req.body);

    // Concurrency control: reject stale drag-and-drop actions
    if (task.version !== validated.version) {
      throw new AppError(
        'Task was modified concurrently by another user',
        409,
        'CONCURRENT_MODIFICATION',
        {
          currentVersion: task.version,
          currentStatus: task.status,
          currentPosition: task.position,
        }
      );
    }

    const newStatus = validated.status ?? task.status;
    let newPosition: number;
    let shouldRebalance = false;

    if (validated.targetPosition !== undefined) {
      newPosition = validated.targetPosition;
    } else if (validated.previousTaskId || validated.nextTaskId) {
      let prevPos: number | null = null;
      let nextPos: number | null = null;

      if (validated.previousTaskId) {
        const prevTask = await Task.findById(validated.previousTaskId);
        if (!prevTask || !prevTask.projectId.equals(project._id) || prevTask.status !== newStatus) {
          throw new AppError('Previous task not found in target status column', 400, 'INVALID_POSITION_REFERENCE');
        }
        prevPos = prevTask.position;
      }

      if (validated.nextTaskId) {
        const nextTask = await Task.findById(validated.nextTaskId);
        if (!nextTask || !nextTask.projectId.equals(project._id) || nextTask.status !== newStatus) {
          throw new AppError('Next task not found in target status column', 400, 'INVALID_POSITION_REFERENCE');
        }
        nextPos = nextTask.position;
      }

      if (prevPos !== null && nextPos !== null) {
        newPosition = (prevPos + nextPos) / 2;
        // Rebalance trigger: gap falls below 1e-6
        if (Math.abs(prevPos - nextPos) < 1e-6) {
          shouldRebalance = true;
        }
      } else if (nextPos !== null) {
        // Moved to the top of the column
        if (nextPos > 1000) {
          newPosition = nextPos - 1000;
        } else {
          newPosition = nextPos / 2;
        }
      } else if (prevPos !== null) {
        // Moved after previous task
        newPosition = prevPos + 1000;
      } else {
        newPosition = 1000;
      }
    } else {
      // Default to bottom of destination column
      const lastTask = await Task.findOne({
        projectId: project._id,
        status: newStatus,
        _id: { $ne: task._id },
      })
        .sort({ position: -1 })
        .select('position')
        .lean();

      newPosition = lastTask ? lastTask.position + 1000 : 1000;
    }

    // Atomic optimistic update with version increment
    const updated = await Task.findOneAndUpdate(
      { _id: task._id, version: validated.version },
      {
        $set: {
          status: newStatus,
          position: newPosition,
          version: validated.version + 1,
        },
      },
      { returnDocument: 'after' }
    )
      .populate('assigneeId', 'fullName email avatarUrl')
      .populate('creatorId', 'fullName email');

    if (!updated) {
      throw new AppError('Task was modified concurrently by another user', 409, 'CONCURRENT_MODIFICATION');
    }

    let finalTask = updated;
    if (shouldRebalance) {
      await rebalanceColumn(project._id, newStatus);
      const rebalanced = await Task.findById(task._id)
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('creatorId', 'fullName email');
      if (rebalanced) {
        finalTask = rebalanced;
      }
    }

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'TASK_MOVED',
      entityType: 'TASK',
      entityId: finalTask._id,
      metadata: {
        previousStatus: task.status,
        newStatus: finalTask.status,
        previousPosition: task.position,
        newPosition: finalTask.position,
        version: finalTask.version,
        rebalanced: shouldRebalance,
      },
    });

    const formatted = toTaskResponse(finalTask);
    broadcastTaskEvent(project._id, 'task:moved', formatted);
    if (shouldRebalance) {
      broadcastTaskEvent(project._id, 'board:rebalanced', {
        projectId: project._id.toString(),
        status: newStatus,
      });
    }

    // Trigger TASK_STATUS_CHANGED notifications
    if (newStatus !== task.status) {
      if (task.assigneeId && !task.assigneeId.equals(req.user!._id)) {
        await createNotification({
          recipientId: task.assigneeId,
          type: 'TASK_STATUS_CHANGED',
          title: 'Task Status Updated',
          body: `Task "${task.title}" status changed to ${newStatus}.`,
          link: `/projects/${project._id}/tasks/${task._id}`,
        });
      } else if (
        task.assigneeId &&
        task.assigneeId.equals(req.user!._id) &&
        !project.primaryManagerId.equals(req.user!._id)
      ) {
        await createNotification({
          recipientId: project.primaryManagerId,
          type: 'TASK_STATUS_CHANGED',
          title: 'Task Status Updated',
          body: `Task "${task.title}" status changed to ${newStatus}.`,
          link: `/projects/${project._id}/tasks/${task._id}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/tasks/:id
 * Deletes a task and its comments. Admin or PM only.
 */
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = req.task!;
    const project = req.project!;

    await TaskComment.deleteMany({ taskId: task._id });
    await Task.deleteOne({ _id: task._id });

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'TASK_DELETED',
      entityType: 'TASK',
      entityId: task._id,
      metadata: {
        title: task.title,
        status: task.status,
      },
    });

    broadcastTaskEvent(project._id, 'task:deleted', {
      taskId: task._id.toString(),
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Task deleted successfully',
        taskId: task._id.toString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
