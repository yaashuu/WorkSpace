import { Request, Response, NextFunction } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { Conversation, toConversationResponse } from '../models/Conversation';
import { Message, toMessageResponse } from '../models/Message';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { User } from '../models/User';
import { sendMessageSchema, getMessagesQuerySchema } from '../validations/chat';
import { broadcastMessage } from '../sockets';
import { AppError } from '../errors/AppError';

/**
 * Validates that the authenticated user is currently authorized to access a conversation.
 * Server-side dynamic check against database state to prevent stale access.
 */
const verifyConversationAccess = async (
  conversation: any,
  user: any
): Promise<void> => {
  if (conversation.type === 'PROJECT_GROUP') {
    const project = await Project.findById(conversation.projectId);
    if (!project || project.status === 'ARCHIVED') {
      throw new AppError('Associated project not found or archived', 404, 'PROJECT_NOT_FOUND');
    }

    if (user.globalRole === 'ADMIN' || project.primaryManagerId.equals(user._id)) {
      return;
    }

    const membership = await ProjectMembership.exists({
      projectId: project._id,
      userId: user._id,
      status: 'ACTIVE',
    });

    if (!membership) {
      if (project.visibility === 'PRIVATE') {
        throw new AppError('Conversation not found', 404, 'NOT_FOUND');
      }
      throw new AppError('Active project membership required to access this conversation', 403, 'FORBIDDEN');
    }
  } else if (conversation.type === 'ADMIN_PM_DM') {
    const isParticipant = conversation.participants.some((p: Types.ObjectId) =>
      p.equals(user._id)
    );
    if (!isParticipant) {
      throw new AppError('You are not a participant in this conversation', 403, 'FORBIDDEN');
    }
  }
};

/**
 * GET /api/v1/conversations/project/:projectId
 * Fetches or lazily initializes the project group conversation for authorized members.
 */
