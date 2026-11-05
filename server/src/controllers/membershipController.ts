import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { ActivityLog } from '../models/ActivityLog';
import { ejectUserFromRooms } from '../sockets';
import { AppError } from '../errors/AppError';

export const listProjectMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: projectId } = req.params;
    if (!isValidObjectId(projectId)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Access check: User must be Admin, Primary PM, or an active Member
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';
    const isMember = await ProjectMembership.exists({
      projectId: project._id,
      userId: req.user!._id,
      status: 'ACTIVE',
    });

    if (!isAdmin && !isPrimaryPM && !isMember) {
      if (project.visibility === 'PRIVATE') {
        throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      }
      throw new AppError('Project membership required to view project members', 403, 'FORBIDDEN');
    }

    // Invariant self-healing: Ensure primary manager always has an active membership record
    const hasPMMembership = await ProjectMembership.exists({
      projectId: project._id,
      userId: project.primaryManagerId,
      status: 'ACTIVE',
    });
    if (!hasPMMembership) {
      await ProjectMembership.findOneAndUpdate(
        { projectId: project._id, userId: project.primaryManagerId },
        { role: 'MEMBER', status: 'ACTIVE', joinedAt: project.createdAt || new Date() },
        { upsert: true, new: true }
      );
    }

    const memberships = await ProjectMembership.find({
      projectId: project._id,
      status: 'ACTIVE',
    })
      .populate('userId', 'fullName email avatarUrl globalRole')
      .sort({ joinedAt: 1 });

    const members = memberships.map((m: any) => ({
      _id: m._id.toString(),
      user: m.userId
        ? {
            _id: m.userId._id.toString(),
            fullName: m.userId.fullName,
            email: m.userId.email,
            avatarUrl: m.userId.avatarUrl ?? null,
            globalRole: m.userId.globalRole,
          }
        : null,
      role: m.role,
      status: m.status,
      isPrimaryManager: project.primaryManagerId.equals(m.userId?._id),
      joinedAt: m.joinedAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      data: {
        members,
        total: members.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const removeProjectMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawProjectId = req.params.id;
    const rawUserId = req.params.userId;
    const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
    const targetUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!projectId || !targetUserId || !isValidObjectId(projectId) || !isValidObjectId(targetUserId)) {
      throw new AppError('Invalid identifier format', 400, 'INVALID_ID');
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Authority: Admin or Primary PM (Spec 3.3 matrix)
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';

    if (!isAdmin && !isPrimaryPM) {
      throw new AppError(
        'Only the administrator or the primary project manager may remove members',
        403,
        'FORBIDDEN'
      );
    }

    // Protection: Cannot remove the Primary Project Manager via member removal
    if (project.primaryManagerId.equals(targetUserId)) {
      throw new AppError(
        'Cannot remove the primary project manager. Reassign the manager role before removing this account.',
        400,
        'CANNOT_REMOVE_PRIMARY_MANAGER'
      );
    }

    const membership = await ProjectMembership.findOne({
      projectId: project._id,
      userId: targetUserId,
      status: 'ACTIVE',
    });

    if (!membership) {
      throw new AppError('Active membership not found for this user in the project', 404, 'MEMBERSHIP_NOT_FOUND');
    }

    membership.status = 'REVOKED';
    await membership.save();

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'MEMBER_REMOVED',
      entityType: 'MEMBERSHIP',
      entityId: membership._id,
      metadata: {
        removedUserId: targetUserId,
        removedBy: req.user!._id,
      },
    });

    // Evict removed member from project conversation participants and socket rooms (Spec 7.1)
    const conv = await Conversation.findOneAndUpdate(
      { type: 'PROJECT_GROUP', projectId: project._id },
      { $pull: { participants: targetUserId } },
      { returnDocument: 'after' }
    );

    ejectUserFromRooms(
      targetUserId,
      project._id.toString(),
      conv?._id.toString()
    );

    res.status(200).json({
      success: true,
      data: {
        message: 'Member removed from project successfully',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
