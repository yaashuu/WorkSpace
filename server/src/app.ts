import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { getCorsOptions } from './config/cors';
import { globalApiLimiter } from './middleware/rateLimiter';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import userRouter from './routes/user';
import projectRouter from './routes/project';
import invitationRouter from './routes/invitation';
import joinRequestRouter from './routes/joinRequest';
import taskRouter from './routes/task';
import conversationRouter from './routes/conversation';
import notificationRouter from './routes/notification';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import { AppError } from './errors/AppError';

const app: Application = express();

// Disable x-powered-by header
app.disable('x-powered-by');

// 1. Helmet Security Headers
// Content Security Policy is disabled for the API tier because this server delivers pure JSON API
// responses consumed by a separate SPA frontend; disabling CSP avoids breaking external frontend font/avatar CDN assets.
// Cross-Origin-Resource-Policy is set to 'cross-origin' to allow permitted frontend domains to consume API resources.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS Policy Enforcement
app.use(cors(getCorsOptions()));

// 3. Core body parsing middleware with configurable payload size limit
app.use(express.json({ limit: env.BODY_LIMIT }));

// 4. Global API Rate Limiter
app.use('/api/v1', globalApiLimiter);

// API routes
app.use('/api/v1', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/projects', projectRouter);
app.use('/api/v1/invitations', invitationRouter);
app.use('/api/v1/join-requests', joinRequestRouter);
app.use('/api/v1/tasks', taskRouter);
app.use('/api/v1/conversations', conversationRouter);
app.use('/api/v1/notifications', notificationRouter);

// Restricted test-error route accessible only in non-production environments
if (env.NODE_ENV !== 'production') {
  app.get('/api/v1/test-error', (_req, _res, next) => {
    next(new AppError('Controlled test error occurred', 400, 'CONTROLLED_TEST_ERROR', { sampleField: 'invalid value' }));
  });
}

// 404 Catch-all handler for unknown routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

export { app };
export default app;
