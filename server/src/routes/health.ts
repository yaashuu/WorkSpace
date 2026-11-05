import { Router, Request, Response } from 'express';
import { isDatabaseConnected } from '../config/database';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  if (dbConnected) {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        uptime,
        services: {
          database: {
            status: 'connected',
          },
        },
      },
      timestamp,
    });
  }

  return res.status(503).json({
    success: false,
    data: {
      status: 'degraded',
      uptime,
      services: {
        database: {
          status: 'disconnected',
        },
      },
    },
    error: {
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database connection is not ready',
    },
    timestamp,
  });
});

export { router as healthRouter };
export default router;
