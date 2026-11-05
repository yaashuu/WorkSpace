import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Project } from '../models/Project';
import { JoinRequest } from '../models/JoinRequest';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { ActivityLog } from '../models/ActivityLog';
import { createNotification } from '../services/notificationService';
import { reviewJoinRequestSchema } from '../validations/joinRequest';
import { AppError } from '../errors/AppError';

export const submitJoinRequest = async (
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
    if (!project || project.status === 'ARCHIVED') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Spec 4.1 & 5.2: Public project join requests only. Private projects are invisible
    if (project.visibility !== 'PUBLIC') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const userId = req.user!._id;

    // Check if user is already Primary PM
    if (project.primaryManagerId.equals(userId)) {
      throw new AppError(
        'You are already the primary manager of this project',
        400,
        'ALREADY_MEMBER'
      );
    }

    // Check if user is already an active member
    const activeMember = await ProjectMembership.exists({
      projectId: project._id,
      userId,
      status: 'ACTIVE',
    });
    if (activeMember) {
      throw new AppError(
        'You are already an active member of this project',
        400,
        'ALREADY_MEMBER'
      );
    }

    // Check if user already has an existing pending join request
    const existingPending = await JoinRequest.findOne({
      projectId: project._id,
      userId,
      status: 'PENDING',
    });
    if (existingPending) {
      throw new AppError(
        'You already have a pending join request for this project',
        409,
        'DUPLICATE_PENDING_REQUEST'
      );
    }

    const joinRequest = await JoinRequest.create({
      projectId: project._id,
      userId,
      status: 'PENDING',
    });

    await ActivityLog.create({
      projectId: project._id,
      actorId: userId,
      action: 'JOIN_REQUEST_CREATED',
      entityType: 'MEMBERSHIP',
      entityId: joinRequest._id,
      metadata: {
        userId,
        joinRequestId: joinRequest._id,
      },
    });

    // Notify project Primary PM of new join request
    await createNotification({
      recipientId: project.primaryManagerId,
      type: 'JOIN_REQUEST_CREATED',
      title: 'New Join Request',
      body: `A new join request has been submitted for project "${project.name}".`,
      link: `/projects/${project._id}/join-requests`,
    });

    res.status(201).json({
      success: true,
      data: {
        joinRequest,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const listProjectJoinRequests = async (
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

    // Review Authority check: Admin or Primary PM of this project
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';

    if (!isAdmin && !isPrimaryPM) {
      throw new AppError(
        'Only the administrator or the primary project manager may review join requests',
        403,
        'FORBIDDEN'
      );
    }

    const joinRequests = await JoinRequest.find({
      projectId: project._id,
      status: 'PENDING',
    })
      .populate('userId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        joinRequests,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const approveJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: requestId } = req.params;
    if (!isValidObjectId(requestId)) {
      throw new AppError('Invalid join request identifier format', 400, 'INVALID_ID');
    }

    const existing = await JoinRequest.findById(requestId);
    if (!existing) {
      throw new AppError('Join request not found', 404, 'JOIN_REQUEST_NOT_FOUND');
    }

    const project = await Project.findById(existing.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Authority check: Admin or Primary PM of this project
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';

    if (!isAdmin && !isPrimaryPM) {
      throw new AppError(
        'Only the administrator or the primary project manager may review join requests',
        403,
        'FORBIDDEN'
      );
    }

    // Atomic race-condition safe decision (Spec 5.2)
    const request = await JoinRequest.findOneAndUpdate(
      { _id: requestId, status: 'PENDING' },
      {
        status: 'APPROVED',
        reviewedBy: req.user!._id,
        reviewedAt: new Date(),
      },
      { returnDocument: 'after' }
    );

    if (!request) {
      throw new AppError(
        'Join request already resolved',
        409,
        'JOIN_REQUEST_ALREADY_RESOLVED'
      );
    }

    // Create or reactivate active project membership
    await ProjectMembership.findOneAndUpdate(
      { projectId: request.projectId, userId: request.userId },
      { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
      { upsert: true }
    );

    // Record activity log
    await ActivityLog.create({
      projectId: request.projectId,
      actorId: req.user!._id,
      action: 'JOIN_REQUEST_APPROVED',
      entityType: 'MEMBERSHIP',
      entityId: request._id,
      metadata: {
        targetUserId: request.userId,
        reviewedBy: req.user!._id,
      },
    });

    // Add user to project group conversation (Spec 5.2 line 213 & Spec 7.1)
    await Conversation.updateOne(
      { type: 'PROJECT_GROUP', projectId: request.projectId },
      { $addToSet: { participants: request.userId } }
    );

    // Notify applicant that join request has been approved
    await createNotification({
      recipientId: request.userId,
      type: 'JOIN_REQUEST_RESOLVED',
      title: 'Join Request Approved',
      body: `Your request to join project "${project.name}" has been approved.`,
      link: `/projects/${request.projectId}`,
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Join request approved and membership established',
        joinRequest: request,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const rejectJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: requestId } = req.params;
    if (!isValidObjectId(requestId)) {
      throw new AppError('Invalid join request identifier format', 400, 'INVALID_ID');
    }

    const validatedData = reviewJoinRequestSchema.parse(req.body);

    const existing = await JoinRequest.findById(requestId);
    if (!existing) {
      throw new AppError('Join request not found', 404, 'JOIN_REQUEST_NOT_FOUND');
    }

    const project = await Project.findById(existing.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Authority check: Admin or Primary PM of this project
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';

    if (!isAdmin && !isPrimaryPM) {
      throw new AppError(
        'Only the administrator or the primary project manager may review join requests',
        403,
        'FORBIDDEN'
      );
    }

    // Atomic race-condition safe decision (Spec 5.2)
    const request = await JoinRequest.findOneAndUpdate(
      { _id: requestId, status: 'PENDING' },
      {
        status: 'REJECTED',
        reviewedBy: req.user!._id,
        reviewedAt: new Date(),
        rejectionReason: validatedData.rejectionReason ?? null,
      },
      { returnDocument: 'after' }
    );

    if (!request) {
      throw new AppError(
        'Join request already resolved',
        409,
        'JOIN_REQUEST_ALREADY_RESOLVED'
      );
    }

    await ActivityLog.create({
      projectId: request.projectId,
      actorId: req.user!._id,
      action: 'JOIN_REQUEST_REJECTED',
      entityType: 'MEMBERSHIP',
      entityId: request._id,
      metadata: {
        targetUserId: request.userId,
        reviewedBy: req.user!._id,
        rejectionReason: request.rejectionReason,
      },
    });

    // Notify applicant that join request was rejected
    await createNotification({
      recipientId: request.userId,
      type: 'JOIN_REQUEST_RESOLVED',
      title: 'Join Request Rejected',
      body: `Your request to join project "${project.name}" has been rejected.`,
      link: `/projects/${request.projectId}`,
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Join request rejected',
        joinRequest: request,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
