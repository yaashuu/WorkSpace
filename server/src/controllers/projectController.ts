import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  Project,
  toProjectResponse,
  toPublicProjectMetadata,
} from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { ActivityLog } from '../models/ActivityLog';
import { User } from '../models/User';
import {
  createProjectSchema,
  updateProjectSchema,
  updateVisibilitySchema,
  assignManagerSchema,
} from '../validations/project';
import { withTransaction } from '../utils/transaction';
import { AppError } from '../errors/AppError';

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = createProjectSchema.parse(req.body);

    // 1. Verify that the project key is unique
    const normalizedKey = validatedData.key.toUpperCase().trim();
    const existingProject = await Project.findOne({ key: normalizedKey });
    if (existingProject) {
      throw new AppError('A project with this key already exists', 409, 'DUPLICATE_KEY');
    }

    // 2. Validate the designated primary manager
    const manager = await User.findById(validatedData.primaryManagerId);
    if (!manager) {
      throw new AppError('Designated primary manager not found', 404, 'USER_NOT_FOUND');
    }
    if (!manager.isActive) {
      throw new AppError('Designated primary manager account is inactive', 400, 'INACTIVE_USER');
    }

    // 3. Atomically create the project, initial manager membership, and activity log
    const project = await withTransaction(async (session) => {
      const sessionOptions = session ? { session } : {};

      const [newProject] = await Project.create(
        [
          {
            name: validatedData.name,
            key: normalizedKey,
            description: validatedData.description,
            visibility: 'PRIVATE', // Spec 4.1: newly created projects strictly default to PRIVATE
            status: 'ACTIVE',
            createdBy: req.user!._id,
            primaryManagerId: manager._id,
          },
        ],
        sessionOptions
      );

      // Establish initial project membership for the manager
      await ProjectMembership.create(
        [
          {
            projectId: newProject._id,
            userId: manager._id,
            role: 'MEMBER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        ],
        sessionOptions
      );

      // Record activity log
      await ActivityLog.create(
        [
          {
            projectId: newProject._id,
            actorId: req.user!._id,
            action: 'PROJECT_CREATED',
            entityType: 'PROJECT',
            entityId: newProject._id,
            metadata: {
              name: newProject.name,
              key: newProject.key,
              primaryManagerId: manager._id,
            },
          },
        ],
        sessionOptions
      );

      // Initialize project group conversation (Spec 7.1)
      await Conversation.create(
        [
          {
            type: 'PROJECT_GROUP',
            projectId: newProject._id,
            participants: [req.user!._id, manager._id],
            lastMessageAt: new Date(),
          },
        ],
        sessionOptions
      );

      return newProject;
    });

    // Populate manager info for the response
    await project.populate('primaryManagerId', 'fullName email avatarUrl');

    res.status(201).json({
      success: true,
      data: {
        project: toProjectResponse(project),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user!;

    // Case 1: Organization Administrator lists all projects (public and private)
    if (user.globalRole === 'ADMIN') {
      const projects = await Project.find()
        .populate('primaryManagerId', 'fullName email avatarUrl')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: {
          projects: projects.map(toProjectResponse),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Case 2: Standard User:
    // a. Projects where the user is an active member or the primary manager (detailed access)
    const activeMemberships = await ProjectMembership.find({
      userId: user._id,
      status: 'ACTIVE',
    }).select('projectId');
    const memberProjectIds = activeMemberships.map((m) => m.projectId);

    const joinedProjects = await Project.find({
      $or: [{ _id: { $in: memberProjectIds } }, { primaryManagerId: user._id }],
    })
      .populate('primaryManagerId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 });

    const joinedProjectIds = joinedProjects.map((p) => p._id);

    // b. Public active projects where the user is NOT a member (discoverable with limited metadata)
    const publicProjects = await Project.find({
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      _id: { $nin: joinedProjectIds },
    })
      .populate('primaryManagerId', 'fullName avatarUrl')
      .sort({ createdAt: -1 });

    const publicWithCounts = await Promise.all(
      publicProjects.map(async (p) => {
        const count = await ProjectMembership.countDocuments({
          projectId: p._id,
          status: 'ACTIVE',
        });
        return toPublicProjectMetadata(p, count);
      })
    );

    res.status(200).json({
      success: true,
      data: {
        projects: [...joinedProjects.map(toProjectResponse), ...publicWithCounts],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const project = await Project.findById(id).populate(
      'primaryManagerId',
      'fullName email avatarUrl'
    );
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const user = req.user!;

    // Admins and the Primary Manager have full access
    const pmIdStr = project.primaryManagerId?._id
      ? project.primaryManagerId._id.toString()
      : project.primaryManagerId?.toString() ?? (project.populated?.('primaryManagerId')?.toString() || '');
    const isPrimaryManager = Boolean(pmIdStr && pmIdStr === user._id.toString());

    if (user.globalRole === 'ADMIN' || isPrimaryManager) {
      res.status(200).json({
        success: true,
        data: {
          project: toProjectResponse(project),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check active membership
    const isMember = await ProjectMembership.exists({
      projectId: project._id,
      userId: user._id,
      status: 'ACTIVE',
    });

    if (isMember) {
      res.status(200).json({
        success: true,
        data: {
          project: toProjectResponse(project),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Non-member access:
    // If PRIVATE, project is invisible (404)
    if (project.visibility === 'PRIVATE') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // If PUBLIC, return limited public metadata
    const activeMemberCount = await ProjectMembership.countDocuments({
      projectId: project._id,
      status: 'ACTIVE',
    });

    res.status(200).json({
      success: true,
      data: {
        project: toPublicProjectMetadata(project, activeMemberCount),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const validatedData = updateProjectSchema.parse(req.body);

    const project = await Project.findById(id);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Strictly apply only allowlisted fields: name, description, status
    if (validatedData.name !== undefined) {
      project.name = validatedData.name;
    }
    if (validatedData.description !== undefined) {
      project.description = validatedData.description;
    }
    if (validatedData.status !== undefined) {
      project.status = validatedData.status;
    }

    await project.save();
    await project.populate('primaryManagerId', 'fullName email avatarUrl');

    res.status(200).json({
      success: true,
      data: {
        project: toProjectResponse(project),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const updateVisibility = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const validatedData = updateVisibilitySchema.parse(req.body);

    const project = await Project.findById(id);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    project.visibility = validatedData.visibility;
    await project.save();
    await project.populate('primaryManagerId', 'fullName email avatarUrl');

    res.status(200).json({
      success: true,
      data: {
        project: toProjectResponse(project),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const replacePrimaryManager = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const validatedData = assignManagerSchema.parse(req.body);
    const newManagerId = validatedData.primaryManagerId;

    const project = await Project.findById(id);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Check if new manager is already the primary manager
    if (project.primaryManagerId.equals(newManagerId)) {
      throw new AppError(
        'User is already the primary manager for this project',
        400,
        'ALREADY_PRIMARY_MANAGER'
      );
    }

    // Validate incoming manager
    const newManager = await User.findById(newManagerId);
    if (!newManager) {
      throw new AppError('Designated new manager not found', 404, 'USER_NOT_FOUND');
    }
    if (!newManager.isActive) {
      throw new AppError('Designated new manager account is inactive', 400, 'INACTIVE_USER');
    }

    const oldManagerId = project.primaryManagerId;
    const oldManager = await User.findById(oldManagerId);

    // Execute manager reassignment and membership synchronization within an atomic transaction
    const updatedProject = await withTransaction(async (session) => {
      const sessionOptions = session ? { session } : {};

      // Optimistic concurrency control: ensure primaryManagerId hasn't changed concurrently
      const updated = await Project.findOneAndUpdate(
        { _id: project._id, primaryManagerId: oldManagerId },
        { primaryManagerId: newManager._id },
        { returnDocument: 'after', ...sessionOptions }
      );

      if (!updated) {
        throw new AppError(
          'Concurrent manager reassignment detected. Please reload and retry.',
          409,
          'CONFLICT'
        );
      }

      // Demotion Policy (Spec 4.2):
      // 1. If outgoing manager is still active, retain membership as active regular employee (role: 'MEMBER', status: 'ACTIVE')
      if (oldManager && oldManager.isActive) {
        await ProjectMembership.findOneAndUpdate(
          { projectId: project._id, userId: oldManagerId },
          { role: 'MEMBER', status: 'ACTIVE' },
          { upsert: true, ...sessionOptions }
        );
      } else {
        // 2. If outgoing manager has been deactivated/ineligible, revoke membership
        await ProjectMembership.findOneAndUpdate(
          { projectId: project._id, userId: oldManagerId },
          { status: 'REVOKED' },
          sessionOptions
        );
      }

      // 3. Incoming manager: ensure membership exists and is active
      await ProjectMembership.findOneAndUpdate(
        { projectId: project._id, userId: newManager._id },
        { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
        { upsert: true, ...sessionOptions }
      );

      // 4. Audit Logging (Spec 4.2): Record ActivityLog entry of type 'MANAGER_REPLACED'
      await ActivityLog.create(
        [
          {
            projectId: project._id,
            actorId: req.user!._id,
            action: 'MANAGER_REPLACED',
            entityType: 'PROJECT',
            entityId: project._id,
            metadata: {
              previousManagerId: oldManagerId,
              newManagerId: newManager._id,
            },
          },
        ],
        sessionOptions
      );

      // 5. Synchronize project conversation participants (Spec 7.1)
      await Conversation.updateOne(
        { type: 'PROJECT_GROUP', projectId: project._id },
        { $addToSet: { participants: newManager._id } },
        sessionOptions
      );

      return updated;
    });

    await updatedProject.populate('primaryManagerId', 'fullName email avatarUrl');

    res.status(200).json({
      success: true,
      data: {
        project: toProjectResponse(updatedProject),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
