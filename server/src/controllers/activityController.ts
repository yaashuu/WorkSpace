import { Request, Response, NextFunction } from 'express';
import { ActivityLog, toActivityLogResponse } from '../models/ActivityLog';
import { listActivityLogsQuerySchema } from '../validations/activity';

/**
 * GET /api/v1/projects/:id/activity
 * Retrieves the activity history feed for a project.
 * Authorized for Admin, Primary PM, and active project members.
 */
export const getProjectActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const project = req.project!;
    const query = listActivityLogsQuerySchema.parse(req.query);

    const filter: Record<string, unknown> = {
      projectId: project._id,
    };

    if (query.entityType) {
      filter.entityType = query.entityType;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate('actorId', 'fullName email avatarUrl')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        activityLogs: logs.map(toActivityLogResponse),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
