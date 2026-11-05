import { io, Socket } from 'socket.io-client';
import { MessageResponse } from '../types/chat';
import { NotificationResponse } from '../types/notification';

const SOCKET_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'http://localhost:5000';

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

export const getSocket = (): Socket | null => socketInstance;

export const connectSocket = (token: string): Socket => {
  // If socket is already connected with identical token, reuse it
  if (socketInstance && currentToken === token && socketInstance.connected) {
    return socketInstance;
  }

  // If token changed or existing disconnected instance, clean up first
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentToken = token;

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socketInstance.on('connect', () => {
    // Re-join any necessary rooms on reconnect if needed
  });

  socketInstance.on('connect_error', (error) => {
    console.warn('[Socket.IO] Connection error:', error.message);
  });

  return socketInstance;
};

export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = null;
  }
};

export const joinConversationRoom = (
  conversationId: string,
  callback?: (res: { success: boolean; conversationId?: string; error?: string }) => void
): void => {
  if (!socketInstance || !socketInstance.connected) return;
  socketInstance.emit('join:conversation', { conversationId }, callback);
};

export const leaveConversationRoom = (conversationId: string): void => {
  if (!socketInstance || !socketInstance.connected) return;
  socketInstance.emit('leave:conversation', { conversationId });
};

export const joinProjectRoom = (
  projectId: string,
  callback?: (res: { success: boolean; projectId?: string; error?: string }) => void
): void => {
  if (!socketInstance || !socketInstance.connected) return;
  socketInstance.emit('join:project', { projectId }, callback);
};

export const leaveProjectRoom = (projectId: string): void => {
  if (!socketInstance || !socketInstance.connected) return;
  socketInstance.emit('leave:project', { projectId });
};

export const sendSocketMessage = (
  conversationId: string,
  content: string,
  callback?: (res: { success: boolean; data?: MessageResponse; error?: string }) => void
): void => {
  if (!socketInstance || !socketInstance.connected) {
    if (callback) callback({ success: false, error: 'Socket not connected' });
    return;
  }
  socketInstance.emit('message:send', { conversationId, content }, callback);
};

export const subscribeToMessage = (handler: (msg: MessageResponse) => void): (() => void) => {
  if (!socketInstance) return () => {};
  socketInstance.on('message:received', handler);
  return () => {
    socketInstance?.off('message:received', handler);
  };
};

export const subscribeToNotification = (
  handler: (notif: NotificationResponse) => void
): (() => void) => {
  if (!socketInstance) return () => {};
  socketInstance.on('notification:received', handler);
  return () => {
    socketInstance?.off('notification:received', handler);
  };
};

export const subscribeToEviction = (
  handler: (data: { projectId: string; conversationId?: string }) => void
): (() => void) => {
  if (!socketInstance) return () => {};
  socketInstance.on('project:evicted', handler);
  return () => {
    socketInstance?.off('project:evicted', handler);
  };
};

export const subscribeToConnectionState = (
  handler: (connected: boolean) => void
): (() => void) => {
  if (!socketInstance) return () => {};

  const onConnect = () => handler(true);
  const onDisconnect = () => handler(false);

  socketInstance.on('connect', onConnect);
  socketInstance.on('disconnect', onDisconnect);

  // Initial state callback
  handler(socketInstance.connected);

  return () => {
    socketInstance?.off('connect', onConnect);
    socketInstance?.off('disconnect', onDisconnect);
  };
};
