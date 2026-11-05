import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Project, IProject } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Task, ITask } from '../models/Task';
import { AppError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      project?: IProject;
      task?: ITask;
    }
  }
}

export const getProjectIdFromRequest = (req: Request): string => {
  const rawId = req.params.projectId || req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || !isValidObjectId(id)) {
    throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
  }
  return id;
};

export const getTaskIdFromRequest = (req: Request): string => {
  const rawId = req.params.taskId || req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || !isValidObjectId(id)) {
    throw new AppError('Invalid task identifier format', 400, 'INVALID_ID');
  }
  return id;
};

/**
 * Ensures req.user is an Admin, the Primary PM, or an active Member of the project.
 * For private projects, non-members receive a 404 to keep private projects invisible.
 */
export const requireProjectAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const projectId = getProjectIdFromRequest(req);
    const project = await Project.findById(projectId);

    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // 1. Organization Administrators have superuser access to all projects
    if (req.user.globalRole === 'ADMIN') {
      req.project = project;
      return next();
    }

    // 2. Primary Project Manager has full access
    if (project.primaryManagerId.equals(req.user._id)) {
      req.project = project;
      return next();
    }

    // 3. Active Project Employees (Members)
    const membership = await ProjectMembership.findOne({
      projectId: project._id,
      userId: req.user._id,
      status: 'ACTIVE',
    });

    if (membership) {
      req.project = project;
      return next();
    }

    // 4. Non-members:
    // If project is PRIVATE, return 404 to keep private project existence hidden
    if (project.visibility === 'PRIVATE') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // If PUBLIC, non-members cannot access full project resources
    throw new AppError('Project membership required to access this resource', 403, 'FORBIDDEN');
  } catch (error) {
    next(error);
  }
};

/**
 * Ensures req.user is either an Organization Administrator or the Primary Manager of this project.
 */
export const requireProjectManager = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const projectId = getProjectIdFromRequest(req);
    const project = await Project.findById(projectId);

    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (req.user.globalRole === 'ADMIN' || project.primaryManagerId.equals(req.user._id)) {
      req.project = project;
      return next();
    }

    throw new AppError('Primary project manager or administrator privileges required', 403, 'FORBIDDEN');
  } catch (error) {
    next(error);
  }
};

/**
 * Ensures req.user is an Admin, Primary PM, or an active Member of the task's project.
 */
export const requireTaskAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const taskId = getTaskIdFromRequest(req);
    const task = await Task.findById(taskId);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // 1. Admin
    if (req.user.globalRole === 'ADMIN') {
      req.task = task;
      req.project = project;
      return next();
    }

    // 2. Primary PM
    if (project.primaryManagerId.equals(req.user._id)) {
      req.task = task;
      req.project = project;
      return next();
    }

    // 3. Active member
    const membership = await ProjectMembership.findOne({
      projectId: project._id,
      userId: req.user._id,
      status: 'ACTIVE',
    });

    if (membership) {
      req.task = task;
      req.project = project;
      return next();
    }

    // Non-member
    if (project.visibility === 'PRIVATE') {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    throw new AppError('Project membership required to access this task', 403, 'FORBIDDEN');
  } catch (error) {
    next(error);
  }
};

/**
 * Ensures req.user is either an Organization Administrator or the Primary PM of the task's project.
 */
export const requireTaskProjectManager = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const taskId = getTaskIdFromRequest(req);
    const task = await Task.findById(taskId);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (req.user.globalRole === 'ADMIN' || project.primaryManagerId.equals(req.user._id)) {
      req.task = task;
      req.project = project;
      return next();
    }

    // Check if user is at least a member or if project is private
    const membership = await ProjectMembership.exists({
      projectId: project._id,
      userId: req.user._id,
      status: 'ACTIVE',
    });

    if (!membership && project.visibility === 'PRIVATE') {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    throw new AppError('Primary project manager or administrator privileges required', 403, 'FORBIDDEN');
  } catch (error) {
    next(error);
  }
};

/**
 * Enforces Spec 9.2:
 * Verifies that the user attempting to move a task is the assigned employee, the project's PM, or an Admin.
 */
export const requireTaskAssigneeOrManager = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const taskId = getTaskIdFromRequest(req);
    const task = await Task.findById(taskId);

    if (!task) {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // 1. Admin
    if (req.user.globalRole === 'ADMIN') {
      req.task = task;
      req.project = project;
      return next();
    }

    // 2. Primary PM
    if (project.primaryManagerId.equals(req.user._id)) {
      req.task = task;
      req.project = project;
      return next();
    }

    // 3. Assigned employee
    if (task.assigneeId && task.assigneeId.equals(req.user._id)) {
      // Must still be active member
      const membership = await ProjectMembership.exists({
        projectId: project._id,
        userId: req.user._id,
        status: 'ACTIVE',
      });

      if (membership) {
        req.task = task;
        req.project = project;
        return next();
      }
    }

    // Non-assigned member or non-member
    const membership = await ProjectMembership.exists({
      projectId: project._id,
      userId: req.user._id,
      status: 'ACTIVE',
    });

    if (!membership && project.visibility === 'PRIVATE') {
      throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    }

    throw new AppError(
      'Only the assigned employee, project manager, or an administrator can update this task status',
      403,
      'FORBIDDEN'
    );
  } catch (error) {
    next(error);
  }
};
