import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { isValidObjectId, Types } from 'mongoose';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User, IUser } from '../models/User';
import { Project } from '../models/Project';
import { ProjectMembership } from '../models/ProjectMembership';
import { Conversation } from '../models/Conversation';
import { Message, toMessageResponse } from '../models/Message';
import { parseAllowedOrigins, isOriginAllowed } from '../config/cors';
import { env } from '../config/env';

declare module 'socket.io' {
  interface SocketData {
    user?: IUser;
  }
}

let ioInstance: SocketIOServer | null = null;
const userSocketsMap = new Map<string, Set<Socket>>();

export const getIO = (): SocketIOServer | null => ioInstance;

/**
 * Initializes the Socket.IO server with JWT authentication and room authorization handlers.
 */
export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin '${origin}' not allowed by CORS policy`), false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // 1. Handshake Authentication Interceptor (Spec 9.3)
  io.use(async (socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const rawToken =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

      if (!rawToken) {
        return next(new Error('Authentication error: Token missing'));
      }

      let decoded: JwtPayload;
      try {
        decoded = verifyToken(rawToken);
      } catch (jwtErr) {
        return next(new Error(`Authentication error: ${(jwtErr as Error).message}`));
      }

      // Verify user from database to prevent stale token claims
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: User account inactive or not found'));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Handshake verification failed'));
    }
  });

  // 2. Connection Lifecycle & Event Routing
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user!;
    const userId = user._id.toString();

    // Register socket in user map for room management and eviction
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    userSocketsMap.get(userId)!.add(socket);

    // Automatically subscribe socket to user's private room for direct notifications
    socket.join(`user:${userId}`);

    // Join Project Room with server-side authorization check (Spec 6.3 & 9.3)
    socket.on('join:project', async (data: { projectId: string }, callback?: (res: any) => void) => {
      try {
        const freshUser = await User.findById(user._id);
        if (!freshUser || !freshUser.isActive) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'User account inactive or not found' });
          if (callback) callback({ success: false, error: 'User account inactive or not found' });
          socket.disconnect(true);
          return;
        }

        const { projectId } = data || {};
        if (!projectId || !isValidObjectId(projectId)) {
          socket.emit('error', { code: 'INVALID_ID', message: 'Invalid projectId format' });
          if (callback) callback({ success: false, error: 'Invalid projectId format' });
          return;
        }

        const project = await Project.findById(projectId);
        if (!project || project.status === 'ARCHIVED') {
          socket.emit('error', { code: 'PROJECT_NOT_FOUND', message: 'Project not found' });
          if (callback) callback({ success: false, error: 'Project not found' });
          return;
        }

        // Authorization: Admin, Primary PM, or Active Member
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
          socket.emit('error', {
            code: 'FORBIDDEN',
            message: 'Not authorized to join this project room',
          });
          if (callback) callback({ success: false, error: 'Not authorized' });
          return;
        }

        socket.join(`project:${projectId}`);
        socket.emit('joined:project', { projectId });
        if (callback) callback({ success: true, projectId });
      } catch (err) {
        socket.emit('error', { code: 'SERVER_ERROR', message: (err as Error).message });
        if (callback) callback({ success: false, error: (err as Error).message });
      }
    });

    // Leave Project Room
    socket.on('leave:project', (data: { projectId: string }) => {
      if (data?.projectId) {
        socket.leave(`project:${data.projectId}`);
        socket.emit('left:project', { projectId: data.projectId });
      }
    });

    // Join Conversation Room with server-side authorization check (Spec 7.1 & 7.2)
    socket.on(
      'join:conversation',
      async (data: { conversationId: string }, callback?: (res: any) => void) => {
        try {
          const freshUser = await User.findById(user._id);
          if (!freshUser || !freshUser.isActive) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'User account inactive or not found' });
            if (callback) callback({ success: false, error: 'User account inactive or not found' });
            socket.disconnect(true);
            return;
          }

          const { conversationId } = data || {};
          if (!conversationId || !isValidObjectId(conversationId)) {
            socket.emit('error', { code: 'INVALID_ID', message: 'Invalid conversationId format' });
            if (callback) callback({ success: false, error: 'Invalid conversationId format' });
            return;
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { code: 'NOT_FOUND', message: 'Conversation not found' });
            if (callback) callback({ success: false, error: 'Conversation not found' });
            return;
          }

          let isAuthorized = false;

          if (conversation.type === 'PROJECT_GROUP') {
            const project = await Project.findById(conversation.projectId);
            if (project && project.status !== 'ARCHIVED') {
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
            }
          } else if (conversation.type === 'ADMIN_PM_DM') {
            // Strictly the 2 participants only
            isAuthorized = conversation.participants.some((p) => p.equals(user._id));
          }

          if (!isAuthorized) {
            socket.emit('error', {
              code: 'FORBIDDEN',
              message: 'Not authorized to join this conversation room',
            });
            if (callback) callback({ success: false, error: 'Not authorized' });
            return;
          }

          socket.join(`conversation:${conversationId}`);
          socket.emit('joined:conversation', { conversationId });
          if (callback) callback({ success: true, conversationId });
        } catch (err) {
          socket.emit('error', { code: 'SERVER_ERROR', message: (err as Error).message });
          if (callback) callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // Leave Conversation Room
    socket.on('leave:conversation', (data: { conversationId: string }) => {
      if (data?.conversationId) {
        socket.leave(`conversation:${data.conversationId}`);
        socket.emit('left:conversation', { conversationId: data.conversationId });
      }
    });

    // Real-time message sending via socket event
    socket.on(
      'message:send',
      async (data: { conversationId: string; content: string }, callback?: (res: any) => void) => {
        try {
          const freshUser = await User.findById(user._id);
          if (!freshUser || !freshUser.isActive) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'User account inactive or not found' });
            if (callback) callback({ success: false, error: 'User account inactive or not found' });
            socket.disconnect(true);
            return;
          }

          const { conversationId, content } = data || {};
          if (!conversationId || !isValidObjectId(conversationId)) {
            socket.emit('error', { code: 'INVALID_ID', message: 'Invalid conversationId format' });
            if (callback) callback({ success: false, error: 'Invalid conversationId' });
            return;
          }

          const trimmedContent = typeof content === 'string' ? content.trim() : '';
          if (!trimmedContent || trimmedContent.length > 5000) {
            socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Message content must be between 1 and 5000 characters' });
            if (callback) callback({ success: false, error: 'Invalid message content' });
            return;
          }

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit('error', { code: 'NOT_FOUND', message: 'Conversation not found' });
            if (callback) callback({ success: false, error: 'Conversation not found' });
            return;
          }

          let isAuthorized = false;
          if (conversation.type === 'PROJECT_GROUP') {
            const project = await Project.findById(conversation.projectId);
            if (project && project.status !== 'ARCHIVED') {
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
            }
          } else if (conversation.type === 'ADMIN_PM_DM') {
            isAuthorized = conversation.participants.some((p) => p.equals(user._id));
          }

          if (!isAuthorized) {
            socket.emit('error', { code: 'FORBIDDEN', message: 'Not authorized to send messages to this conversation' });
            if (callback) callback({ success: false, error: 'Not authorized' });
            return;
          }

          // Persist to MongoDB first (Spec 7.3)
          const message = await Message.create({
            conversationId: conversation._id,
            senderId: user._id,
            content: trimmedContent,
            readBy: [{ userId: user._id, readAt: new Date() }],
          });

          await Conversation.updateOne(
            { _id: conversation._id },
            { $set: { lastMessageAt: new Date() } }
          );

          await message.populate('senderId', 'fullName email avatarUrl');
          const formattedMessage = toMessageResponse(message);

          // Broadcast to conversation room
          io.to(`conversation:${conversationId}`).emit('message:received', formattedMessage);

          if (callback) callback({ success: true, data: formattedMessage });
        } catch (err) {
          socket.emit('error', { code: 'SERVER_ERROR', message: (err as Error).message });
          if (callback) callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // Disconnect cleanup
    socket.on('disconnect', () => {
      const userSockets = userSocketsMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);
        }
      }
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Ejects all connected sockets of a user from project and conversation rooms upon membership revocation.
 * Enforces Spec 7.1: "When an employee is removed or leaves a project, they are immediately evicted from
 * the conversation participants and their active socket is ejected from room conversation:{id}."
 */
export const ejectUserFromRooms = (
  userId: string,
  projectId: string,
  conversationId?: string
): void => {
  const userSockets = userSocketsMap.get(userId);
  if (!userSockets) return;

  for (const socket of userSockets) {
    socket.leave(`project:${projectId}`);
    if (conversationId) {
      socket.leave(`conversation:${conversationId}`);
    }
    socket.emit('project:evicted', { projectId, conversationId });
  }
};

/**
 * Broadcasts a real-time board or task event to room project:{projectId}.
 * Changes are guaranteed to be committed to MongoDB before calling this function (Spec 6.3).
 */
export const broadcastTaskEvent = (
  projectId: string | Types.ObjectId,
  event: 'task:created' | 'task:updated' | 'task:moved' | 'task:deleted' | 'board:rebalanced',
  data: any
): void => {
  if (ioInstance) {
    ioInstance.to(`project:${projectId.toString()}`).emit(event, data);
  }
};

/**
 * Broadcasts a real-time message to room conversation:{conversationId}.
 */
export const broadcastMessage = (
  conversationId: string | Types.ObjectId,
  message: any
): void => {
  if (ioInstance) {
    ioInstance.to(`conversation:${conversationId.toString()}`).emit('message:received', message);
  }
};

/**
 * Emits a real-time notification to the recipient's private user room user:{recipientId}.
 * Database persistence is guaranteed to occur prior to calling this function.
 */
export const emitNotificationToUser = (
  userId: string | Types.ObjectId,
  notification: any
): void => {
  if (ioInstance) {
    ioInstance.to(`user:${userId.toString()}`).emit('notification:received', notification);
  }
};
