import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initSocketServer, getIO } from './sockets';

const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

let isShuttingDown = false;

const startServer = async () => {
  try {
    // 1. Establish database connection before accepting traffic
    await connectDatabase();

    // 2. Start HTTP server (Express + Socket.IO)
    httpServer.listen(env.PORT, () => {
      console.log(`WorkSpace backend server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      console.log(`Health check available at http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('Fatal error during server startup:', (error as Error).message);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Close Socket.IO server connections
  const ioInstance = getIO();
  if (ioInstance) {
    ioInstance.close();
  }

  httpServer.close(async (err) => {
    if (err) {
      console.error('Error closing HTTP server:', err);
    } else {
      console.log('HTTP server closed. No longer accepting new connections.');
    }

    try {
      await disconnectDatabase();
      console.log('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (dbErr) {
      console.error('Error while disconnecting MongoDB:', (dbErr as Error).message);
      process.exit(1);
    }
  });

  // Force exit after 10s if ongoing requests hang
  setTimeout(() => {
    console.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();

export { httpServer, io, startServer, shutdown };
export default httpServer;
