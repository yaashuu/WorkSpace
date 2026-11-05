import { Request, Response, NextFunction } from 'express';
import { Project, toProjectResponse } from '../models/Project';
import { ProjectInvitation } from '../models/ProjectInvitation';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { ActivityLog } from '../models/ActivityLog';
import { User } from '../models/User';
import { createNotification } from '../services/notificationService';
import {
  createInvitationSchema,
  acceptInvitationSchema,
} from '../validations/invitation';
import { generateInvitationToken, hashToken } from '../utils/crypto';
import { withTransaction, checkTransactionSupport } from '../utils/transaction';
import { AppError } from '../errors/AppError';

export const createInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = createInvitationSchema.parse(req.body);

    const project = await Project.findById(validatedData.projectId);
    if (!project) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Permission check (Spec 3.3 matrix): Admin or assigned Primary PM
    const isPrimaryPM = project.primaryManagerId.equals(req.user!._id);
    const isAdmin = req.user!.globalRole === 'ADMIN';

    if (!isAdmin && !isPrimaryPM) {
      throw new AppError(
        'Only the organization administrator or the primary project manager may generate invitations',
        403,
        'FORBIDDEN'
      );
    }

    // Generate 32-byte cryptographic token and its SHA-256 hash (Spec 5.1)
    const { rawToken, tokenHash } = generateInvitationToken();

    const expiresInDays = validatedData.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await ProjectInvitation.create({
      projectId: project._id,
      tokenHash,
      invitedEmail: validatedData.invitedEmail ?? null,
      invitedBy: req.user!._id,
      expiresAt,
      maxUses: validatedData.maxUses ?? 1,
      usedCount: 0,
      status: 'PENDING',
    });

    await ActivityLog.create({
      projectId: project._id,
      actorId: req.user!._id,
      action: 'INVITATION_CREATED',
      entityType: 'INVITATION',
      entityId: invitation._id,
      metadata: {
        invitedEmail: invitation.invitedEmail,
        maxUses: invitation.maxUses,
        expiresAt: invitation.expiresAt,
      },
    });

    // Notify registered user if invited by email
    if (validatedData.invitedEmail) {
      const targetUser = await User.findOne({
        email: validatedData.invitedEmail.toLowerCase(),
        isActive: true,
      });
      if (targetUser && !targetUser._id.equals(req.user!._id)) {
        await createNotification({
          recipientId: targetUser._id,
          type: 'INVITATION_RECEIVED',
          title: 'Project Invitation Received',
          body: `You have been invited to join project "${project.name}".`,
          link: `/invitations/accept?token=${rawToken}`,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        invitation: {
          _id: invitation._id.toString(),
          projectId: invitation.projectId.toString(),
          invitedEmail: invitation.invitedEmail,
          expiresAt: invitation.expiresAt.toISOString(),
          maxUses: invitation.maxUses,
          usedCount: invitation.usedCount,
          status: invitation.status,
          createdAt: invitation.createdAt.toISOString(),
        },
        token: rawToken,
        inviteLink: `/invite?token=${rawToken}`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const acceptInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = acceptInvitationSchema.parse(req.body);
    const tokenHash = hashToken(validatedData.token);

    // 1. Find invitation by SHA-256 hash
    const invitation = await ProjectInvitation.findOne({ tokenHash });
    if (!invitation) {
      throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    // 2. Validate revocation, expiration, and usage limits
    if (invitation.status === 'REVOKED') {
      throw new AppError('This invitation has been revoked', 410, 'INVITATION_REVOKED');
    }

    if (invitation.expiresAt < new Date() || invitation.status === 'EXPIRED') {
      if (invitation.status !== 'EXPIRED') {
        invitation.status = 'EXPIRED';
        await invitation.save();
      }
      throw new AppError('This invitation has expired', 410, 'INVITATION_EXPIRED');
    }

    if (invitation.usedCount >= invitation.maxUses || invitation.status === 'ACCEPTED') {
      throw new AppError(
        'This invitation has reached its maximum usage limit',
        410,
        'INVITATION_EXHAUSTED'
      );
    }

    // 3. Email-restricted check (Spec 5.1): Enforce matching authenticated user email
    if (invitation.invitedEmail) {
      if (req.user!.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
        throw new AppError(
          'This invitation is restricted to a different email address',
          403,
          'FORBIDDEN_EMAIL_MISMATCH'
        );
      }
    }

    // 4. Project validation
    const project = await Project.findById(invitation.projectId).populate(
      'primaryManagerId',
      'fullName email avatarUrl'
    );
    if (!project || project.status === 'ARCHIVED') {
      throw new AppError('Project not found or archived', 404, 'PROJECT_NOT_FOUND');
    }

    // Prevent duplicate membership for current primary manager
    if (project.primaryManagerId.equals(req.user!._id)) {
      throw new AppError(
        'You are already the primary manager of this project',
        400,
        'ALREADY_MEMBER'
      );
    }

    // Prevent duplicate membership for already active member and track prior state
    const existingMembership = await ProjectMembership.findOne({
      projectId: project._id,
      userId: req.user!._id,
    });
    if (existingMembership && existingMembership.status === 'ACTIVE') {
      throw new AppError(
        'You are already an active member of this project',
        400,
        'ALREADY_MEMBER'
      );
    }
    const wasPreviouslyRevoked = existingMembership?.status === 'REVOKED';

    // 5. Execute atomic consumption & membership creation in a transaction (Spec 5.1)
    let consumedInvitation = false;
    let membershipCreated = false;
    let conversationUpdated = false;
    let activityLogCreated = false;
    let membershipResult: any = null;

    try {
      const { membership } = await withTransaction(async (session) => {
        const sessionOptions = session ? { session } : {};

        // Atomic consumption with conditional check:
        // Enforce maxUses, expiration, and user idempotency (user not already in usedBy)
        const updatedInvite = await ProjectInvitation.findOneAndUpdate(
          {
            _id: invitation._id,
            status: { $in: ['PENDING', 'ACCEPTED'] },
            usedCount: { $lt: invitation.maxUses },
            expiresAt: { $gt: new Date() },
            usedBy: { $ne: req.user!._id },
          },
          {
            $inc: { usedCount: 1 },
            $push: { usedBy: req.user!._id },
          },
          { returnDocument: 'after', ...sessionOptions }
        );

        if (!updatedInvite) {
          // Live state inspection to return the exact error code
          const currentInvite = await ProjectInvitation.findById(invitation._id);
          if (!currentInvite) {
            throw new AppError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
          }

          // Idempotency check: If user already used this invite or is an active member
          const isAlreadyInUsedBy = currentInvite.usedBy?.some((u) => u.equals(req.user!._id));
          const isAlreadyActiveMember = await ProjectMembership.exists({
            projectId: project._id,
            userId: req.user!._id,
            status: 'ACTIVE',
          });

          if (isAlreadyInUsedBy || isAlreadyActiveMember) {
            throw new AppError(
              'You are already an active member of this project',
              400,
              'ALREADY_MEMBER'
            );
          }

          if (currentInvite.status === 'REVOKED') {
            throw new AppError('This invitation has been revoked', 410, 'INVITATION_REVOKED');
          }

          if (currentInvite.expiresAt < new Date() || currentInvite.status === 'EXPIRED') {
            throw new AppError('This invitation has expired', 410, 'INVITATION_EXPIRED');
          }

          throw new AppError(
            'Invitation was consumed or expired concurrently. Please request a new invitation.',
            409,
            'INVITATION_CONCURRENT_USE'
          );
        }

        consumedInvitation = true;

        // If maximum uses reached, mark status as ACCEPTED
        if (updatedInvite.usedCount >= updatedInvite.maxUses) {
          updatedInvite.status = 'ACCEPTED';
          await updatedInvite.save(sessionOptions);
        }

        // Establish or reactivate ProjectMembership
        const newMembership = await ProjectMembership.findOneAndUpdate(
          { projectId: project._id, userId: req.user!._id },
          { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
          { upsert: true, returnDocument: 'after', ...sessionOptions }
        );
        membershipCreated = true;

        // Add user to project group conversation (Spec 7.1)
        await Conversation.updateOne(
          { type: 'PROJECT_GROUP', projectId: project._id },
          { $addToSet: { participants: req.user!._id } },
          sessionOptions
        );
        conversationUpdated = true;

        // Record activity log
        await ActivityLog.create(
          [
            {
              projectId: project._id,
              actorId: req.user!._id,
              action: 'MEMBER_JOINED_INVITATION',
              entityType: 'INVITATION',
              entityId: invitation._id,
              metadata: {
                userId: req.user!._id,
                invitationId: invitation._id,
              },
            },
          ],
          sessionOptions
        );
        activityLogCreated = true;

        return { membership: newMembership };
      });

      membershipResult = membership;
    } catch (txError) {
      // Standalone MongoDB multi-document compensation handler:
      // If transactions are not supported by the database engine and a downstream step failed,
      // compensate every mutated document in reverse order to restore consistency.
      const supportsTx = await checkTransactionSupport();
      if (!supportsTx && consumedInvitation && !membershipResult) {
        try {
          // A. Rollback activity log if created
          if (activityLogCreated) {
            await ActivityLog.deleteOne({
              projectId: project._id,
              actorId: req.user!._id,
              entityId: invitation._id,
              action: 'MEMBER_JOINED_INVITATION',
            }).catch(() => {});
          }

          // B. Rollback conversation participant if added
          if (conversationUpdated) {
            await Conversation.updateOne(
              { type: 'PROJECT_GROUP', projectId: project._id },
              { $pull: { participants: req.user!._id } }
            ).catch(() => {});
          }

          // C. Rollback project membership if created/reactivated
          if (membershipCreated) {
            if (wasPreviouslyRevoked) {
              await ProjectMembership.updateOne(
                { projectId: project._id, userId: req.user!._id },
                { $set: { status: 'REVOKED' } }
              ).catch(() => {});
            } else {
              await ProjectMembership.deleteOne({
                projectId: project._id,
                userId: req.user!._id,
              }).catch(() => {});
            }
          }

          // D. Rollback invitation consumption atomically for this specific user
          // Filter strictly checks { usedBy: req.user!._id } so it CANNOT decrement
          // another user's use under concurrent operations (Scenario D)
          const compInvite = await ProjectInvitation.findOneAndUpdate(
            { _id: invitation._id, usedBy: req.user!._id },
            {
              $inc: { usedCount: -1 },
              $pull: { usedBy: req.user!._id },
            },
            { returnDocument: 'after' }
          );

          // If invitation was previously marked ACCEPTED but usedCount now has remaining slots,
          // safely restore status to PENDING
          if (compInvite && compInvite.usedCount < compInvite.maxUses && compInvite.status === 'ACCEPTED') {
            await ProjectInvitation.updateOne(
              { _id: invitation._id, usedCount: { $lt: compInvite.maxUses } },
              { $set: { status: 'PENDING' } }
            ).catch(() => {});
          }
        } catch (compensationErr) {
          console.error('Failed to execute compensation rollback:', compensationErr);
        }
      }
      throw txError;
    }

    const membership = membershipResult;

    res.status(200).json({
      success: true,
      data: {
        message: 'Successfully joined project via invitation',
        project: toProjectResponse(project),
        membership: {
          _id: membership._id.toString(),
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt.toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