export const getProjectConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { projectId } = req.params;
    if (!isValidObjectId(projectId)) {
      throw new AppError('Invalid project identifier format', 400, 'INVALID_ID');
    }

    const project = await Project.findById(projectId);
    if (!project || project.status === 'ARCHIVED') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const user = req.user!;

    // Authorization check
    let isAuthorized = false;
    if (user.globalRole === 'ADMIN' || project.primaryManagerId.equals(user._id)) {
      isAuthorized = true;
    } else {
      const membership = await ProjectMembership.exists({
        projectId: project._id,
        userId: user._id,
        status: 'ACTIVE',
      });
      isAuthorized = !!membership;
    }

    if (!isAuthorized) {
      if (project.visibility === 'PRIVATE') {
        throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
      }
      throw new AppError('Project membership required to access conversation', 403, 'FORBIDDEN');
    }

    // Find or create project group conversation
    let conversation = await Conversation.findOne({
      type: 'PROJECT_GROUP',
      projectId: project._id,
    });

    if (!conversation) {
      const activeMemberships = await ProjectMembership.find({
        projectId: project._id,
        status: 'ACTIVE',
      }).select('userId');

      const participantSet = new Set<string>();
      participantSet.add(project.createdBy.toString());
      participantSet.add(project.primaryManagerId.toString());
      participantSet.add(user._id.toString());
      for (const m of activeMemberships) {
        participantSet.add(m.userId.toString());
      }

      conversation = await Conversation.create({
        type: 'PROJECT_GROUP',
        projectId: project._id,
        participants: Array.from(participantSet).map((id) => new Types.ObjectId(id)),
        lastMessageAt: new Date(),
      });
    } else {
      // Ensure user is registered in conversation participants
      if (!conversation.participants.some((p) => p.equals(user._id))) {
        conversation = await Conversation.findByIdAndUpdate(
          conversation._id,
          { $addToSet: { participants: user._id } },
          { returnDocument: 'after' }
        );
      }
    }

    res.status(200).json({
      success: true,
      data: toConversationResponse(conversation),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/conversations/admin-pm/:managerId
 * Fetches or initializes a private 1-on-1 direct conversation between Admin and Project Manager.
 */
export const getAdminPmConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { managerId } = req.params;
    if (!isValidObjectId(managerId)) {
      throw new AppError('Invalid manager identifier format', 400, 'INVALID_ID');
    }

    const user = req.user!;

    if (user.globalRole === 'ADMIN') {
      const pmUser = await User.findById(managerId);
      if (!pmUser || !pmUser.isActive) {
        throw new AppError('Manager account not found or inactive', 404, 'MANAGER_NOT_FOUND');
      }

      let conversation = await Conversation.findOne({
        type: 'ADMIN_PM_DM',
        projectId: null,
        participants: { $all: [user._id, pmUser._id] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          type: 'ADMIN_PM_DM',
          projectId: null,
          participants: [user._id, pmUser._id],
          lastMessageAt: new Date(),
        });
      }

      res.status(200).json({
        success: true,
        data: toConversationResponse(conversation),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Requester is not an Admin. Must be an active Primary PM on at least one project
    const isPm = await Project.exists({ primaryManagerId: user._id, status: 'ACTIVE' });
    if (!isPm) {
      throw new AppError('Administrator or Project Manager privileges required', 403, 'FORBIDDEN');
    }

    // First check if an existing DM conversation already exists for this PM
    let conversation = await Conversation.findOne({
      type: 'ADMIN_PM_DM',
      projectId: null,
      participants: user._id,
    });

    if (!conversation) {
      // If managerId was passed as a specific Admin ID, use that admin
      let adminUser = await User.findOne({ _id: managerId, globalRole: 'ADMIN', isActive: true });
      if (!adminUser) {
        // Fallback to project creator or any active Admin
        const project = await Project.findOne({ primaryManagerId: user._id, status: 'ACTIVE' });
        if (project) {
          adminUser = await User.findOne({ _id: project.createdBy, globalRole: 'ADMIN', isActive: true });
        }
        if (!adminUser) {
          adminUser = await User.findOne({ globalRole: 'ADMIN', isActive: true });
        }
      }

      if (!adminUser) {
        throw new AppError('No active administrator available for direct messaging', 404, 'ADMIN_NOT_FOUND');
      }

      conversation = await Conversation.create({
        type: 'ADMIN_PM_DM',
        projectId: null,
        participants: [adminUser._id, user._id],
        lastMessageAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      data: toConversationResponse(conversation),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/conversations/:id/messages
 * Retrieves paginated reverse-chronological message history.
 */
export const getConversationMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid conversation identifier format', 400, 'INVALID_ID');
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    // Enforce authorization
    await verifyConversationAccess(conversation, req.user!);

    const query = getMessagesQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { conversationId: conversation._id };

    if (query.before) {
      const beforeDate = new Date(query.before);
      if (!isNaN(beforeDate.getTime())) {
        filter.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await Message.find(filter)
      .populate('senderId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 })
      .limit(query.limit);

    res.status(200).json({
      success: true,
      data: messages.map(toMessageResponse),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/conversations/:id/messages
 * Sends a message in a conversation and triggers real-time broadcast.
 */
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid conversation identifier format', 400, 'INVALID_ID');
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }

    // Enforce authorization
    await verifyConversationAccess(conversation, req.user!);

    const validated = sendMessageSchema.parse(req.body);

    // 1. Persist to MongoDB first (Spec 7.3)
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user!._id,
      content: validated.content,
      readBy: [{ userId: req.user!._id, readAt: new Date() }],
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { lastMessageAt: new Date() } }
    );

    await message.populate('senderId', 'fullName email avatarUrl');
    const formattedMessage = toMessageResponse(message);

    // 2. Broadcast via Socket.IO to room conversation:{id}
    broadcastMessage(conversation._id, formattedMessage);

    res.status(201).json({
      success: true,
      data: formattedMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
